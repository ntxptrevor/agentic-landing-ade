<?php
/**
 * POST /api/publish.php   (Authorization: Bearer <publish token>; no session)
 * {projects:[index entries], bundles:[{slug, canonical?, activity_stream?, html?}]}
 *
 * How the agent-side BidForge sync pushes the knowledge base to the site.
 * Version guard: a bundle whose canonical version is lower than the stored
 * one — or equal but with different content — is refused (409 in its result)
 * so a newer site save is never silently overwritten.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('POST');
bf_require_publish_token();
$cfg = bf_config();
$raw = '';
$body = bf_json_body((int)$cfg['max_publish_mb'] * 1048576, $raw);
$bodyObj = json_decode($raw);
$now = bf_now();

// 1) Projects index entries.
$mutators = [];
$invalid = [];
foreach ((array)($body['projects'] ?? []) as $p) {
    if (!is_array($p) || !bf_valid_slug($p['slug'] ?? null)) {
        $invalid[] = is_array($p) ? ($p['slug'] ?? null) : null;
        continue;
    }
    $incoming = $p;
    $mutators[$p['slug']] = static function (?array $e) use ($incoming, $now) {
        $e = $e ?? [];
        $siteVersion = isset($e['version']) && is_numeric($e['version']) ? (int)$e['version'] : null;
        $kbVersion = isset($incoming['version']) && is_numeric($incoming['version']) ? (int)$incoming['version'] : null;
        $merged = array_merge($e, $incoming);
        // Never roll the index back below a newer site save.
        if ($siteVersion !== null && ($kbVersion === null || $kbVersion < $siteVersion)) {
            $merged['version'] = $siteVersion;
            $merged['updatedAt'] = $e['updatedAt'] ?? $merged['updatedAt'] ?? null;
        }
        $merged['status'] = bf_normalize_status($merged['status'] ?? 'active');
        $merged['updatedAt'] = $merged['updatedAt'] ?? $now;
        return $merged;
    };
}
if ($mutators) {
    bf_index_upsert($mutators);
}

// 2) Per-project bundles.
$results = [];
foreach ((array)($bodyObj->bundles ?? []) as $i => $b) {
    $slug = is_object($b) ? ($b->slug ?? null) : null;
    if (!bf_valid_slug($slug)) {
        $results[] = ['slug' => $slug, 'ok' => false, 'status' => 400, 'error' => 'invalid_slug'];
        continue;
    }
    $dir = bf_project_dir($slug);
    bf_mkdir($dir);
    $res = ['slug' => $slug, 'ok' => true, 'status' => 200];

    if (isset($b->canonical) && is_object($b->canonical)) {
        $canonical = $b->canonical;
        $r = bf_with_lock($dir . '/canonical.json', static function () use ($slug, $dir, $canonical) {
            [$cur, $curRaw, $curHash, $curVersion] = bf_canonical_load($slug);
            $inVersion = bf_canonical_version($canonical);
            if ($inVersion === null) {
                return ['status' => 400, 'error' => 'canonical_missing_version'];
            }
            $json = bf_encode_store($canonical);
            $inHash = hash('sha256', $json);
            if ($cur !== null && $curVersion !== null) {
                if ($inVersion < $curVersion) {
                    return ['status' => 409, 'conflict' => true, 'error' => 'stale_version', 'currentVersion' => $curVersion, 'currentHash' => $curHash];
                }
                if ($inVersion === $curVersion) {
                    // Same version: identical content (ignoring site-only meta) is a no-op; anything else is a fork.
                    if ($inHash === $curHash || bf_canonical_same($canonical, $cur)) {
                        return ['status' => 200, 'unchanged' => true, 'version' => $curVersion, 'hash' => $curHash];
                    }
                    return ['status' => 409, 'conflict' => true, 'error' => 'version_fork', 'currentVersion' => $curVersion, 'currentHash' => $curHash];
                }
            }
            bf_write_atomic($dir . '/canonical.json', $json);
            return ['status' => 200, 'version' => $inVersion, 'hash' => $inHash, 'json' => $json];
        });
        if (isset($r['json'])) {
            bf_version_write($slug, (int)$r['version'], $r['json'], 'kb-sync', 'Published from knowledge base');
            $scDate = bf_find_sc_date($canonical);
            $ver = (int)$r['version'];
            bf_index_upsert([$slug => static function (?array $e) use ($slug, $ver, $now, $scDate) {
                $e = $e ?? ['name' => $slug, 'status' => 'active'];
                if (!isset($e['version']) || (int)$e['version'] < $ver) {
                    $e['version'] = $ver;
                    $e['updatedAt'] = $now;
                }
                if ($scDate !== null) {
                    $e['scDate'] = $scDate;
                }
                return $e;
            }]);
            unset($r['json']);
        }
        if ($r['status'] !== 200) {
            $res['ok'] = false;
        }
        $res = array_merge($res, $r);
    }

    if (isset($b->activity_stream)) {
        $as = json_decode(json_encode($b->activity_stream), true);
        $entries = is_array($as['entries'] ?? null) ? $as['entries'] : (is_array($as) && isset($as[0]) ? $as : []);
        $res['activityAdded'] = bf_activity_merge($slug, $entries);
    }

    if (isset($b->html) && is_string($b->html) && $b->html !== '') {
        bf_write_atomic($dir . '/live.html', $b->html);
        $res['live'] = true;
    }
    $results[] = $res;
}

bf_json([
    'ok'       => true,
    'projects' => ['upserted' => count($mutators), 'invalid' => $invalid],
    'results'  => $results,
]);

/** Equal ignoring site-only meta stamps (savedAt/savedBy). */
function bf_canonical_same(object $a, object $b): bool
{
    $strip = static function (object $o): array {
        $x = json_decode(json_encode($o), true);
        unset($x['meta']['savedAt'], $x['meta']['savedBy']);
        return $x;
    };
    return $strip($a) == $strip($b);
}
