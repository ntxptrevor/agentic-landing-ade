<?php
/** GET /api/live.php?slug=… — the generated live canonical schedule HTML. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET');
bf_require_user();
$slug = bf_require_slug($_GET['slug'] ?? null);
$path = bf_project_dir($slug) . '/live.html';
if (!is_file($path)) {
    bf_error(404, 'not_found', 'No live schedule for this project');
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($path));
readfile($path);
