<?php
/**
 * GET /auth/callback.php — Google OAuth redirect target.
 * Validates state, exchanges the code, verifies the ID token via Google's
 * tokeninfo endpoint (POST body, never a URL query) — aud, iss, exp,
 * email_verified, domain + hd, nonce — creates the session, then redirects to
 * "/" (or the saved next path).
 * Failures → "/?auth_error=<code>", code ∈ BF_AUTH_ERRORS:
 *   bad_state, access_denied, domain, token, config, nonce, unverified.
 */
declare(strict_types=1);
require __DIR__ . '/../api/_lib.php';

$fail = static function (string $internal): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        unset($_SESSION['oauth']);
    }
    if (!in_array($internal, ['bad_state', 'access_denied'], true)) {
        error_log('[bidforge] google login failed: ' . $internal);
    }
    bf_redirect('/?auth_error=' . rawurlencode(bf_auth_error_code($internal)));
};

$cfg = bf_config();
if (!bf_google_configured($cfg)) {
    $fail('google_not_configured');
}
bf_session_start();
$oauth = $_SESSION['oauth'] ?? null;
if (isset($_GET['error'])) {
    $fail((string)$_GET['error'] === 'access_denied' ? 'access_denied' : 'oauth_error');
}
$state = (string)($_GET['state'] ?? '');
if (!is_array($oauth) || $state === '' || !hash_equals((string)$oauth['state'], $state)) {
    $fail('bad_state');
}
if (time() - (int)$oauth['at'] > 600) {
    $fail('state_expired');
}
$code = (string)($_GET['code'] ?? '');
if ($code === '') {
    $fail('no_code');
}

[$st, $body] = bf_http('POST', 'https://oauth2.googleapis.com/token', [
    'code'          => $code,
    'client_id'     => $cfg['google_client_id'],
    'client_secret' => $cfg['google_client_secret'],
    'redirect_uri'  => $cfg['google_redirect_uri'],
    'grant_type'    => 'authorization_code',
]);
$tok = json_decode($body, true);
if ($st !== 200 || !is_array($tok) || empty($tok['id_token'])) {
    $fail('token_exchange_failed');
}

// ID token goes in the POST body so it never lands in proxy/access logs as a URL query.
[$st2, $body2] = bf_http('POST', 'https://oauth2.googleapis.com/tokeninfo', ['id_token' => (string)$tok['id_token']]);
$claims = json_decode($body2, true);
if ($st2 !== 200 || !is_array($claims)) {
    $fail('token_invalid');
}
$err = bf_validate_google_claims($claims, $cfg, (string)($oauth['nonce'] ?? ''));
if ($err !== null) {
    $fail($err);
}

$next = bf_safe_next($oauth['next'] ?? '/');
unset($_SESSION['oauth']);
bf_login([
    'email'  => strtolower((string)$claims['email']),
    'name'   => (string)($claims['name'] ?? $claims['email']),
    'method' => 'google',
]);
bf_redirect($next);
