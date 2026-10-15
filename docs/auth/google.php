<?php
/** GET /auth/google.php[?next=/path] — start Google OIDC login (domain-locked). */
declare(strict_types=1);
require __DIR__ . '/../api/_lib.php';

$cfg = bf_config();
if (!bf_google_configured($cfg) || trim((string)$cfg['google_redirect_uri']) === '') {
    bf_redirect('/?auth_error=' . bf_auth_error_code('google_not_configured')); // → "config"
}
bf_session_start();
$state = bin2hex(random_bytes(24));
$nonce = bin2hex(random_bytes(24));
$_SESSION['oauth'] = [
    'state' => $state,
    'nonce' => $nonce,
    'at'    => time(),
    'next'  => bf_safe_next($_GET['next'] ?? '/'),
];
bf_redirect(bf_google_auth_url($cfg, $state, $nonce));
