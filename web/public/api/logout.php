<?php
/** POST /api/logout.php — end the session. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
bf_session_start();
$_SESSION = [];
$p = session_get_cookie_params();
setcookie(session_name(), '', [
    'expires' => time() - 3600, 'path' => $p['path'], 'domain' => $p['domain'],
    'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax',
]);
session_destroy();
bf_json(['ok' => true]);
