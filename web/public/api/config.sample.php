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
    // Store ONLY a hash. Generate it on the server or locally:
    //   php -r 'echo password_hash("admin", PASSWORD_DEFAULT), PHP_EOL;'
    // Leave empty to disable passphrase login.
    'passphrase_hash'      => '',
    // Identity recorded for passphrase sessions ("saved by" in changelogs).
    'passphrase_user'      => ['email' => 'team@ntxpllc.com', 'name' => 'NTXP Team'],

    // --- Agent-side sync (publish.php / changes.php) bearer token ---
    // Generate a strong token:   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    // Store its sha256 here:     php -r 'echo hash("sha256", "<token>"), PHP_EOL;'
    // (a password_hash() of the token also works). Give the token itself only to the sync agent.
    'publish_token_hash'   => '',

    // --- Storage ---
    // Absolute path recommended, outside public_html, e.g. '/home/u123456789/bidforge-data'.
    // Empty = '<web root>/../bidforge-data' when writable, else '<web root>/api/data'
    // (protected by a deny-all .htaccess). Must be writable by PHP.
    'data_dir'             => '',

    // --- Sessions ---
    'session_name'         => 'BFSESSID',
    'session_lifetime'     => 43200,         // idle timeout, seconds (12 h)
    'cookie_secure'        => null,          // null = auto (Secure on HTTPS); true to force

    // --- Limits ---
    'max_upload_mb'        => 50,            // per file (also raise upload_max_filesize/post_max_size in .user.ini)
    'max_save_mb'          => 15,            // save.php body cap
    'max_publish_mb'       => 60,            // publish.php body cap
    'login_max_attempts'   => 10,            // failed passphrase attempts per IP …
    'login_window_sec'     => 900,           // … per 15 minutes
];
