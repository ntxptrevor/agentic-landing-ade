<?php
/** POST /api/login.php {passphrase, name?} — passphrase login (rate-limited per IP). */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
$cfg = bf_config();
if (!bf_passphrase_configured($cfg)) {
    bf_error(403, 'passphrase_disabled', 'Passphrase login is not configured');
}
$max = (int)$cfg['login_max_attempts'];
$window = (int)$cfg['login_window_sec'];
if (($wait = bf_rl_blocked('login', $max, $window)) > 0) {
    bf_error(429, 'rate_limited', 'Too many login attempts; try again later', ['retryAfter' => $wait], ['Retry-After: ' . $wait]);
}
$body = bf_json_body(65536);
$pass = $body['passphrase'] ?? '';
if (!is_string($pass) || $pass === '' || strlen($pass) > 1024 || !password_verify($pass, (string)$cfg['passphrase_hash'])) {
    bf_rl_hit('login', $window);
    usleep(250000);
    bf_error(401, 'invalid_passphrase', 'Incorrect passphrase');
}
bf_rl_clear('login');
$pu = is_array($cfg['passphrase_user']) ? $cfg['passphrase_user'] : [];
$name = isset($body['name']) && is_string($body['name']) ? trim(preg_replace('/[\x00-\x1f<>]/', '', $body['name']) ?? '') : '';
bf_login([
    'email'  => (string)($pu['email'] ?? 'team@ntxpllc.com'),
    'name'   => $name !== '' ? mb_substr($name, 0, 80) : (string)($pu['name'] ?? 'NTXP Team'),
    'method' => 'passphrase',
]);
bf_json(bf_session_payload());
