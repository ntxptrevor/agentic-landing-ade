<?php
/**
 * Agent-side sync of site saves back into the knowledge base (Bearer token).
 *   GET  /api/changes.php?since=<ISO>        → {changes:[{slug, version, hash, savedAt, by, reason, file}]}
 *        (un-acknowledged pending_sync entries newer than `since`; omit since for all)
 *   POST /api/changes.php {ack:[{slug,version}]} → {ok, acked}
 *   Fetch a version's JSON with GET ?slug=&version= → the immutable snapshot.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET', 'POST');
bf_require_publish_token();
$projectsDir = bf_data_dir() . '/projects';

/** @return array<int,array> pending entries of a project (each with line index). */
function bf_pending_read(string $path): array
{
    $out = [];
    if (!is_file($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $e = json_decode($line, true);
        if (is_array($e)) {
            $out[] = $e;
        }
    }
    return $out;
}

if (bf_method() === 'GET') {
    if (isset($_GET['slug'], $_GET['version'])) {
        $slug = bf_require_slug($_GET['slug']);
        $ver = (int)$_GET['version'];
        foreach (bf_versions_list($slug) as $v) {
            if ($v['version'] === $ver) {
                header('Content-Type: application/json; charset=utf-8');
                header('Cache-Control: no-store');
                readfile(bf_project_dir($slug) . '/versions/' . $v['file']);
                exit;
            }
        }
        bf_error(404, 'not_found', 'Version not found');
    }
    $since = null;
    if (isset($_GET['since']) && $_GET['since'] !== '') {
        $since = strtotime((string)$_GET['since']);
        if ($since === false) {
            bf_error(400, 'invalid_since', 'since must be an ISO-8601 timestamp');
        }
    }
    $changes = [];
    foreach (is_dir($projectsDir) ? (scandir($projectsDir) ?: []) : [] as $slug) {
        if (!bf_valid_slug($slug)) {
            continue;
        }
        foreach (bf_pending_read("$projectsDir/$slug/pending_sync.jsonl") as $e) {
            if (!empty($e['pulledAt'])) {
                continue;
            }
            $t = strtotime((string)($e['savedAt'] ?? '')) ?: 0;
            if ($since !== null && $t <= $since) {
                continue;
            }
            $changes[] = ['slug' => $slug] + $e;
        }
    }
    usort($changes, static fn($a, $b) => strcmp((string)$a['savedAt'], (string)$b['savedAt']));
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
    $path = bf_project_dir($slug) . '/pending_sync.jsonl';
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
