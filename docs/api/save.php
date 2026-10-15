<?php
/**
 * POST /api/save.php
 * {slug, name?, status?, canonical, baseVersion, baseHash?, reason, sources:[{type,title,url?,date}]}
 *
 * Fork guard: when a canonical exists, baseVersion must equal its version and
 * (if given) baseHash must equal sha256 of the stored canonical.json bytes,
 * else 409 {conflict:true, currentVersion, currentHash}. A new slug requires
 * baseVersion null.
 * Guards: viewer sessions → 403 read_only; a non-integer/absurd canonical
 * version → 400 invalid_version / version_jump (see bf_version_ceiling);
 * canonical.project.slug is forced to the routing slug.
 * A site save is NOT a publish: it records sync.siteSavedVersion and never
 * raises sync.publishedVersion above the KB-published version in the index.
 * On success: canonical.json (atomic), immutable versions/ snapshot,
 * pending_sync.jsonl line (written under the canonical lock), changelog.md line,
 * activity (save line + the canonical's per-change `activity` merged),
 * projects-index upsert. → {ok, slug, version, hash, liveUrl, slugRewritten?, activityAdded}
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
$user = bf_require_user();
bf_require_editor($user);
$cfg = bf_config();
$raw = '';
$body = bf_json_body((int)$cfg['max_save_mb'] * 1048576, $raw);
$slug = bf_require_slug($body['slug'] ?? null);

// Re-decode as objects so empty {} in the canonical survive round-tripping.
$bodyObj = json_decode($raw);
$canonical = $bodyObj->canonical ?? null;
if (!is_object($canonical)) {
    bf_error(400, 'invalid_canonical', 'canonical must be a JSON object');
}
[$inVersion, $verr] = bf_canonical_version_checked($canonical);
if ($verr !== null) {
    bf_error(400, $verr, 'canonical version must be a non-negative integer no larger than ' . BF_MAX_VERSION);
}
$baseVersion = $body['baseVersion'] ?? null;
if ($baseVersion !== null && !is_int($baseVersion) && !(is_string($baseVersion) && ctype_digit($baseVersion))) {
    bf_error(400, 'invalid_base_version', 'baseVersion must be an integer or null');
}
$baseHash = isset($body['baseHash']) && is_string($body['baseHash']) && $body['baseHash'] !== '' ? strtolower($body['baseHash']) : null;
$reasonIn = $body['reason'] ?? '';
$reason = trim(preg_replace('/[\x00-\x1f]+/', ' ', is_string($reasonIn) ? $reasonIn : '') ?? '');
if ($reason === '') {
    $reason = 'Schedule update';
}
$reason = mb_substr($reason, 0, 500);
$status = isset($body['status']) && is_string($body['status']) ? bf_normalize_status($body['status']) : null;
$name = isset($body['name']) && is_string($body['name']) && trim($body['name']) !== '' ? mb_substr(trim($body['name']), 0, 160) : null;
$sources = bf_sources_clean($body['sources'] ?? []);
$by = (string)$user['email'];
$method = (string)($user['method'] ?? 'unknown');
$slugWas = bf_canonical_force_slug($canonical, $slug);

$dir = bf_project_dir($slug);
bf_mkdir($dir);

$result = bf_with_lock($dir . '/canonical.json', static function () use ($slug, $dir, $canonical, $inVersion, $baseVersion, $baseHash, $by, $method, $reason, $sources) {
    [$cur, , $curHash, $curVersion] = bf_canonical_load($slug);
    if ($cur !== null) {
        $stale = $baseVersion === null || (int)$baseVersion !== (int)$curVersion
            || ($baseHash !== null && !hash_equals((string)$curHash, $baseHash));
        if ($stale) {
            return ['conflict' => true, 'currentVersion' => $curVersion, 'currentHash' => $curHash];
        }
    } elseif ($baseVersion !== null) {
        return ['conflict' => true, 'currentVersion' => null, 'currentHash' => null,
            'message' => 'No saved schedule exists for this slug; baseVersion must be null'];
    }
    // Next version: above the current canonical and any existing snapshot.
    $max = (int)($curVersion ?? 0);
    foreach (bf_versions_list($slug) as $v) {
        $max = max($max, (int)$v['version']);
    }
    // The canonical counts one version per logged change, so an incoming version that is
    // already ahead (several edits since the last save) is kept — within the changelog-backed ceiling.
    $ceiling = bf_version_ceiling(is_object($cur) ? $cur : null, $canonical, $max);
    if ($inVersion !== null && $inVersion > $ceiling) {
        return ['jump' => true, 'currentVersion' => $curVersion, 'maxVersion' => $ceiling];
    }
    $version = max($max + 1, (int)($inVersion ?? 0));
    bf_canonical_set_version($canonical, $version);
    if (!isset($canonical->meta) || !is_object($canonical->meta)) {
        $canonical->meta = new stdClass();
    }
    $now = bf_now();
    $canonical->meta->savedAt = $now;
    $canonical->meta->savedBy = $by;
    $canonical->meta->savedMethod = $method;

    // A-07: a site save is not a publish. Record siteSavedVersion; never let the client
    // claim a publishedVersion above the one publish.php recorded in the index.
    $kbPublished = null;
    foreach (bf_index_read() as $e) {
        if ($e['slug'] === $slug && isset($e['publishedVersion']) && is_numeric($e['publishedVersion'])) {
            $kbPublished = (int)$e['publishedVersion'];
        }
    }
    if (!isset($canonical->sync) || !is_object($canonical->sync)) {
        $canonical->sync = new stdClass();
    }
    $sync = $canonical->sync;
    $claimed = isset($sync->publishedVersion) && is_numeric($sync->publishedVersion) ? (int)$sync->publishedVersion : null;
    if ($claimed !== null && ($kbPublished === null || $claimed > $kbPublished)) {
        $sync->publishedVersion = $kbPublished;
        if (isset($sync->lastPublish) && is_object($sync->lastPublish)
            && (!isset($sync->lastPublish->version) || !is_numeric($sync->lastPublish->version) || $kbPublished === null || (int)$sync->lastPublish->version > $kbPublished)) {
            $sync->lastPublish = null;
        }
    }
    $sync->siteSavedVersion = $version;
    $sync->siteSavedAt = $now;

    $json = bf_encode_store($canonical);
    bf_write_atomic($dir . '/canonical.json', $json);
    $hash = hash('sha256', $json);
    $file = bf_version_write($slug, $version, $json, $by, $reason, $method);
    // Queue for the agent-side sync (site → knowledge base) inside the lock, so a
    // concurrent publish always sees this save as un-pulled.
    $pendingLine = json_encode([
        'version' => $version, 'hash' => $hash, 'savedAt' => $now, 'by' => $by, 'method' => $method,
        'reason' => $reason, 'sources' => $sources, 'file' => $file,
    ], BF_JSON_FLAGS) . "\n";
    bf_with_lock(bf_pending_path($slug), static function () use ($slug, $pendingLine) {
        bf_append_line(bf_pending_path($slug), $pendingLine);
    });
    return ['conflict' => false, 'version' => $version, 'hash' => $hash, 'file' => $file, 'now' => $now];
});

if (!empty($result['jump'])) {
    bf_error(400, 'version_jump', 'canonical version is too far ahead of the stored version and its changelog',
        ['currentVersion' => $result['currentVersion'], 'maxVersion' => $result['maxVersion']]);
}
if ($result['conflict']) {
    bf_json(array_merge(['error' => 'conflict', 'message' => 'Schedule changed since it was loaded'], $result), 409);
}
$version = (int)$result['version'];
$hash = (string)$result['hash'];
$file = (string)$result['file'];
$now = (string)$result['now'];

// Changelog (markdown, dated line, linked sources).
bf_changelog_append($slug, "**v{$version}** saved by {$by} via {$method} ([{$file}](versions/{$file})): " . bf_md_escape($reason)
    . ($slugWas !== null ? ' (canonical slug "' . bf_md_escape($slugWas) . '" rewritten to "' . $slug . '")' : ''),
    $sources, $name ?? bf_canonical_title($canonical, $slug));

// Activity stream: the save line + every per-change entry the canonical carries.
bf_activity_append($slug, [
    'ts' => $now, 'source' => 'schedule', 'kind' => 'event', 'by' => $by, 'method' => $method,
    'text' => "Schedule v{$version} saved by {$by} ({$method}): {$reason}",
    'link' => '/?project=' . $slug,
    'sources' => $sources,
]);
$activityAdded = bf_activity_merge_canonical($slug, $canonical, $method);

// Projects index upsert.
$scDate = bf_find_sc_date($canonical);
bf_index_upsert([$slug => static function (?array $e) use ($slug, $name, $status, $version, $now, $scDate, $canonical) {
    $e = $e ?? [];
    $cName = null;
    if (isset($canonical->project) && is_object($canonical->project) && isset($canonical->project->name) && is_string($canonical->project->name)) {
        $cName = $canonical->project->name;
    }
    $e['name'] = $name ?? ($e['name'] ?? $cName ?? $slug);
    $prev = isset($e['status']) ? bf_normalize_status($e['status']) : null;
    $new = $status ?? ($prev ?? 'bid');
    // C-12: a stale tab never flips an awarded (active) project back to bid.
    if ($prev === 'active' && $new === 'bid') {
        $new = 'active';
    }
    $e['status'] = $new;
    $e['version'] = $version;
    $e['siteSavedVersion'] = $version;
    $e['updatedAt'] = $now;
    if ($scDate !== null) {
        $e['scDate'] = $scDate;
    }
    $route = bf_folder_for($e['status'], $e['name']);
    // Keep a KB-supplied folder path when it already routes to the right kind.
    if (!is_array($e['folder'] ?? null) || ($e['folder']['kind'] ?? '') !== $route['kind'] || empty($e['folder']['path'])) {
        $e['folder'] = $route;
    }
    if (isset($canonical->links) && is_object($canonical->links) && isset($canonical->links->hostUrl) && is_string($canonical->links->hostUrl)) {
        $e['hostUrl'] = $canonical->links->hostUrl;
    } elseif (isset($canonical->project) && is_object($canonical->project) && isset($canonical->project->hostUrl) && is_string($canonical->project->hostUrl)) {
        $e['hostUrl'] = $canonical->project->hostUrl;
    }
    return $e;
}]);

$out = ['ok' => true, 'slug' => $slug, 'version' => $version, 'hash' => $hash, 'liveUrl' => '/?project=' . $slug, 'activityAdded' => $activityAdded];
if ($slugWas !== null) {
    $out['slugRewritten'] = true;
    $out['canonicalSlugWas'] = $slugWas;
}
bf_json($out);
