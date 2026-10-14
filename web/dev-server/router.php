<?php
/**
 * Router for `php -S` (NOT deployed) — roughly emulates web/public/.htaccess:
 * denies private files under /api, never SPA-rewrites /api or /auth, and
 * falls back to index.html for other unknown paths.
 *
 *   php -S 127.0.0.1:8099 -t web/public web/dev-server/router.php
 */
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$root = $_SERVER['DOCUMENT_ROOT'];

if (preg_match('#(^|/)\.(?!well-known/)#', $path)
    || preg_match('#^/api/(data|dev)(/|$)#', $path)
    || preg_match('#^/api/.+\.(json|jsonl|md|lock|log)$#', $path)
    || preg_match('#^/api/(_[^/]*|config[^/]*)\.php$#', $path)
    || preg_match('#bidforge-(data|config)#', $path)) {
    http_response_code(403);
    echo "Forbidden\n";
    return true;
}
if (preg_match('#^/(api|auth)(/|$)#', $path)) {
    if (is_file($root . $path)) {
        return false; // let the built-in server execute the PHP file
    }
    http_response_code(404);
    echo "Not Found\n";
    return true;
}
if ($path !== '/' && is_file($root . $path)) {
    return false;
}
if (is_file($root . '/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/index.html');
} else {
    echo "SPA index.html not built (run npm run build and serve web/dist)\n";
}
return true;
