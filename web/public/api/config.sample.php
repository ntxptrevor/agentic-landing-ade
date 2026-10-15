<?php
/**
 * BidForge Schedules — SAMPLE server config. THIS FILE IS NOT LOADED.
 *
 * Copy it to `bidforge-config.php` OUTSIDE the web root and fill in real values.
 * The server looks for the config in this order and uses the first that exists:
 *   1. <DOCUMENT_ROOT>/../bidforge-config.php     (one level above the web root / public_html)
 *   2. <web root>/api/../../bidforge-config.php   (same place, resolved from this folder)
 *   3. the path in the BIDFORGE_CONFIG environment variable
 *   4. $HOME/bidforge-config.php                  (account home, outside public_html)
 *
 * The repository is PUBLIC: never commit the real file or any secret.
 */
return [
    // --- Google OAuth 2.0 / OpenID Connect (Google Cloud Console → APIs & Services → Credentials) ---
    'google_client_id'     => '',            // e.g. '1234567890-abc.apps.googleusercontent.com'
    'google_client_secret' => '',
    'google_redirect_uri'  => 'https://schedule.ntxpllc.com/auth/callback.php',

    // Only Google Workspace accounts in these domains may sign in (email + verified hd claim).
    'allowed_domains'      => ['ntxpllc.com'],

    // --- Passphrase login (alternative to Google) ---
    // The team passphrase is set by the owner; ONLY its hash goes here. Generate it on the server:
    //   php -r 'echo password_hash(trim(fgets(STDIN)), PASSWORD_DEFAULT), PHP_EOL;'   (type the passphrase, Enter)
    // Leave empty to disable passphrase login. See README §3 for the risk of a short passphrase.
    'passphrase_hash'      => '',
    // Identity recorded for passphrase sessions ("saved by" in changelogs; method "passphrase").
    'passphrase_user'      => ['email' => 'team@ntxpllc.com', 'name' => 'NTXP Team'],
    // 'editor' = passphrase sessions can save/upload; 'viewer' = read-only (save/upload → 403 read_only).
    'passphrase_role'      => 'editor',

    // --- Agent-side sync (publish.php / changes.php) bearer token ---
    // Generate a strong token:   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    // Store its sha256 here:     php -r 'echo hash("sha256", "<token>"), PHP_EOL;'
    // (a password_hash() of the token also works). Give the token itself only to the sync agent.
    'publish_token_hash'   => '',

    // --- Storage ---
    // Absolute path, outside public_html, e.g. '/home/u123456789/bidforge-data'. Must be writable by PHP.
    // Empty = '<web root>/../bidforge-data'. A data_dir inside the web root / document root is
    // refused (500 data_dir_inside_webroot): the Git-deployed folder is replaced on every deploy.
    'data_dir'             => '',
    'keep_plain_versions'  => 20,            // newest N version snapshots stay .json; older ones are gzipped

    // --- Sessions ---
    'session_name'         => 'BFSESSID',
    'session_idle_minutes' => 240,           // idle timeout
    'session_max_hours'    => 12,            // absolute lifetime from login
    'cookie_secure'        => null,          // null = auto (Secure on HTTPS); true to force

    // --- Proxy / CDN (leave empty unless a proxy you control fronts the site) ---
    // Header carrying the real client IP, e.g. 'X-Forwarded-For' or 'CF-Connecting-IP'. When set,
    // X-Forwarded-Proto is also trusted for HTTPS detection. Empty = REMOTE_ADDR only.
    'trusted_proxy_header' => '',
    'trusted_proxies'      => [],            // optional: only honour the header from these REMOTE_ADDRs

    // --- Limits ---
    'max_upload_mb'        => 50,            // per file (also raise upload_max_filesize/post_max_size in .user.ini)
    'max_save_mb'          => 15,            // save.php body cap
    'max_publish_mb'       => 60,            // publish.php body cap
    'login_max_attempts'   => 10,            // failed passphrase attempts per client IP …
    'login_window_sec'     => 900,           // … per 15 minutes
    'login_global_max_failures' => 30,       // failures across ALL IPs per window → passphrase lockout
    'login_global_lockout_sec'  => 900,      // lockout length (Google sign-in is unaffected)
];
