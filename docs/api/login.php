<?php
/**
 * POST /api/login.php {passphrase, name?} — passphrase login (the alternative to Google).
 *
 * Limits (all atomic, under flock):
 *  - per client IP: login_max_attempts per login_window_sec (the attempt is
 *    recorded BEFORE the hash check, cleared on success) → 429 rate_limited;
 *  - global: login_global_max_failures failures across all IPs per window →
 *    passphrase login locked for login_global_lockout_sec → 429 passphrase_locked.
 *    Google sign-in is unaffected.
 * Sessions get role 'editor' or 'viewer' from config passphrase_role.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

bf_require_csrf();
$cfg = bf_config();
if (!bf_passphrase_configured($cfg)) {
    bf_error(403, 'passphrase_disabled', 'Passphrase login is not configured');
}
$max = (int)$cfg['login_max_attempts'];
$window = (int)$cfg['login_window_sec'];
if (($wait = bf_rl_locked('passphrase')) > 0) {
    bf_error(429, 'passphrase_locked', 'Passphrase login is temporarily locked after too many failures; use Google sign-in or try later',
        ['retryAfter' => $wait], ['Retry-After: ' . $wait]);
}
if (($wait = bf_rl_take('login', $max, $window)) > 0) {
    bf_error(429, 'rate_limited', 'Too many login attempts; try again later', ['retryAfter' => $wait], ['Retry-After: ' . $wait]);
}
$body = bf_json_body(65536);
$pass = $body['passphrase'] ?? '';
$pass = is_string($pass) && strlen($pass) <= 1024 ? $pass : '';
// password_verify is constant-time; it always runs (also for empty input) so timing reveals nothing.
$ok = password_verify($pass, (string)$cfg['passphrase_hash']) && $pass !== '';
if (!$ok) {
    $n = bf_rl_hit('login-global', $window, 'global');
    if ($n >= (int)$cfg['login_global_max_failures']) {
        bf_rl_lock('passphrase', (int)$cfg['login_global_lockout_sec']);
        bf_rl_clear('login-global', 'global');
        error_log('[bidforge] passphrase login locked globally after ' . $n . ' failures');
    }
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
error_log('[bidforge] passphrase login from ' . bf_client_ip() . ' as role ' . $cfg['passphrase_role']);
bf_json(bf_session_payload());
