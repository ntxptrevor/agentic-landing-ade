<?php
/**
 * POST /api/save.php
 * {slug, name?, status?, canonical, baseVersion, baseHash?, reason, sources:[{type,title,url?,date}]}
 *
 * Fork guard: when a canonical exists, baseVersion must equal its version and
 * (if given) baseHash must equal sha256 of the stored canonical.json bytes,
 * else 409 {conflict:true, currentVersion, currentHash}. A new slug requires
 * baseVersion null. On success: canonical.json (atomic), immutable versions/
 * snapshot, changelog.md line, activity entry, projects-index upsert, and a
 * pending_sync.jsonl line for the agent-side knowledge-base sync.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
$user = bf_require_user();
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
$baseVersion = $body['baseVersion'] ?? null;
if ($baseVersion !== null && !is_numeric($baseVersion)) {
    bf_error(400, 'invalid_base_version', 'baseVersion must be an integer or null');
}
$baseHash = isset($body['baseHash']) && is_string($body['baseHash']) && $body['baseHash'] !== '' ? strtolower($body['baseHash']) : null;
$reason = trim(preg_replace('/[\x00-\x1f]+/', ' ', (string)($body['reason'] ?? '')) ?? '');
if ($reason === '') {
    $reason = 'Schedule update';
}
$reason = mb_substr($reason, 0, 500);
$status = isset($body['status']) ? bf_normalize_status($body['status']) : null;
$name = isset($body['name']) && is_string($body['name']) && trim($body['name']) !== '' ? mb_substr(trim($body['name']), 0, 160) : null;
$sources = is_array($body['sources'] ?? null) ? array_slice(array_values(array_filter($body['sources'], 'is_array')), 0, 50) : [];
$by = (string)$user['email'];

$dir = bf_project_dir($slug);
bf_mkdir($dir);

$result = bf_with_lock($dir . '/canonical.json', static function () use ($slug, $dir, $canonical, $baseVersion, $baseHash, $by) {
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
    // already ahead (several edits since the last save) is kept; it never goes backwards.
    $version = max($max + 1, (int)(bf_canonical_version($canonical) ?? 0));
    bf_canonical_set_version($canonical, $version);
    if (!isset($canonical->meta) || !is_object($canonical->meta)) {
        $canonical->meta = new stdClass();
    }
    $canonical->meta->savedAt = bf_now();
    $canonical->meta->savedBy = $by;
    $json = bf_encode_store($canonical);
    bf_write_atomic($dir . '/canonical.json', $json);
    return ['conflict' => false, 'version' => $version, 'hash' => hash('sha256', $json), 'json' => $json];
});

if ($result['conflict']) {
    unset($result['json']);
    bf_json(array_merge(['error' => 'conflict', 'message' => 'Schedule changed since it was loaded'], $result), 409);
}
$version = (int)$result['version'];
$hash = (string)$result['hash'];
$now = bf_now();
$file = bf_version_write($slug, $version, $result['json'], $by, $reason);

// Changelog (markdown, dated line, linked sources).
$mdEsc = static fn(string $s) => str_replace(['[', ']', "\n", "\r"], ['\\[', '\\]', ' ', ' '], $s);
$srcParts = [];
foreach ($sources as $s) {
    $title = $mdEsc(mb_substr(trim((string)($s['title'] ?? $s['type'] ?? 'source')), 0, 200));
    $url = (string)($s['url'] ?? '');
    $label = (isset($s['type']) ? $mdEsc((string)$s['type']) . ': ' : '');
    $date = isset($s['date']) ? ' (' . $mdEsc((string)$s['date']) . ')' : '';
    $safeUrl = preg_match('#^(https?://|/)[^\s()<>]*$#i', $url) ? $url : '';
    $srcParts[] = $safeUrl !== '' ? "{$label}[{$title}]({$safeUrl}){$date}" : "{$label}{$title}{$date}";
}
$clPath = $dir . '/changelog.md';
$line = '- ' . gmdate('Y-m-d') . " — **v{$version}** saved by {$by} ([{$file}](versions/{$file})): " . $mdEsc($reason)
    . ($srcParts ? ' — Sources: ' . implode('; ', $srcParts) : '') . "\n";
if (!is_file($clPath)) {
    $title = $name ?? ((isset($canonical->project->name) && is_string($canonical->project->name)) ? $canonical->project->name : $slug);
    $line = '# ' . $mdEsc($title) . " — Schedule Changelog\n\n" . $line;
}
bf_append_line($clPath, $line);

// Activity stream.
bf_activity_append($slug, [
    'ts' => $now, 'source' => 'schedule', 'kind' => 'event',
    'text' => "Schedule v{$version} saved by {$by}: {$reason}",
    'link' => '/?project=' . $slug,
]);

// Projects index upsert.
$scDate = bf_find_sc_date($canonical);
bf_index_upsert([$slug => static function (?array $e) use ($slug, $name, $status, $version, $now, $scDate, $canonical) {
    $e = $e ?? [];
    $cName = null;
    if (isset($canonical->project) && is_object($canonical->project) && isset($canonical->project->name) && is_string($canonical->project->name)) {
        $cName = $canonical->project->name;
    }
    $e['name'] = $name ?? ($e['name'] ?? $cName ?? $slug);
    $e['status'] = $status ?? bf_normalize_status($e['status'] ?? 'bid');
    $e['version'] = $version;
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

// Queue for the agent-side sync (site → knowledge base).
$pendingLine = json_encode([
    'version' => $version, 'hash' => $hash, 'savedAt' => $now, 'by' => $by, 'reason' => $reason, 'file' => $file,
], BF_JSON_FLAGS) . "\n";
bf_with_lock($dir . '/pending_sync.jsonl', static function () use ($dir, $pendingLine) {
    bf_append_line($dir . '/pending_sync.jsonl', $pendingLine);
});

bf_json(['ok' => true, 'version' => $version, 'hash' => $hash, 'liveUrl' => '/?project=' . $slug]);
