<?php
/** GET /api/file.php?slug=&id= — stream a stored upload (auth required). */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_method('GET');
bf_require_user();
$slug = bf_require_slug($_GET['slug'] ?? null);
$id = (string)($_GET['id'] ?? '');
if (!preg_match('/^[a-f0-9]{16}$/', $id)) {
    bf_error(400, 'invalid_id', 'Invalid file id');
}
$dir = bf_project_dir($slug);
$rec = null;
foreach ((array)bf_read_json($dir . '/uploads.json', []) as $r) {
    if (is_array($r) && ($r['id'] ?? '') === $id) {
        $rec = $r;
    }
}
if ($rec === null) {
    bf_error(404, 'not_found', 'File not found');
}
// No path traversal: the resolved file must live inside this project's uploads dir.
$base = realpath($dir . '/uploads');
$path = realpath($dir . '/' . (string)$rec['path']);
if ($base === false || $path === false || !str_starts_with($path, $base . DIRECTORY_SEPARATOR) || !is_file($path)) {
    bf_error(404, 'not_found', 'File not found');
}

$mime = (string)($rec['mime'] ?? 'application/octet-stream');
$inlineTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff', 'image/heic'];
$inline = in_array($mime, $inlineTypes, true);
if (!$inline && preg_match('#(html|javascript|svg|xml)#i', $mime) && !in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['xml'], true)) {
    $mime = 'application/octet-stream';
}
if (strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'xml') {
    $mime = 'application/xml';
}
$name = (string)($rec['name'] ?? basename($path));
$ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) ?: 'download';

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));
header('X-Content-Type-Options: nosniff');
if ($mime !== 'application/pdf') { // Chrome's PDF viewer refuses to render under a sandbox CSP
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
}
header('Cache-Control: private, no-store');
readfile($path);
