<?php
/**
 * CLI unit tests for the Google OIDC helpers (NOT deployed).
 *   php web/dev-server/test-google.php
 */
declare(strict_types=1);
require __DIR__ . '/../public/api/_lib.php';

$pass = 0;
$fail = 0;
function check(string $label, bool $ok): void
{
    global $pass, $fail;
    $ok ? $pass++ : $fail++;
    echo ($ok ? 'PASS ' : 'FAIL ') . $label . "\n";
}

$cfg = ['google_client_id' => 'cid.apps.googleusercontent.com', 'google_client_secret' => 's',
    'google_redirect_uri' => 'https://schedule.ntxpllc.com/auth/callback.php', 'allowed_domains' => ['ntxpllc.com']];

// Redirect URL building
$url = bf_google_auth_url($cfg, 'STATE123', 'NONCE456');
$p = parse_url($url);
parse_str($p['query'] ?? '', $q);
check('auth url host is accounts.google.com', ($p['host'] ?? '') === 'accounts.google.com' && ($p['scheme'] ?? '') === 'https');
check('auth url has state', ($q['state'] ?? '') === 'STATE123');
check('auth url has nonce', ($q['nonce'] ?? '') === 'NONCE456');
check('auth url has hd=ntxpllc.com', ($q['hd'] ?? '') === 'ntxpllc.com');
check('auth url scope "openid email profile"', ($q['scope'] ?? '') === 'openid email profile');
check('auth url prompt=select_account', ($q['prompt'] ?? '') === 'select_account');
check('auth url response_type=code + client_id + redirect_uri', ($q['response_type'] ?? '') === 'code'
    && ($q['client_id'] ?? '') === $cfg['google_client_id'] && ($q['redirect_uri'] ?? '') === $cfg['google_redirect_uri']);

// Claim validation
$now = 1_800_000_000;
$good = ['aud' => 'cid.apps.googleusercontent.com', 'iss' => 'https://accounts.google.com', 'exp' => (string)($now + 600),
    'email' => 'Trevor@NTXPLLC.com', 'email_verified' => 'true', 'hd' => 'ntxpllc.com', 'nonce' => 'NONCE456', 'name' => 'T'];
$cases = [
    'valid claims accepted'                  => [$good, null],
    'iss without scheme accepted'            => [['iss' => 'accounts.google.com'] + $good, null],
    'email_verified bool true accepted'      => [['email_verified' => true] + $good, null],
    'wrong audience rejected'                => [['aud' => 'other.apps.googleusercontent.com'] + $good, 'bad_audience'],
    'wrong issuer rejected'                  => [['iss' => 'https://evil.example'] + $good, 'bad_issuer'],
    'expired token rejected'                 => [['exp' => (string)($now - 1)] + $good, 'token_expired'],
    'unverified email rejected'              => [['email_verified' => 'false'] + $good, 'email_unverified'],
    'missing email_verified rejected'        => [array_diff_key($good, ['email_verified' => 1]), 'email_unverified'],
    'gmail.com domain rejected'              => [['email' => 'someone@gmail.com', 'hd' => null] + $good, 'domain_not_allowed'],
    'look-alike domain rejected'             => [['email' => 'x@ntxpllc.com.evil.io', 'hd' => 'ntxpllc.com.evil.io'] + $good, 'domain_not_allowed'],
    'missing hd rejected'                    => [array_diff_key($good, ['hd' => 1]), 'hd_mismatch'],
    'hd mismatch rejected'                   => [['hd' => 'otherco.com'] + $good, 'hd_mismatch'],
    'wrong nonce rejected'                   => [['nonce' => 'nope'] + $good, 'bad_nonce'],
];
foreach ($cases as $label => [$claims, $expect]) {
    $claims = array_filter($claims, static fn($v) => $v !== null);
    $got = bf_validate_google_claims($claims, $cfg, 'NONCE456', $now);
    check($label . ' (' . ($got ?? 'ok') . ')', $got === $expect);
}
check('empty expected nonce rejected', bf_validate_google_claims($good, $cfg, '', $now) === 'bad_nonce');

// Misc helpers
check('safe_next keeps /?project=x', bf_safe_next('/?project=x') === '/?project=x');
check('safe_next blocks //evil.com', bf_safe_next('//evil.com') === '/');
check('safe_next blocks https://evil.com', bf_safe_next('https://evil.com') === '/');
check('same-origin: matching Origin ok', bf_same_origin_ok(['HTTP_HOST' => 'schedule.ntxpllc.com', 'HTTP_ORIGIN' => 'https://schedule.ntxpllc.com']));
check('same-origin: foreign Origin refused', !bf_same_origin_ok(['HTTP_HOST' => 'schedule.ntxpllc.com', 'HTTP_ORIGIN' => 'https://evil.com']));
check('same-origin: foreign Referer refused', !bf_same_origin_ok(['HTTP_HOST' => 'schedule.ntxpllc.com', 'HTTP_REFERER' => 'https://evil.com/x']));
check('token match sha256', bf_token_matches('abc', hash('sha256', 'abc')) && !bf_token_matches('abd', hash('sha256', 'abc')));
check('token match password_hash', bf_token_matches('abc', password_hash('abc', PASSWORD_DEFAULT)));
check('canonical version: top-level first', bf_canonical_version(['version' => 4, 'meta' => ['version' => 2]]) === 4);
check('canonical version: meta fallback', bf_canonical_version(['meta' => ['version' => 2]]) === 2);

// Public auth_error codes (the SPA maps exactly these seven)
$map = [
    'google_not_configured' => 'config', 'bad_state' => 'bad_state', 'state_expired' => 'bad_state',
    'access_denied' => 'access_denied', 'domain_not_allowed' => 'domain', 'hd_mismatch' => 'domain',
    'email_unverified' => 'unverified', 'bad_nonce' => 'nonce', 'token_exchange_failed' => 'token',
    'token_invalid' => 'token', 'bad_audience' => 'token', 'bad_issuer' => 'token', 'token_expired' => 'token',
    'no_code' => 'token', 'oauth_error' => 'token', 'anything_else' => 'token',
];
foreach ($map as $in => $want) {
    check("auth_error $in -> $want", bf_auth_error_code($in) === $want && in_array($want, BF_AUTH_ERRORS, true));
}
check('every claim-validation error maps to a public code', (static function () use ($cfg, $good, $now) {
    foreach (['aud' => 'x', 'iss' => 'x', 'exp' => '1', 'email_verified' => 'false', 'hd' => 'x', 'nonce' => 'x'] as $k => $v) {
        $e = bf_validate_google_claims([$k => $v] + $good, $cfg, 'NONCE456', $now);
        if ($e === null || !in_array(bf_auth_error_code($e), BF_AUTH_ERRORS, true)) {
            return false;
        }
    }
    return true;
})());

// Link scheme + version validation helpers
check('safe_link keeps https and /relative', bf_safe_link('https://x.io/a') === 'https://x.io/a' && bf_safe_link('/?project=a') === '/?project=a');
check('safe_link drops javascript:, data:, //host', bf_safe_link('javascript:alert(1)') === '' && bf_safe_link('data:text/html,x') === '' && bf_safe_link('//evil.com') === '');
check('version check: int ok', bf_canonical_version_checked((object)['version' => 7]) === [7, null]);
check('version check: float 1e20 invalid', bf_canonical_version_checked((object)['version' => 1e20]) === [null, 'invalid_version']);
check('version check: > 1e6 is a jump', bf_canonical_version_checked((object)['version' => 1000001]) === [null, 'version_jump']);
check('version check: negative invalid', bf_canonical_version_checked((object)['version' => -1]) === [null, 'invalid_version']);
$stored = (object)['changelog' => [(object)['id' => 'a']]];
check('version ceiling: +changelog growth', bf_version_ceiling($stored, (object)['changelog' => array_fill(0, 4, (object)[])], 5) === 8);
check('version ceiling: at least +1', bf_version_ceiling($stored, (object)[], 5) === 6);
check('version ceiling: at most +500', bf_version_ceiling($stored, (object)['changelog' => array_fill(0, 900, (object)[])], 5) === 505);
$c = (object)['project' => (object)['slug' => 'other']];
check('slug forced to routing slug', bf_canonical_force_slug($c, 'mine') === 'other' && $c->project->slug === 'mine');

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
