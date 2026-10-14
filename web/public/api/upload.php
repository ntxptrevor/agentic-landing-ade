<?php
/**
 * POST /api/upload.php (multipart/form-data: slug, kind, files[])
 * Stores files under <data>/projects/<slug>/uploads/<YYYY-MM-DD>/<id>-<name>.<ext>
 * and records them in uploads.json. Returns {ok, uploads:[records], rejected:[…]}.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
$user = bf_require_user();
$cfg = bf_config();
$maxBytes = (int)$cfg['max_upload_mb'] * 1048576;

if (empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    bf_error(413, 'payload_too_large', 'Upload exceeds the server post_max_size');
}
$slug = bf_require_slug($_POST['slug'] ?? null);
$kind = (string)($_POST['kind'] ?? '');
if (!in_array($kind, BF_UPLOAD_KINDS, true)) {
    bf_error(400, 'invalid_kind', 'kind must be one of ' . implode(', ', BF_UPLOAD_KINDS));
}
$f = $_FILES['files'] ?? null;
if (!is_array($f) || !isset($f['name'])) {
    bf_error(400, 'no_files', 'Send files[] in multipart/form-data');
}
// Normalize single/multiple file shapes.
$files = [];
if (is_array($f['name'])) {
    foreach ($f['name'] as $i => $n) {
        $files[] = ['name' => $n, 'tmp' => $f['tmp_name'][$i], 'size' => $f['size'][$i], 'error' => $f['error'][$i]];
    }
} else {
    $files[] = ['name' => $f['name'], 'tmp' => $f['tmp_name'], 'size' => $f['size'], 'error' => $f['error']];
}
if (count($files) > 50) {
    bf_error(400, 'too_many_files', 'Max 50 files per request');
}

$dir = bf_project_dir($slug);
$day = gmdate('Y-m-d');
$destDir = $dir . '/uploads/' . $day;
if (!bf_mkdir($destDir)) {
    bf_error(500, 'storage_error', 'Cannot create upload directory');
}
$finfo = class_exists('finfo') ? new finfo(FILEINFO_MIME_TYPE) : null;
$records = [];
$rejected = [];
foreach ($files as $file) {
    $orig = (string)$file['name'];
    $display = mb_substr(trim(preg_replace('/[\x00-\x1f\/\\\\]+/', '_', basename(str_replace('\\', '/', $orig))) ?? ''), 0, 200);
    if ((int)$file['error'] !== UPLOAD_ERR_OK) {
        $rejected[] = ['name' => $display, 'error' => in_array((int)$file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'too_large' : 'upload_error'];
        continue;
    }
    $ext = strtolower(pathinfo($display, PATHINFO_EXTENSION));
    if (!in_array($ext, BF_UPLOAD_EXTS, true)) {
        $rejected[] = ['name' => $display, 'error' => 'extension_not_allowed'];
        continue;
    }
    if ((int)$file['size'] > $maxBytes || (int)$file['size'] <= 0) {
        $rejected[] = ['name' => $display, 'error' => (int)$file['size'] <= 0 ? 'empty' : 'too_large'];
        continue;
    }
    if (!is_uploaded_file((string)$file['tmp'])) {
        $rejected[] = ['name' => $display, 'error' => 'upload_error'];
        continue;
    }
    // Sanitized unique name: only [A-Za-z0-9_-] in the stem (no inner dots), allowlisted extension.
    $stem = pathinfo($display, PATHINFO_FILENAME);
    $stem = trim(preg_replace('/[^A-Za-z0-9_-]+/', '_', $stem) ?? '', '_-');
    $stem = substr($stem !== '' ? $stem : 'file', 0, 80);
    $id = bin2hex(random_bytes(8));
    $stored = $id . '-' . $stem . '.' . $ext;
    if (!move_uploaded_file((string)$file['tmp'], $destDir . '/' . $stored)) {
        $rejected[] = ['name' => $display, 'error' => 'storage_error'];
        continue;
    }
    @chmod($destDir . '/' . $stored, 0640);
    $mime = $finfo ? ($finfo->file($destDir . '/' . $stored) ?: 'application/octet-stream') : 'application/octet-stream';
    $records[] = [
        'id'      => $id,
        'kind'    => $kind,
        'name'    => $display,
        'size'    => (int)$file['size'],
        'mime'    => $mime,
        'savedAt' => bf_now(),
        'by'      => (string)$user['email'],
        'path'    => 'uploads/' . $day . '/' . $stored,
        'url'     => '/api/file.php?slug=' . rawurlencode($slug) . '&id=' . $id,
    ];
}

if ($records) {
    bf_with_lock($dir . '/uploads.json', static function () use ($dir, $records) {
        $all = bf_read_json($dir . '/uploads.json', []);
        $all = is_array($all) ? array_values($all) : [];
        bf_write_atomic($dir . '/uploads.json', bf_encode_store(array_merge($all, $records)));
    });
    $names = array_map(static fn($r) => $r['name'], $records);
    $n = count($records);
    bf_activity_append($slug, [
        'ts' => bf_now(), 'source' => 'schedule', 'kind' => 'upload',
        'text' => $n . ' file' . ($n === 1 ? '' : 's') . " uploaded ({$kind}) by {$user['email']}: " . mb_substr(implode(', ', $names), 0, 400),
        'link' => $n === 1 ? $records[0]['url'] : '/?project=' . $slug,
    ]);
}

$status = $records ? 200 : 400;
bf_json(['ok' => (bool)$records, 'uploads' => $records, 'rejected' => $rejected], $status);
