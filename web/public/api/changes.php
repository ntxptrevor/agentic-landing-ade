<?php
/**
 * Agent-side sync of site saves back into the knowledge base (Bearer token).
 *
 *   GET  /api/changes.php?since=<ISO>[&project=<slug>]
 *        → {changes:[{slug, version, hash, savedAt, by, method, reason, sources, file,
 *                     canonicalUrl:"/api/changes.php?slug=<slug>&version=<n>"}], now}
 *        Un-acknowledged pending_sync entries saved after `since` (omit for all),
 *        oldest first. `project` limits the list to one slug.
 *   GET  /api/changes.php?slug=<slug>&version=<n>
 *        → the immutable snapshot JSON (gzipped snapshots are served decompressed).
 *   POST /api/changes.php {ack:[{slug, version}]} → {ok, acked}
 *        Marks entries as pulled. publish.php refuses a slug while it has un-acked entries.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET', 'POST');
bf_require_publish_token();
$projectsDir = bf_data_dir() . '/projects';

if (bf_method() === 'GET') {
    if (isset($_GET['slug'], $_GET['version'])) {
        $slug = bf_require_slug($_GET['slug']);
        if (!is_string($_GET['version']) || !ctype_digit($_GET['version'])) {
            bf_error(400, 'invalid_version', 'version must be an integer');
        }
        $json = bf_version_read($slug, (int)$_GET['version']);
        if ($json === null) {
            bf_error(404, 'not_found', 'Version not found');
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo $json;
        exit;
    }
    $since = null;
    if (isset($_GET['since']) && $_GET['since'] !== '') {
        $since = is_string($_GET['since']) ? strtotime($_GET['since']) : false;
        if ($since === false) {
            bf_error(400, 'invalid_since', 'since must be an ISO-8601 timestamp');
        }
    }
    $only = null;
    if (isset($_GET['project']) && $_GET['project'] !== '') {
        $only = bf_require_slug($_GET['project']);
    }
    $changes = [];
    foreach (is_dir($projectsDir) ? (scandir($projectsDir) ?: []) : [] as $slug) {
        if (!bf_valid_slug($slug) || ($only !== null && $slug !== $only)) {
            continue;
        }
        foreach (bf_pending_read(bf_pending_path($slug)) as $e) {
            if (!empty($e['pulledAt'])) {
                continue;
            }
            $t = strtotime((string)($e['savedAt'] ?? '')) ?: 0;
            if ($since !== null && $t <= $since) {
                continue;
            }
            $v = (int)($e['version'] ?? 0);
            $changes[] = [
                'slug'         => $slug,
                'version'      => $v,
                'hash'         => $e['hash'] ?? null,
                'savedAt'      => $e['savedAt'] ?? null,
                'by'           => $e['by'] ?? null,
                'method'       => $e['method'] ?? null,
                'reason'       => $e['reason'] ?? null,
                'sources'      => is_array($e['sources'] ?? null) ? $e['sources'] : [],
                'file'         => $e['file'] ?? null,
                'canonicalUrl' => '/api/changes.php?slug=' . rawurlencode($slug) . '&version=' . $v,
            ];
        }
    }
    usort($changes, static fn($a, $b) => strcmp((string)$a['savedAt'], (string)$b['savedAt']) ?: ($a['version'] <=> $b['version']));
    bf_json(['changes' => $changes, 'now' => bf_now()]);
}

// POST: acknowledge pulled changes.
$body = bf_json_body(1048576);
$acks = is_array($body['ack'] ?? null) ? $body['ack'] : [];
$bySlug = [];
foreach ($acks as $a) {
    if (is_array($a) && bf_valid_slug($a['slug'] ?? null) && isset($a['version']) && is_numeric($a['version'])) {
        $bySlug[$a['slug']][(int)$a['version']] = true;
    }
}
$acked = 0;
$now = bf_now();
foreach ($bySlug as $slug => $versions) {
    $path = bf_pending_path($slug);
    if (!is_file($path)) {
        continue;
    }
    bf_with_lock($path, static function () use ($path, $versions, $now, &$acked) {
        $lines = [];
        foreach (bf_pending_read($path) as $e) {
            if (empty($e['pulledAt']) && isset($versions[(int)($e['version'] ?? -1)])) {
                $e['pulledAt'] = $now;
                $acked++;
            }
            $lines[] = json_encode($e, BF_JSON_FLAGS);
        }
        bf_write_atomic($path, implode("\n", $lines) . "\n");
    });
}
bf_json(['ok' => true, 'acked' => $acked]);
