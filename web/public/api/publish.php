<?php
/**
 * POST /api/publish.php   (Authorization: Bearer <publish token>; no session)
 * {projects:[index entries],
 *  bundles:[{slug, baseVersion, baseHash, canonical?, reason?, sources?, activity_stream?, html?, htmlVersion?}]}
 *
 * How the agent-side BidForge sync pushes the knowledge base to the site.
 * Canonical guard (per bundle, inside the canonical lock), checked in order:
 *  1. version must be a non-negative integer ≤ 1e6            → 400 invalid_version / version_jump
 *  2. same version + same content (ignoring meta.savedAt/By)   → 200 {unchanged:true}
 *  3. lower version than stored                                → 409 stale_version
 *     equal version, different content                         → 409 version_fork
 *  4. a canonical exists: baseVersion + baseHash must equal the stored version
 *     and sha256(canonical.json) — i.e. what the KB last pulled  → 409 base_mismatch
 *     no canonical yet: baseVersion must be null/absent          → 409 base_mismatch
 *  5. pending_sync.jsonl has un-acked site saves               → 409 unpulled_site_saves
 * Every 409 result carries {conflict:true, currentVersion, currentHash, unpulled:[versions]}.
 * Accepted: canonical.json + snapshot, index version/publishedVersion, the
 * canonical's per-change activity merged, one activity line and one dated
 * changelog.md line (sources as markdown links).
 *
 * live.html rule (F-03): `html` is written only when
 *   (a) the bundle's canonical was accepted or unchanged (htmlVersion, if sent, must equal it), or
 *   (b) the bundle has no canonical and htmlVersion equals the currently stored version.
 * Otherwise the result says {live:false, liveError}. The stored version is
 * recorded in live.json and reported by project.php as liveVersion.
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

// 1) Projects index entries. The KB's status/folder win (C-12); the version never rolls back.
$mutators = [];
$invalid = [];
foreach ((array)($body['projects'] ?? []) as $p) {
    if (!is_array($p) || !bf_valid_slug($p['slug'] ?? null)) {
        $invalid[] = is_array($p) ? ($p['slug'] ?? null) : null;
        continue;
    }
    $incoming = $p;
    unset($incoming['publishedVersion'], $incoming['siteSavedVersion']); // server-owned
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
        // Re-route the folder when the KB changed the status (bid → active) without sending one.
        $route = bf_folder_for($merged['status'], (string)($merged['name'] ?? $incoming['slug']));
        if (!isset($incoming['folder']) && (!is_array($merged['folder'] ?? null) || ($merged['folder']['kind'] ?? '') !== $route['kind'])) {
            $merged['folder'] = $route;
        }
        $merged['updatedAt'] = $merged['updatedAt'] ?? $now;
        return $merged;
    };
}
if ($mutators) {
    bf_index_upsert($mutators);
}

// 2) Per-project bundles.
$results = [];
foreach ((array)($bodyObj->bundles ?? []) as $b) {
    $slug = is_object($b) ? ($b->slug ?? null) : null;
    if (!bf_valid_slug($slug)) {
        $results[] = ['slug' => is_scalar($slug) ? $slug : null, 'ok' => false, 'status' => 400, 'error' => 'invalid_slug'];
        continue;
    }
    $dir = bf_project_dir($slug);
    bf_mkdir($dir);
    $res = ['slug' => $slug, 'ok' => true, 'status' => 200];
    $acceptedVersion = null; // version the html may be stamped with

    if (isset($b->canonical) && is_object($b->canonical)) {
        $canonical = $b->canonical;
        $slugWas = bf_canonical_force_slug($canonical, $slug);
        $hasBaseV = property_exists($b, 'baseVersion');
        $baseVersion = $b->baseVersion ?? null;
        $baseHash = isset($b->baseHash) && is_string($b->baseHash) ? strtolower($b->baseHash) : null;
        $r = bf_with_lock($dir . '/canonical.json', static function () use ($slug, $dir, $canonical, $hasBaseV, $baseVersion, $baseHash) {
            [$inVersion, $verr] = bf_canonical_version_checked($canonical);
            if ($verr !== null) {
                return ['status' => 400, 'error' => $verr];
            }
            if ($inVersion === null) {
                return ['status' => 400, 'error' => 'canonical_missing_version'];
            }
            [$cur, , $curHash, $curVersion] = bf_canonical_load($slug);
            $unpulled = bf_pending_unpulled($slug);
            $conflict = static fn(string $err, string $msg) => ['status' => 409, 'conflict' => true, 'error' => $err, 'message' => $msg,
                'currentVersion' => $curVersion, 'currentHash' => $curHash, 'unpulled' => $unpulled];
            $json = bf_encode_store($canonical);
            $inHash = hash('sha256', $json);
            if ($cur !== null && $curVersion !== null) {
                if ($inVersion === $curVersion && ($inHash === $curHash || bf_canonical_same($canonical, $cur))) {
                    // Identical content is still not a publish while site saves wait to be pulled:
                    // the KB must pull and ack them first (no live.html, no publishedVersion).
                    if ($unpulled) {
                        return $conflict('unpulled_site_saves', 'Site saves not yet pulled into the KB; GET /api/changes.php, merge, ack, then publish');
                    }
                    return ['status' => 200, 'unchanged' => true, 'version' => $curVersion, 'hash' => $curHash, 'unpulled' => $unpulled];
                }
                if ($inVersion < $curVersion) {
                    return $conflict('stale_version', 'Site holds a newer version; pull it first');
                }
                if ($inVersion === $curVersion) {
                    return $conflict('version_fork', 'Same version number, different content');
                }
            }
            if ($cur !== null) {
                $bvOk = (is_int($baseVersion) || (is_string($baseVersion) && ctype_digit($baseVersion))) && (int)$baseVersion === (int)$curVersion;
                if (!$bvOk || $baseHash === null || !hash_equals((string)$curHash, $baseHash)) {
                    return $conflict('base_mismatch', 'baseVersion/baseHash must equal the stored canonical the KB last pulled');
                }
            } elseif ($hasBaseV && $baseVersion !== null) {
                return $conflict('base_mismatch', 'No canonical exists for this slug; baseVersion must be null');
            }
            if ($unpulled) {
                return $conflict('unpulled_site_saves', 'Site saves not yet pulled into the KB; GET /api/changes.php, merge, ack, then publish');
            }
            // Ceiling for jumps (same rule as save.php).
            $max = (int)($curVersion ?? 0);
            foreach (bf_versions_list($slug) as $v) {
                $max = max($max, (int)$v['version']);
            }
            $ceiling = bf_version_ceiling(is_object($cur) ? $cur : null, $canonical, $max);
            if ($inVersion > $ceiling) {
                return ['status' => 400, 'error' => 'version_jump', 'currentVersion' => $curVersion, 'maxVersion' => $ceiling];
            }
            if ($inVersion <= $max && $cur !== null) {
                return $conflict('stale_version', 'A snapshot with this version already exists');
            }
            bf_write_atomic($dir . '/canonical.json', $json);
            $file = bf_version_write($slug, $inVersion, $json, 'kb-sync', 'Published from knowledge base', 'publish');
            return ['status' => 200, 'version' => $inVersion, 'hash' => $inHash, 'file' => $file, 'prev' => $cur];
        });
        if (isset($r['file'])) {
            $ver = (int)$r['version'];
            $prev = $r['prev'];
            unset($r['prev']);
            // Changelog entries new since the stored canonical → reason + sources.
            $known = [];
            foreach ((is_object($prev) && isset($prev->changelog) && is_array($prev->changelog)) ? $prev->changelog : [] as $e) {
                if (is_object($e) && isset($e->id) && is_scalar($e->id)) {
                    $known[(string)$e->id] = true;
                }
            }
            $newEntries = [];
            foreach ((isset($canonical->changelog) && is_array($canonical->changelog)) ? $canonical->changelog : [] as $e) {
                if (is_object($e) && !(isset($e->id) && is_scalar($e->id) && isset($known[(string)$e->id]))) {
                    $newEntries[] = $e;
                }
            }
            $srcRaw = isset($b->sources) && is_array($b->sources) ? $b->sources : [];
            foreach ($newEntries as $e) {
                foreach ((isset($e->sources) && is_array($e->sources)) ? $e->sources : [] as $s) {
                    $srcRaw[] = $s;
                }
            }
            $sources = [];
            $seenSrc = [];
            foreach (bf_sources_clean($srcRaw) as $s) {
                $k = ($s['url'] ?? '') . '|' . ($s['title'] ?? '');
                if (!isset($seenSrc[$k])) {
                    $seenSrc[$k] = true;
                    $sources[] = $s;
                }
                if (count($sources) >= 20) {
                    break;
                }
            }
            $reason = isset($b->reason) && is_string($b->reason) && trim($b->reason) !== '' ? trim($b->reason) : '';
            if ($reason === '' && $newEntries) {
                $bits = [];
                foreach (array_slice($newEntries, -10) as $e) {
                    $bits[] = trim((is_scalar($e->id ?? null) ? $e->id . ' ' : '') . (is_scalar($e->type ?? null) ? $e->type : '')
                        . (is_scalar($e->reason ?? null) && (string)$e->reason !== '' ? ': ' . $e->reason : ''));
                }
                $reason = count($newEntries) . ' change(s): ' . implode('; ', $bits);
            }
            if ($reason === '') {
                $reason = 'Published from knowledge base';
            }
            $reason = mb_substr(preg_replace('/[\x00-\x1f]+/', ' ', $reason) ?? '', 0, 500);
            $file = (string)$r['file'];
            bf_changelog_append($slug, "**v{$ver}** published from knowledge base by kb-sync ([{$file}](versions/{$file})): " . bf_md_escape($reason)
                . ($slugWas !== null ? ' (canonical slug "' . bf_md_escape($slugWas) . '" rewritten to "' . $slug . '")' : ''),
                $sources, bf_canonical_title($canonical, $slug));
            bf_activity_append($slug, [
                'ts' => $now, 'source' => 'schedule', 'kind' => 'event', 'by' => 'kb-sync', 'method' => 'publish',
                'text' => "Schedule v{$ver} published from knowledge base: {$reason}",
                'link' => '/?project=' . $slug, 'sources' => $sources,
            ]);
            $r['activityAdded'] = bf_activity_merge_canonical($slug, $canonical, 'publish');
            $scDate = bf_find_sc_date($canonical);
            bf_index_upsert([$slug => static function (?array $e) use ($slug, $ver, $now, $scDate) {
                $e = $e ?? ['name' => $slug, 'status' => 'active'];
                if (!isset($e['version']) || (int)$e['version'] < $ver) {
                    $e['version'] = $ver;
                    $e['updatedAt'] = $now;
                }
                $e['publishedVersion'] = $ver;   // only publish.php sets this
                $e['publishedAt'] = $now;
                if ($scDate !== null) {
                    $e['scDate'] = $scDate;
                }
                return $e;
            }]);
            unset($r['file']);
            if ($slugWas !== null) {
                $r['slugRewritten'] = true;
                $r['canonicalSlugWas'] = $slugWas;
            }
        }
        if ($r['status'] === 200) {
            $acceptedVersion = (int)$r['version'];
        } else {
            $res['ok'] = false;
        }
        $res = array_merge($res, $r);
    }

    if (isset($b->activity_stream)) {
        $as = json_decode(json_encode($b->activity_stream), true);
        $entries = is_array($as['entries'] ?? null) ? $as['entries'] : (is_array($as) && isset($as[0]) ? $as : []);
        $res['activityAdded'] = ($res['activityAdded'] ?? 0) + bf_activity_merge($slug, $entries);
    }

    if (isset($b->html) && is_string($b->html) && $b->html !== '') {
        $htmlVersion = isset($b->htmlVersion) && is_numeric($b->htmlVersion) ? (int)$b->htmlVersion : null;
        $liveError = null;
        if (isset($b->canonical)) {
            if ($acceptedVersion === null) {
                $liveError = 'canonical_refused';
            } elseif ($htmlVersion !== null && $htmlVersion !== $acceptedVersion) {
                $liveError = 'html_version_mismatch';
            }
            $stamp = $acceptedVersion;
        } else {
            [, , , $storedVersion] = bf_canonical_load($slug);
            if ($storedVersion === null) {
                $liveError = 'no_canonical';
            } elseif ($htmlVersion === null || $htmlVersion !== $storedVersion) {
                $liveError = 'html_version_mismatch';
            }
            $stamp = $storedVersion;
        }
        if ($liveError === null) {
            bf_write_atomic($dir . '/live.html', $b->html);
            bf_write_atomic($dir . '/live.json', json_encode(['version' => $stamp, 'at' => $now]));
            $res['live'] = true;
            $res['liveVersion'] = $stamp;
        } else {
            $res['live'] = false;
            $res['liveError'] = $liveError;
        }
    }
    $results[] = $res;
}

bf_json([
    'ok'       => true,
    'projects' => ['upserted' => count($mutators), 'invalid' => $invalid],
    'results'  => $results,
]);

/** Equal ignoring site-only meta stamps (savedAt/savedBy/savedMethod). */
function bf_canonical_same(object $a, object $b): bool
{
    $strip = static function (object $o): array {
        $x = json_decode(json_encode($o), true);
        unset($x['meta']['savedAt'], $x['meta']['savedBy'], $x['meta']['savedMethod']);
        return $x;
    };
    return $strip($a) == $strip($b);
}
