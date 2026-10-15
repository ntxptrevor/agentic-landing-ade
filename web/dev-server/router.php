<?php
/**
 * Router for `php -S` (NOT deployed) — emulates web/public/.htaccess:
 * denies private files under /api, never SPA-rewrites /api or /auth, falls
 * back to index.html for other unknown paths, and sends the same response
 * headers (CSP, nosniff, frame/referrer policy, .mjs MIME, cache rules).
 * PHP endpoints are executed by require (so these headers reach them; an
 * endpoint's own header() — e.g. live.php's CSP — replaces the site one here,
 * whereas Apache would send both and the browser would enforce both).
 *
 *   php -S 127.0.0.1:8099 -t web/public web/dev-server/router.php
 */
const BF_SITE_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    . "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; "
    . "object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com";

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$root = $_SERVER['DOCUMENT_ROOT'];

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: SAMEORIGIN');
header('Content-Security-Policy: ' . BF_SITE_CSP);

if (preg_match('#(^|/)\.(?!well-known/)#', $path)
    || preg_match('#^/api/(data|dev)(/|$)#', $path)
    || preg_match('#^/api/.+\.(json|jsonl|md|lock|log|gz)$#', $path)
    || preg_match('#^/api/(_[^/]*|config[^/]*)\.php$#', $path)
    || preg_match('#bidforge-(data|config)#', $path)
    || preg_match('#\.(ini|log|sh|sql|bak|lock|dist|jsonl)$#', $path)) {
    http_response_code(403);
    echo "Forbidden\n";
    return true;
}
if (preg_match('#^/(api|auth)(/|$)#', $path)) {
    if (preg_match('#\.php$#', $path) && is_file($root . $path)) {
        chdir(dirname($root . $path));
        require $root . $path;
        return true;
    }
    http_response_code(404);
    echo "Not Found\n";
    return true;
}

$types = ['js' => 'text/javascript', 'mjs' => 'text/javascript', 'css' => 'text/css', 'html' => 'text/html; charset=utf-8',
    'png' => 'image/png', 'svg' => 'image/svg+xml', 'json' => 'application/json', 'woff2' => 'font/woff2', 'ico' => 'image/x-icon'];
$serve = static function (string $file) use ($types): void {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
    if (preg_match('#-[A-Za-z0-9_-]{8}\.(js|mjs|css|woff2?)$#', $file)) {
        header('Cache-Control: public, max-age=31536000, immutable');
    } elseif (basename($file) === 'index.html') {
        header('Cache-Control: no-cache');
    }
    header('Content-Length: ' . filesize($file));
    readfile($file);
};
if ($path !== '/' && is_file($root . $path)) {
    $serve($root . $path);
    return true;
}
if (is_file($root . '/index.html')) {
    $serve($root . '/index.html');
} else {
    echo "SPA index.html not built (run npm run build and serve web/dist)\n";
}
return true;
