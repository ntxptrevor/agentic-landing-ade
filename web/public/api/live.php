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
// Agent-published HTML is untrusted content on the app origin: no scripts, no
// same-origin rights (sandbox), only inline/Google-Fonts styles and data:/https images.
const BF_LIVE_CSP = "default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; "
    . "font-src https://fonts.gstatic.com; frame-ancestors 'self'; sandbox";
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Security-Policy: ' . BF_LIVE_CSP);
header('Referrer-Policy: no-referrer');
header('Content-Length: ' . filesize($path));
readfile($path);
