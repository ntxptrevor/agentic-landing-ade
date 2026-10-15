<?php
/**
 * BidForge Schedules — shared server library (schedule.ntxpllc.com).
 *
 * Included by every endpoint in /api and /auth. No output and no session start
 * on include. Under a web SAPI it turns display_errors off and installs an
 * exception handler that answers a generic JSON 500 (details go to error_log
 * only); under the CLI it has no side effects, so it can be unit-tested.
 * Requires PHP 8.0+. Config lives OUTSIDE the web root — see config.sample.php.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    ini_set('log_errors', '1');
    set_exception_handler('bf_exception_handler');
    register_shutdown_function('bf_shutdown_handler');
}

/** Uncaught exception → log the details, answer {error:"server_error"} with no paths or messages. */
function bf_exception_handler(Throwable $e): void
{
    error_log('[bidforge] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    bf_generic_500();
}

/** Fatal errors (no exception object) → the same generic JSON when nothing was sent yet. */
function bf_shutdown_handler(): void
{
    $err = error_get_last();
    if ($err !== null && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        error_log('[bidforge] fatal: ' . $err['message'] . ' @ ' . $err['file'] . ':' . $err['line']);
        bf_generic_500();
    }
}

function bf_generic_500(): void
{
    if (headers_sent()) {
        return;
    }
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header_remove();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":"server_error","message":"Internal server error"}';
}

const BF_SLUG_RE = '/^[a-z0-9][a-z0-9-]{1,80}$/';
const BF_STATUSES = ['bid', 'active', 'closed'];
const BF_UPLOAD_KINDS = ['input', 'schedule', 'quote', 'plan', 'photo', 'spec'];
const BF_UPLOAD_EXTS = [
    'pdf', 'xml', 'mpp', 'csv', 'xlsx', 'xls', 'docx', 'doc', 'txt', 'md', 'eml', 'msg',
    'png', 'jpg', 'jpeg', 'heic', 'webp', 'gif', 'tif', 'tiff', 'dwg', 'json',
];
const BF_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Candidate config paths, in search order. */
function bf_config_candidates(): array
{
    $c = [];
    $docroot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    if ($docroot !== '') {
        $c[] = rtrim($docroot, '/') . '/../bidforge-config.php';   // one level above public_html
    }
    $c[] = __DIR__ . '/../../bidforge-config.php';                   // one level above the web root
    $env = getenv('BIDFORGE_CONFIG');
    if (is_string($env) && $env !== '') {
        $c[] = $env;
    }
    $home = getenv('HOME');
    if (is_string($home) && $home !== '') {
        $c[] = rtrim($home, '/') . '/bidforge-config.php';           // account home (outside public_html)
    }
    return $c;
}

function bf_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $loaded = [];
    foreach (bf_config_candidates() as $p) {
        if (is_file($p) && is_readable($p)) {
            $c = (static function (string $__p) { return require $__p; })($p);
            if (is_array($c)) {
                $loaded = $c;
                $loaded['_path'] = realpath($p) ?: $p;
                break;
            }
        }
    }
    $defaults = [
        'google_client_id'     => '',
        'google_client_secret' => '',
        'google_redirect_uri'  => '',
        'allowed_domains'      => ['ntxpllc.com'],
        'passphrase_hash'      => '',
        'passphrase_user'      => ['email' => 'team@ntxpllc.com', 'name' => 'NTXP Team'],
        'publish_token_hash'   => '',
        'data_dir'             => '',
        'passphrase_role'      => 'editor',  // 'editor' (read/write) or 'viewer' (read-only)
        'session_name'         => 'BFSESSID',
        'session_idle_minutes' => 240,     // idle timeout
        'session_max_hours'    => 12,      // absolute lifetime from login
        'cookie_secure'        => null,    // null = auto (secure when the request is HTTPS)
        'trusted_proxy_header' => '',      // e.g. 'X-Forwarded-For' or 'CF-Connecting-IP'; '' = trust REMOTE_ADDR only
        'trusted_proxies'      => [],      // optional REMOTE_ADDR allow-list for the header above
        'max_upload_mb'        => 50,
        'max_save_mb'          => 15,
        'max_publish_mb'       => 60,
        'login_max_attempts'   => 10,      // failed passphrase attempts per client IP …
        'login_window_sec'     => 900,     // … per window
        'login_global_max_failures' => 30, // failed passphrase attempts across ALL IPs per window …
        'login_global_lockout_sec'  => 900, // … then passphrase login is locked for everyone (Google unaffected)
        'keep_plain_versions'  => 20,      // newest N snapshots stay .json; older ones are gzipped
    ];
    // Legacy key: session_lifetime (seconds) was the idle timeout.
    if (isset($loaded['session_lifetime']) && !isset($loaded['session_idle_minutes'])) {
        $loaded['session_idle_minutes'] = max(1, (int)$loaded['session_lifetime'] / 60);
    }
    $cfg = array_merge($defaults, $loaded);
    $cfg['passphrase_role'] = $cfg['passphrase_role'] === 'viewer' ? 'viewer' : 'editor';
    $cfg['allowed_domains'] = array_values(array_filter(array_map(
        static fn($d) => strtolower(trim((string)$d)),
        (array)$cfg['allowed_domains']
    )));
    return $cfg;
}

function bf_google_configured(array $cfg): bool
{
    return trim((string)$cfg['google_client_id']) !== '' && trim((string)$cfg['google_client_secret']) !== '';
}

function bf_passphrase_configured(array $cfg): bool
{
    return trim((string)$cfg['passphrase_hash']) !== '';
}

// ---------------------------------------------------------------------------
// Responses / requests
// ---------------------------------------------------------------------------

function bf_json($data, int $status = 200, array $headers = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $h) {
        header($h);
    }
    echo json_encode($data, BF_JSON_FLAGS);
    exit;
}

function bf_error(int $status, string $code, string $message = '', array $extra = [], array $headers = []): void
{
    bf_json(array_merge(['error' => $code, 'message' => $message ?: $code], $extra), $status, $headers);
}

function bf_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function bf_require_method(string ...$allowed): void
{
    if (!in_array(bf_method(), $allowed, true)) {
        bf_error(405, 'method_not_allowed', 'Use ' . implode('/', $allowed), [], ['Allow: ' . implode(', ', $allowed)]);
    }
}

/** Raw request body, capped. 413 when larger than $maxBytes. */
function bf_raw_body(int $maxBytes): string
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > $maxBytes) {
        bf_error(413, 'payload_too_large', 'Request body exceeds ' . $maxBytes . ' bytes');
    }
    $raw = (string)file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if (strlen($raw) > $maxBytes) {
        bf_error(413, 'payload_too_large', 'Request body exceeds ' . $maxBytes . ' bytes');
    }
    return $raw;
}

/** Decode JSON body as associative array (400 on invalid). */
function bf_json_body(int $maxBytes, ?string &$raw = null): array
{
    $raw = bf_raw_body($maxBytes);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        bf_error(400, 'invalid_json', 'Body must be a JSON object');
    }
    return $data;
}

function bf_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function bf_valid_slug($slug): bool
{
    return is_string($slug) && preg_match(BF_SLUG_RE, $slug) === 1;
}

function bf_require_slug($slug): string
{
    if (!bf_valid_slug($slug)) {
        bf_error(400, 'invalid_slug', 'slug must match ^[a-z0-9][a-z0-9-]{1,80}$');
    }
    return $slug;
}

/** True when a trusted proxy header is configured and the direct peer is allowed to set it. */
function bf_proxy_trusted(): bool
{
    $cfg = bf_config();
    if (trim((string)$cfg['trusted_proxy_header']) === '') {
        return false;
    }
    $allow = array_values(array_filter(array_map('strval', (array)$cfg['trusted_proxies'])));
    return $allow === [] || in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), $allow, true);
}

/**
 * Client IP for rate limiting. REMOTE_ADDR unless `trusted_proxy_header` is
 * configured (and the peer is in `trusted_proxies`, when that list is set);
 * then the LAST valid address in that header (the one the proxy appended).
 */
function bf_client_ip(): string
{
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!bf_proxy_trusted()) {
        return $remote;
    }
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', trim((string)bf_config()['trusted_proxy_header'])));
    $parts = array_reverse(array_map('trim', explode(',', (string)($_SERVER[$key] ?? ''))));
    foreach ($parts as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP) !== false) {
            return $ip;
        }
    }
    return $remote;
}

/** HTTPS detection. X-Forwarded-Proto is honoured only behind a configured trusted proxy. */
function bf_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (bf_proxy_trusted() && strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
        return true;
    }
    return (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
}

/** Safe local redirect target: must start with a single "/". */
function bf_safe_next($next): string
{
    if (!is_string($next) || $next === '' || $next[0] !== '/' || str_starts_with($next, '//') || str_contains($next, '\\')
        || preg_match('/[\x00-\x1f]/', $next)) {
        return '/';
    }
    return $next;
}

function bf_redirect(string $location): void
{
    header('Cache-Control: no-store');
    header('Location: ' . $location, true, 302);
    exit;
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function bf_mkdir(string $dir): bool
{
    return is_dir($dir) || @mkdir($dir, 0750, true) || is_dir($dir);
}

const BF_DENY_HTACCESS = "# BidForge private data — never served directly\n"
    . "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
    . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
    . "Options -Indexes\n"
    . "<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n";

function bf_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $cfg = bf_config();
    $webroot = dirname(__DIR__);
    $d = rtrim(trim((string)$cfg['data_dir']), '/');
    if ($d === '') {
        // Default: next to (never inside) the web root. No silent fallback into the
        // Git-deployed folder — that is replaced wholesale on every deploy.
        $d = dirname($webroot) . '/bidforge-data';
    }
    if (!bf_mkdir($d) || !is_writable($d)) {
        bf_error(500, 'data_dir_unwritable', 'Data directory is missing or not writable; set data_dir in the private config');
    }
    $real = realpath($d) ?: $d;
    foreach (array_filter([realpath($webroot) ?: $webroot, ($_SERVER['DOCUMENT_ROOT'] ?? '') !== '' ? (realpath((string)$_SERVER['DOCUMENT_ROOT']) ?: null) : null]) as $root) {
        if ($real === $root || str_starts_with($real . '/', rtrim($root, '/') . '/')) {
            bf_error(500, 'data_dir_inside_webroot', 'data_dir must be outside the web root; set an absolute data_dir in the private config');
        }
    }
    if (!is_file($d . '/.htaccess')) {
        @file_put_contents($d . '/.htaccess', BF_DENY_HTACCESS);
    }
    if (!is_file($d . '/index.html')) {
        @file_put_contents($d . '/index.html', '');
    }
    $dir = $d;
    return $dir;
}

function bf_project_dir(string $slug): string
{
    if (!bf_valid_slug($slug)) {
        throw new InvalidArgumentException('invalid slug');
    }
    return bf_data_dir() . '/projects/' . $slug;
}

function bf_index_path(): string
{
    return bf_data_dir() . '/kb/projects.json';
}

/** Write a file atomically: temp file in the same dir + rename. */
function bf_write_atomic(string $path, string $data): void
{
    $dir = dirname($path);
    if (!bf_mkdir($dir)) {
        throw new RuntimeException('cannot create ' . $dir);
    }
    $tmp = $dir . '/.tmp-' . bin2hex(random_bytes(6)) . '-' . basename($path);
    if (file_put_contents($tmp, $data, LOCK_EX) === false) {
        @unlink($tmp);
        throw new RuntimeException('cannot write ' . $path);
    }
    @chmod($tmp, 0640);
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('cannot rename into ' . $path);
    }
}

/** Run $fn while holding an exclusive flock on "$path.lock". */
function bf_with_lock(string $path, callable $fn)
{
    bf_mkdir(dirname($path));
    $fh = fopen($path . '.lock', 'c');
    if ($fh === false) {
        throw new RuntimeException('cannot open lock for ' . $path);
    }
    try {
        flock($fh, LOCK_EX);
        return $fn();
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function bf_read_json(string $path, $default = null, bool $assoc = true)
{
    if (!is_file($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return $default;
    }
    $v = json_decode($raw, $assoc);
    return $v === null ? $default : $v;
}

function bf_encode_store($v): string
{
    return json_encode($v, BF_JSON_FLAGS | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
}

function bf_append_line(string $path, string $line): void
{
    bf_mkdir(dirname($path));
    if (file_put_contents($path, $line, FILE_APPEND | LOCK_EX) === false) {
        throw new RuntimeException('cannot append ' . $path);
    }
}

// ---------------------------------------------------------------------------
// Canonical documents (version + hash rules shared by project/save/publish)
// ---------------------------------------------------------------------------

/** Version of a canonical (object or array): top-level `version`, else `meta.version`. */
function bf_canonical_version($canonical): ?int
{
    if (is_object($canonical)) {
        $canonical = json_decode(json_encode($canonical), true);
    }
    if (!is_array($canonical)) {
        return null;
    }
    if (isset($canonical['version']) && is_numeric($canonical['version'])) {
        return (int)$canonical['version'];
    }
    if (isset($canonical['meta']['version']) && is_numeric($canonical['meta']['version'])) {
        return (int)$canonical['meta']['version'];
    }
    return null;
}

/** Stored canonical: [object|null, rawBytes|null, hash|null, version|null]. */
function bf_canonical_load(string $slug): array
{
    $p = bf_project_dir($slug) . '/canonical.json';
    if (!is_file($p)) {
        return [null, null, null, null];
    }
    $raw = (string)file_get_contents($p);
    $obj = json_decode($raw);
    return [$obj, $raw, hash('sha256', $raw), bf_canonical_version($obj)];
}

/** Set the version on a decoded (stdClass) canonical: top-level, plus meta.version if meta has one. */
function bf_canonical_set_version(object $c, int $version): void
{
    $c->version = $version;
    if (isset($c->meta) && is_object($c->meta) && property_exists($c->meta, 'version')) {
        $c->meta->version = $version;
    }
}

/** Find a substantial-completion date in a canonical (common keys / milestone names). */
function bf_find_sc_date($node, int $depth = 0): ?string
{
    if ($depth > 6 || (!is_array($node) && !is_object($node))) {
        return null;
    }
    $arr = is_object($node) ? get_object_vars($node) : $node;
    foreach ($arr as $k => $v) {
        if (is_string($k) && is_string($v) && $v !== ''
            && preg_match('/^(scDate|substantialCompletion(Date)?|substantial_completion(_date)?)$/i', $k)) {
            return $v;
        }
    }
    $name = $arr['name'] ?? $arr['title'] ?? null;
    if (is_string($name) && preg_match('/substantial\s+completion/i', $name)) {
        foreach (['finish', 'end', 'date', 'earlyFinish', 'finishDate', 'endDate', 'start'] as $f) {
            if (isset($arr[$f]) && is_string($arr[$f]) && $arr[$f] !== '') {
                return $arr[$f];
            }
        }
    }
    foreach ($arr as $v) {
        if (is_array($v) || is_object($v)) {
            $r = bf_find_sc_date($v, $depth + 1);
            if ($r !== null) {
                return $r;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

function bf_versions_list(string $slug): array
{
    $vdir = bf_project_dir($slug) . '/versions';
    if (!is_dir($vdir)) {
        return [];
    }
    $meta = bf_read_json($vdir . '/index.json', []);
    $out = [];
    $seen = [];
    foreach (scandir($vdir) ?: [] as $f) {
        if (!preg_match('/^(v(\d+)-(\d{4}-\d{2}-\d{2})\.json)(\.gz)?$/', $f, $m)) {
            continue;
        }
        $v = (int)$m[2];
        if (isset($seen[$v]) && !empty($m[4])) {
            continue; // plain copy wins (transient state during compression)
        }
        $base = $m[1];
        $info = is_array($meta[$base] ?? null) ? $meta[$base] : [];
        $seen[$v] = [
            'version' => $v,
            'file'    => $f,
            'savedAt' => $info['savedAt'] ?? gmdate('Y-m-d\TH:i:s\Z', (int)filemtime($vdir . '/' . $f)),
            'by'      => $info['by'] ?? null,
            'method'  => $info['method'] ?? null,
            'reason'  => $info['reason'] ?? null,
        ];
    }
    $out = array_values($seen);
    usort($out, static fn($a, $b) => $b['version'] <=> $a['version']);
    return $out;
}

/** JSON bytes of a snapshot (transparently gunzips *.json.gz); null when missing. */
function bf_version_read(string $slug, int $version): ?string
{
    foreach (bf_versions_list($slug) as $v) {
        if ($v['version'] === $version) {
            $raw = file_get_contents(bf_project_dir($slug) . '/versions/' . $v['file']);
            if ($raw === false) {
                return null;
            }
            if (str_ends_with($v['file'], '.gz')) {
                $raw = @gzdecode($raw);
            }
            return is_string($raw) ? $raw : null;
        }
    }
    return null;
}

/** Write an immutable version snapshot (never overwrites an existing file). */
function bf_version_write(string $slug, int $version, string $json, string $by, ?string $reason, ?string $method = null): string
{
    $vdir = bf_project_dir($slug) . '/versions';
    bf_mkdir($vdir);
    foreach (scandir($vdir) ?: [] as $f) {
        if (preg_match('/^(v0*' . $version . '-\d{4}-\d{2}-\d{2}\.json)(\.gz)?$/', $f, $m)) {
            return $m[1]; // already snapshotted — immutable
        }
    }
    $file = sprintf('v%03d-%s.json', $version, gmdate('Y-m-d'));
    $fh = @fopen($vdir . '/' . $file, 'x');
    if ($fh === false) {
        return $file;
    }
    fwrite($fh, $json);
    fclose($fh);
    @chmod($vdir . '/' . $file, 0440);
    bf_with_lock($vdir . '/index.json', static function () use ($vdir, $file, $by, $reason, $method) {
        $idx = bf_read_json($vdir . '/index.json', []);
        $idx[$file] = ['savedAt' => bf_now(), 'by' => $by, 'method' => $method, 'reason' => $reason];
        bf_write_atomic($vdir . '/index.json', bf_encode_store($idx));
    });
    bf_versions_compress($slug);
    return $file;
}

/** Gzip snapshots older than the newest `keep_plain_versions` (content stays immutable). */
function bf_versions_compress(string $slug): void
{
    if (!function_exists('gzencode')) {
        return;
    }
    $keep = max(1, (int)bf_config()['keep_plain_versions']);
    $vdir = bf_project_dir($slug) . '/versions';
    $plain = [];
    foreach (scandir($vdir) ?: [] as $f) {
        if (preg_match('/^v(\d+)-\d{4}-\d{2}-\d{2}\.json$/', $f, $m)) {
            $plain[(int)$m[1]] = $f;
        }
    }
    krsort($plain);
    foreach (array_slice($plain, $keep, null, true) as $f) {
        $src = $vdir . '/' . $f;
        $gz = $src . '.gz';
        $raw = file_get_contents($src);
        if ($raw === false || is_file($gz)) {
            continue;
        }
        $fh = @fopen($gz, 'x');
        if ($fh === false) {
            continue;
        }
        fwrite($fh, (string)gzencode($raw, 9));
        fclose($fh);
        @chmod($gz, 0440);
        if (@gzdecode((string)file_get_contents($gz)) === $raw) {
            @unlink($src);
        } else {
            @unlink($gz);
        }
    }
}

// ---------------------------------------------------------------------------
// Incoming canonical validation (version jump, slug match)
// ---------------------------------------------------------------------------

const BF_MAX_VERSION = 1000000;
const BF_MAX_VERSION_STEP = 500;

/**
 * Raw `version` (top-level, else meta.version) of a decoded canonical, validated:
 * returns [int|null version, ?string errorCode]. Floats (1e20), negatives,
 * strings that are not plain digits and values above BF_MAX_VERSION are errors.
 */
function bf_canonical_version_checked(object $c): array
{
    $v = property_exists($c, 'version') ? $c->version
        : ((isset($c->meta) && is_object($c->meta) && property_exists($c->meta, 'version')) ? $c->meta->version : null);
    if ($v === null) {
        return [null, null];
    }
    if (is_string($v) && preg_match('/^\d{1,7}$/', $v)) {
        $v = (int)$v;
    }
    if (!is_int($v) || $v < 0) {
        return [null, 'invalid_version'];
    }
    if ($v > BF_MAX_VERSION) {
        return [null, 'version_jump'];
    }
    return [$v, null];
}

/**
 * Highest version an incoming canonical may claim on top of $max (the stored
 * version / newest snapshot): $max + the number of changelog entries added since
 * the stored canonical (entries newer than its generatedAt, or beyond its
 * changelog length — whichever is larger), at least +1 and at most +500.
 */
function bf_version_ceiling(?object $stored, object $incoming, int $max): int
{
    $inLog = (isset($incoming->changelog) && is_array($incoming->changelog)) ? $incoming->changelog : [];
    if ($stored === null) {
        return max(BF_MAX_VERSION_STEP, count($inLog) + 1);
    }
    $storedLog = (isset($stored->changelog) && is_array($stored->changelog)) ? $stored->changelog : [];
    $gen = isset($stored->generatedAt) && is_string($stored->generatedAt) ? strtotime($stored->generatedAt) : false;
    $newer = 0;
    if ($gen !== false) {
        foreach ($inLog as $e) {
            $at = is_object($e) && isset($e->at) && is_string($e->at) ? strtotime($e->at) : false;
            if ($at !== false && $at > $gen) {
                $newer++;
            }
        }
    }
    $added = max($newer, count($inLog) - count($storedLog));
    return $max + max(1, min(BF_MAX_VERSION_STEP, $added));
}

/**
 * A-24: canonical.project.slug, when present, must be the routing slug. Rewrites
 * it in place; returns the slug the canonical claimed when it differed, else null.
 */
function bf_canonical_force_slug(object $c, string $slug): ?string
{
    if (isset($c->project) && is_object($c->project) && property_exists($c->project, 'slug') && $c->project->slug !== $slug) {
        $was = is_scalar($c->project->slug) ? (string)$c->project->slug : '';
        $c->project->slug = $slug;
        return $was;
    }
    return null;
}

// ---------------------------------------------------------------------------
// pending_sync.jsonl (site saves waiting for the KB pull)
// ---------------------------------------------------------------------------

function bf_pending_path(string $slug): string
{
    return bf_project_dir($slug) . '/pending_sync.jsonl';
}

/** All entries of a project's pending_sync.jsonl. */
function bf_pending_read(string $path): array
{
    $out = [];
    if (!is_file($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $e = json_decode($line, true);
        if (is_array($e)) {
            $out[] = $e;
        }
    }
    return $out;
}

/** Versions of un-acknowledged site saves (ascending). */
function bf_pending_unpulled(string $slug): array
{
    $v = [];
    foreach (bf_pending_read(bf_pending_path($slug)) as $e) {
        if (empty($e['pulledAt']) && isset($e['version']) && is_numeric($e['version'])) {
            $v[] = (int)$e['version'];
        }
    }
    sort($v);
    return array_values(array_unique($v));
}

// ---------------------------------------------------------------------------
// Changelog (markdown) + sources
// ---------------------------------------------------------------------------

function bf_md_escape(string $s): string
{
    return str_replace(['[', ']', "\n", "\r"], ['\\[', '\\]', ' ', ' '], $s);
}

/** Only http(s) and site-relative links survive (no javascript:, data:, //host). */
function bf_safe_link($url): string
{
    $url = is_string($url) ? trim($url) : '';
    return preg_match('#^(https?://[^\s()<>]+|/(?!/)[^\s()<>]*)$#i', $url) ? $url : '';
}

/** Normalise a sources list: [{type,title,url,date}], max 50. */
function bf_sources_clean($sources): array
{
    $out = [];
    foreach (is_array($sources) ? $sources : [] as $s) {
        if (is_object($s)) {
            $s = json_decode(json_encode($s), true);
        }
        if (!is_array($s)) {
            continue;
        }
        $e = [];
        foreach (['type', 'title', 'date'] as $k) {
            if (isset($s[$k]) && is_scalar($s[$k]) && (string)$s[$k] !== '') {
                $e[$k] = mb_substr(preg_replace('/[\x00-\x1f]+/', ' ', (string)$s[$k]) ?? '', 0, 200);
            }
        }
        $url = bf_safe_link($s['url'] ?? $s['link'] ?? '');
        if ($url !== '') {
            $e['url'] = $url;
        }
        if ($e) {
            $out[] = $e;
        }
        if (count($out) >= 50) {
            break;
        }
    }
    return $out;
}

/** Markdown for a sources list: "type: [title](url) (date); …". */
function bf_sources_md(array $sources): string
{
    $parts = [];
    foreach ($sources as $s) {
        $title = bf_md_escape((string)($s['title'] ?? $s['type'] ?? 'source'));
        $label = isset($s['type']) ? bf_md_escape((string)$s['type']) . ': ' : '';
        $date = isset($s['date']) ? ' (' . bf_md_escape((string)$s['date']) . ')' : '';
        $url = bf_safe_link($s['url'] ?? '');
        $parts[] = $url !== '' ? "{$label}[{$title}]({$url}){$date}" : "{$label}{$title}{$date}";
    }
    return implode('; ', $parts);
}

/** Append one dated changelog.md line (creating the file with a title). */
function bf_changelog_append(string $slug, string $text, array $sources, string $title): void
{
    $clPath = bf_project_dir($slug) . '/changelog.md';
    $line = '- ' . gmdate('Y-m-d') . ' — ' . $text . ($sources ? ' — Sources: ' . bf_sources_md($sources) : '') . "\n";
    bf_with_lock($clPath, static function () use ($clPath, $line, $title) {
        if (!is_file($clPath)) {
            $line = '# ' . bf_md_escape($title) . " — Schedule Changelog\n\n" . $line;
        }
        bf_append_line($clPath, $line);
    });
}

/** Project title for a new changelog. */
function bf_canonical_title(?object $c, string $fallback): string
{
    return ($c !== null && isset($c->project) && is_object($c->project) && isset($c->project->name) && is_string($c->project->name))
        ? $c->project->name : $fallback;
}

// ---------------------------------------------------------------------------
// Activity stream
// ---------------------------------------------------------------------------

function bf_activity_read(string $slug): array
{
    $doc = bf_read_json(bf_project_dir($slug) . '/activity_stream.json', []);
    $entries = is_array($doc['entries'] ?? null) ? $doc['entries'] : (is_array($doc) && isset($doc[0]) ? $doc : []);
    return array_values(array_filter($entries, 'is_array'));
}

function bf_activity_write(string $slug, array $entries): void
{
    usort($entries, static fn($a, $b) => (strtotime((string)($a['ts'] ?? '')) ?: 0) <=> (strtotime((string)($b['ts'] ?? '')) ?: 0));
    if (count($entries) > 5000) {
        $entries = array_slice($entries, -5000);
    }
    bf_write_atomic(bf_project_dir($slug) . '/activity_stream.json',
        bf_encode_store(['section' => 'activity_stream', 'entries' => array_values($entries)]));
}

function bf_activity_append(string $slug, array $entry): void
{
    $path = bf_project_dir($slug) . '/activity_stream.json';
    bf_with_lock($path, static function () use ($slug, $entry) {
        $entries = bf_activity_read($slug);
        $entries[] = $entry + ['ts' => bf_now()];
        bf_activity_write($slug, $entries);
    });
}

/**
 * Keep only the activity-stream schema fields of an entry
 * {ts, source, kind, text, link, rating, critical, sources, method, by}; links are scheme-checked.
 * Returns null when ts/text are missing.
 */
function bf_activity_clean($e): ?array
{
    if (is_object($e)) {
        $e = json_decode(json_encode($e), true);
    }
    if (!is_array($e) || !isset($e['ts'], $e['text']) || !is_string($e['ts']) || !is_scalar($e['text']) || strtotime($e['ts']) === false) {
        return null;
    }
    $out = ['ts' => $e['ts'], 'text' => mb_substr((string)$e['text'], 0, 1000)];
    foreach (['source', 'kind', 'method', 'by'] as $k) {
        if (isset($e[$k]) && is_scalar($e[$k])) {
            $out[$k] = mb_substr((string)$e[$k], 0, 80);
        }
    }
    $link = bf_safe_link($e['link'] ?? '');
    if ($link !== '') {
        $out['link'] = $link;
    }
    if (isset($e['rating']) && is_numeric($e['rating'])) {
        $out['rating'] = 0 + $e['rating'];
    }
    if (isset($e['critical'])) {
        $out['critical'] = $e['critical'] === true;
    }
    if (isset($e['sources'])) {
        $out['sources'] = bf_sources_clean($e['sources']);
    }
    return $out;
}

/** Merge a canonical's per-change `activity` array into the stream; returns entries added. */
function bf_activity_merge_canonical(string $slug, object $canonical, ?string $method = null): int
{
    if (!isset($canonical->activity) || !is_array($canonical->activity)) {
        return 0;
    }
    $in = [];
    foreach (array_slice($canonical->activity, 0, 500) as $e) {
        $c = bf_activity_clean($e);
        if ($c !== null) {
            if ($method !== null && !isset($c['method'])) {
                $c['method'] = $method;
            }
            $in[] = $c;
        }
    }
    return $in ? bf_activity_merge($slug, $in) : 0;
}

/** Merge entries (dedupe on ts+text). */
function bf_activity_merge(string $slug, array $incoming): int
{
    $path = bf_project_dir($slug) . '/activity_stream.json';
    return bf_with_lock($path, static function () use ($slug, $incoming) {
        $entries = bf_activity_read($slug);
        $seen = [];
        foreach ($entries as $e) {
            $seen[bf_activity_key($e)] = true;
        }
        $added = 0;
        foreach ($incoming as $e) {
            $e = bf_activity_clean($e);
            if ($e === null) {
                continue;
            }
            $k = bf_activity_key($e);
            if (!isset($seen[$k])) {
                $seen[$k] = true;
                $entries[] = $e;
                $added++;
            }
        }
        bf_activity_write($slug, $entries);
        return $added;
    });
}

function bf_activity_key(array $e): string
{
    return hash('sha256', json_encode([(string)($e['ts'] ?? ''), (string)($e['text'] ?? '')]));
}

/** {critical, recent} views of the activity stream. */
function bf_activity_views(array $entries, ?int $now = null): array
{
    $now = $now ?? time();
    $ts = static fn($e) => strtotime((string)($e['ts'] ?? '')) ?: 0;
    usort($entries, static fn($a, $b) => $ts($b) <=> $ts($a));
    $critical = array_values(array_filter($entries, static function ($e) use ($ts, $now) {
        $isCrit = ($e['critical'] ?? false) === true || (isset($e['rating']) && is_numeric($e['rating']) && (float)$e['rating'] >= 3);
        return $isCrit && $ts($e) >= $now - 30 * 86400;
    }));
    return ['critical' => array_slice($critical, 0, 15), 'recent' => array_slice($entries, 0, 25)];
}

// ---------------------------------------------------------------------------
// Knowledge-base projects index (<data>/kb/projects.json)
// ---------------------------------------------------------------------------

function bf_normalize_status($s): string
{
    $s = strtolower(trim((string)$s));
    if (in_array($s, ['bid', 'bidding', 'pursuit', 'proposal', 'estimating'], true)) {
        return 'bid';
    }
    if (in_array($s, ['active', 'awarded', 'in-progress', 'in progress', 'construction', 'ntp', ''], true)) {
        return 'active';
    }
    return 'closed';
}

function bf_folder_for(string $status, string $name): array
{
    $n = trim(preg_replace('/[\/\\\\:*?"<>|\x00-\x1f]+/', '-', $name) ?? '') ?: 'Untitled';
    return $status === 'bid'
        ? ['kind' => 'bid', 'path' => '!Active Bids/' . $n . '/Schedules']
        : ['kind' => 'project', 'path' => '!Active Projects/' . $n . '/06 - Schedule'];
}

function bf_index_read(): array
{
    $doc = bf_read_json(bf_index_path(), []);
    $list = is_array($doc['projects'] ?? null) ? $doc['projects'] : (is_array($doc) && isset($doc[0]) ? $doc : []);
    return array_values(array_filter($list, static fn($e) => is_array($e) && bf_valid_slug($e['slug'] ?? null)));
}

function bf_index_normalize(array $e): array
{
    $slug = (string)$e['slug'];
    $status = bf_normalize_status($e['status'] ?? 'active');
    $name = (string)($e['name'] ?? $slug);
    $route = bf_folder_for($status, $name);
    // A stored folder is kept only while it routes to the right kind (bid vs project).
    $folder = (is_array($e['folder'] ?? null) && isset($e['folder']['kind'], $e['folder']['path']) && $e['folder']['kind'] === $route['kind'])
        ? ['kind' => (string)$e['folder']['kind'], 'path' => (string)$e['folder']['path']]
        : $route;
    $norm = [
        'slug'          => $slug,
        'name'          => $name,
        'number'        => $e['number'] ?? null,
        'status'        => $status,
        'owner'         => $e['owner'] ?? null,
        'jobtreadJobId' => $e['jobtreadJobId'] ?? null,
        'version'       => isset($e['version']) && is_numeric($e['version']) ? (int)$e['version'] : null,
        'updatedAt'     => $e['updatedAt'] ?? null,
        'scDate'        => $e['scDate'] ?? null,
        // Set ONLY by publish.php (KB → site); a site save records siteSavedVersion instead.
        'publishedVersion' => isset($e['publishedVersion']) && is_numeric($e['publishedVersion']) ? (int)$e['publishedVersion'] : null,
        'siteSavedVersion' => isset($e['siteSavedVersion']) && is_numeric($e['siteSavedVersion']) ? (int)$e['siteSavedVersion'] : null,
        'folder'        => $folder,
        'liveUrl'       => '/?project=' . $slug,
    ];
    if (isset($e['hostUrl']) && is_string($e['hostUrl']) && $e['hostUrl'] !== '') {
        $norm['hostUrl'] = $e['hostUrl'];
    }
    return array_merge($e, $norm);
}

/**
 * Upsert index entries under lock. $mutator(?array $existing): array $entry is
 * called per slug. Returns the resulting entries keyed by slug.
 */
function bf_index_upsert(array $slugMutators): array
{
    $path = bf_index_path();
    return bf_with_lock($path, static function () use ($path, $slugMutators) {
        $bySlug = [];
        foreach (bf_index_read() as $e) {
            $bySlug[$e['slug']] = $e;
        }
        $result = [];
        foreach ($slugMutators as $slug => $fn) {
            $new = $fn($bySlug[$slug] ?? null);
            $new['slug'] = $slug;
            $bySlug[$slug] = $new;
            $result[$slug] = $new;
        }
        bf_write_atomic($path, bf_encode_store([
            'section'   => 'projects_index',
            'updatedAt' => bf_now(),
            'projects'  => array_values($bySlug),
        ]));
        return $result;
    });
}

// ---------------------------------------------------------------------------
// Rate limiting (file-based, per IP)
// ---------------------------------------------------------------------------

/** Bucket file; $key null = per client IP, else a fixed key (e.g. 'global'). */
function bf_rl_path(string $bucket, ?string $key = null): string
{
    return bf_data_dir() . '/ratelimit/' . $bucket . '-' . hash('sha256', $key ?? bf_client_ip()) . '.json';
}

function bf_rl_hits(string $p, int $window): array
{
    return array_values(array_filter((array)bf_read_json($p, []), static fn($t) => is_int($t) && $t > time() - $window));
}

function bf_rl_wait(array $hits, int $max, int $window): int
{
    if (count($hits) < $max) {
        return 0;
    }
    sort($hits);
    return max(1, $hits[count($hits) - $max] + $window - time());
}

/** Seconds until allowed again, or 0 if not blocked (read under the bucket lock). */
function bf_rl_blocked(string $bucket, int $max, int $window, ?string $key = null): int
{
    $p = bf_rl_path($bucket, $key);
    return (int)bf_with_lock($p, static fn() => bf_rl_wait(bf_rl_hits($p, $window), $max, $window));
}

/**
 * Atomic check-and-record: under the lock, refuse (return wait seconds) when
 * $max hits are already in the window, else record this attempt and return 0.
 * Callers clear the bucket after a success. Parallel bursts cannot exceed $max.
 */
function bf_rl_take(string $bucket, int $max, int $window, ?string $key = null): int
{
    $p = bf_rl_path($bucket, $key);
    $wait = (int)bf_with_lock($p, static function () use ($p, $max, $window) {
        $hits = bf_rl_hits($p, $window);
        if (($w = bf_rl_wait($hits, $max, $window)) > 0) {
            return $w;
        }
        $hits[] = time();
        bf_write_atomic($p, json_encode($hits));
        return 0;
    });
    bf_rl_gc();
    return $wait;
}

/** Record a hit; returns the number of hits now in the window. */
function bf_rl_hit(string $bucket, int $window, ?string $key = null): int
{
    $p = bf_rl_path($bucket, $key);
    $n = (int)bf_with_lock($p, static function () use ($p, $window) {
        $hits = bf_rl_hits($p, $window);
        $hits[] = time();
        bf_write_atomic($p, json_encode($hits));
        return count($hits);
    });
    bf_rl_gc();
    return $n;
}

function bf_rl_clear(string $bucket, ?string $key = null): void
{
    $p = bf_rl_path($bucket, $key);
    bf_with_lock($p, static function () use ($p) {
        @unlink($p);
    });
}

/** Lockout marker: seconds remaining (0 = not locked). */
function bf_rl_locked(string $name): int
{
    $until = (int)(bf_read_json(bf_data_dir() . '/ratelimit/lock-' . $name . '.json', [])['until'] ?? 0);
    return max(0, $until - time());
}

function bf_rl_lock(string $name, int $seconds): void
{
    bf_write_atomic(bf_data_dir() . '/ratelimit/lock-' . $name . '.json', json_encode(['until' => time() + $seconds, 'at' => bf_now()]));
}

/** Delete rate-limit files untouched for more than 24 h. */
function bf_rl_gc(): void
{
    $dir = bf_data_dir() . '/ratelimit';
    $cut = time() - 86400;
    foreach (scandir($dir) ?: [] as $f) {
        if ($f[0] === '.' || !preg_match('/\.(json|lock)$/', $f)) {
            continue;
        }
        $p = $dir . '/' . $f;
        if (is_file($p) && (int)@filemtime($p) < $cut) {
            @unlink($p);
        }
    }
}

// ---------------------------------------------------------------------------
// Sessions, auth guard, CSRF
// ---------------------------------------------------------------------------

function bf_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $cfg = bf_config();
    $idle = max(60, (int)round((float)$cfg['session_idle_minutes'] * 60));
    $maxAge = max(1, (int)round((float)$cfg['session_max_hours'] * 3600));
    $life = max($idle, min($maxAge, 7 * 86400));
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.gc_maxlifetime', (string)$life);
    $sdir = bf_data_dir() . '/sessions';
    if (bf_mkdir($sdir) && is_writable($sdir)) {
        session_save_path($sdir);
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
    }
    session_name((string)$cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $cfg['cookie_secure'] === null ? bf_is_https() : (bool)$cfg['cookie_secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (!empty($_SESSION['user'])) {
        $now = time();
        // Idle timeout AND absolute lifetime (from login), whichever comes first.
        if ($now - (int)($_SESSION['last'] ?? 0) > $idle || $now - (int)($_SESSION['loginAt'] ?? 0) > $maxAge) {
            $_SESSION = [];
        } else {
            $_SESSION['last'] = time();
        }
    }
}

function bf_current_user(): ?array
{
    bf_session_start();
    $u = $_SESSION['user'] ?? null;
    if (!is_array($u)) {
        return null;
    }
    $u['role'] = bf_user_role($u);
    return $u;
}

/** 'viewer' for passphrase sessions when passphrase_role is 'viewer'; else 'editor'. Evaluated per request. */
function bf_user_role(array $u): string
{
    return (($u['method'] ?? '') === 'passphrase' && bf_config()['passphrase_role'] === 'viewer') ? 'viewer' : 'editor';
}

/** Write endpoints (save/upload): 403 read_only for viewer sessions. */
function bf_require_editor(array $u): void
{
    if (bf_user_role($u) !== 'editor') {
        bf_error(403, 'read_only', 'Passphrase sessions are read-only on this site; sign in with Google to edit');
    }
}

function bf_require_user(): array
{
    $u = bf_current_user();
    if ($u === null) {
        bf_error(401, 'unauthenticated', 'Login required');
    }
    return $u;
}

/** Establish an authenticated session (regenerates the id). */
function bf_login(array $user): void
{
    bf_session_start();
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'email'  => (string)$user['email'],
        'name'   => (string)($user['name'] ?? $user['email']),
        'method' => (string)$user['method'],
    ];
    $_SESSION['last'] = time();
    $_SESSION['loginAt'] = time();
}

function bf_session_payload(): array
{
    $cfg = bf_config();
    $u = bf_current_user();
    return [
        'authenticated' => $u !== null,
        'user'          => $u,
        'readOnly'      => $u !== null && $u['role'] !== 'editor',
        'authMethods'   => ['google' => bf_google_configured($cfg), 'passphrase' => bf_passphrase_configured($cfg)],
    ];
}

/**
 * Public /?auth_error= codes (the SPA maps exactly these):
 * bad_state, access_denied, domain, token, config, nonce, unverified.
 */
const BF_AUTH_ERRORS = ['bad_state', 'access_denied', 'domain', 'token', 'config', 'nonce', 'unverified'];

function bf_auth_error_code(string $internal): string
{
    $map = [
        'google_not_configured' => 'config', 'config' => 'config',
        'bad_state' => 'bad_state', 'state_expired' => 'bad_state',
        'access_denied' => 'access_denied',
        'domain_not_allowed' => 'domain', 'hd_mismatch' => 'domain', 'no_email' => 'domain',
        'email_unverified' => 'unverified',
        'bad_nonce' => 'nonce',
    ];
    return $map[$internal] ?? 'token'; // no_code, token_exchange_failed, token_invalid, bad_audience, bad_issuer, token_expired, other Google errors
}

/** "host[:port]" of an Origin/Referer URL, lowercased; null when unparsable. */
function bf_url_hostport(string $url): ?string
{
    $p = parse_url($url);
    if (!is_array($p) || empty($p['host'])) {
        return null;
    }
    return strtolower($p['host'] . (isset($p['port']) ? ':' . $p['port'] : ''));
}

function bf_same_origin_ok(array $server): bool
{
    $host = strtolower((string)($server['HTTP_HOST'] ?? ''));
    $origin = (string)($server['HTTP_ORIGIN'] ?? '');
    if ($origin !== '') {
        return $host !== '' && bf_url_hostport($origin) === $host;
    }
    $ref = (string)($server['HTTP_REFERER'] ?? '');
    if ($ref !== '') {
        return $host !== '' && bf_url_hostport($ref) === $host;
    }
    return true; // neither header present (non-browser client); X-BidForge header still required
}

/** State-changing endpoints: POST + X-BidForge: 1 + same-origin. */
function bf_require_csrf(): void
{
    bf_require_method('POST');
    if (($_SERVER['HTTP_X_BIDFORGE'] ?? '') !== '1') {
        bf_error(403, 'csrf', 'Missing X-BidForge header');
    }
    if (!bf_same_origin_ok($_SERVER)) {
        bf_error(403, 'csrf_origin', 'Cross-origin request refused');
    }
}

// ---------------------------------------------------------------------------
// Publish (agent-side sync) bearer token
// ---------------------------------------------------------------------------

function bf_bearer_token(): string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h === '' && function_exists('getallheaders')) {
        foreach ((array)getallheaders() as $k => $v) {
            if (strcasecmp((string)$k, 'Authorization') === 0) {
                $h = (string)$v;
            }
        }
    }
    return preg_match('/^Bearer\s+(\S+)$/i', trim((string)$h), $m) ? $m[1] : '';
}

/** sha256 hex (64 chars) or password_hash() of the token. */
function bf_token_matches(string $token, string $stored): bool
{
    $stored = trim($stored);
    if ($token === '' || $stored === '') {
        return false;
    }
    if (preg_match('/^[a-f0-9]{64}$/i', $stored)) {
        return hash_equals(strtolower($stored), hash('sha256', $token));
    }
    return password_verify($token, $stored);
}

function bf_require_publish_token(): void
{
    $cfg = bf_config();
    if (trim((string)$cfg['publish_token_hash']) === '') {
        bf_error(503, 'publish_disabled', 'publish_token_hash is not configured');
    }
    if (($wait = bf_rl_blocked('bearer', 20, 900)) > 0) {
        bf_error(429, 'rate_limited', 'Too many bad tokens', ['retryAfter' => $wait], ['Retry-After: ' . $wait]);
    }
    if (!bf_token_matches(bf_bearer_token(), (string)$cfg['publish_token_hash'])) {
        bf_rl_hit('bearer', 900);
        bf_error(401, 'invalid_token', 'Bearer token missing or invalid', [], ['WWW-Authenticate: Bearer']);
    }
}

// ---------------------------------------------------------------------------
// Google OAuth / OIDC
// ---------------------------------------------------------------------------

function bf_google_auth_url(array $cfg, string $state, string $nonce): string
{
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => $cfg['google_client_id'],
        'redirect_uri'  => $cfg['google_redirect_uri'],
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $state,
        'nonce'         => $nonce,
        'hd'            => $cfg['allowed_domains'][0] ?? 'ntxpllc.com',
        'prompt'        => 'select_account',
        'access_type'   => 'online',
    ], '', '&', PHP_QUERY_RFC3986);
}

/**
 * Validate ID-token claims (as returned by Google's tokeninfo endpoint).
 * Returns null when valid, else an error code string.
 */
function bf_validate_google_claims(array $claims, array $cfg, ?string $expectedNonce, ?int $now = null): ?string
{
    $now = $now ?? time();
    if (!hash_equals((string)$cfg['google_client_id'], (string)($claims['aud'] ?? ''))) {
        return 'bad_audience';
    }
    if (!in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) {
        return 'bad_issuer';
    }
    if (!isset($claims['exp']) || !is_numeric($claims['exp']) || (int)$claims['exp'] < $now) {
        return 'token_expired';
    }
    $ev = $claims['email_verified'] ?? false;
    if (!($ev === true || $ev === 'true')) {
        return 'email_unverified';
    }
    $email = strtolower(trim((string)($claims['email'] ?? '')));
    $at = strrpos($email, '@');
    if ($at === false || $at === 0) {
        return 'no_email';
    }
    $domain = substr($email, $at + 1);
    $allowed = array_map('strtolower', (array)$cfg['allowed_domains']);
    if (!in_array($domain, $allowed, true)) {
        return 'domain_not_allowed';
    }
    $hd = strtolower((string)($claims['hd'] ?? ''));
    if ($hd === '' || $hd !== $domain || !in_array($hd, $allowed, true)) {
        return 'hd_mismatch';
    }
    if ($expectedNonce === null || $expectedNonce === '' || !hash_equals($expectedNonce, (string)($claims['nonce'] ?? ''))) {
        return 'bad_nonce';
    }
    return null;
}

/** HTTP helper (curl, falling back to streams). Returns [status, body]. */
function bf_http(string $method, string $url, ?array $form = null): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];
        if ($method === 'POST') {
            $opts[CURLOPT_POST] = true;
            $opts[CURLOPT_POSTFIELDS] = http_build_query($form ?? []);
            $opts[CURLOPT_HTTPHEADER] = ['Content-Type: application/x-www-form-urlencoded'];
        }
        curl_setopt_array($ch, $opts);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return [$status, is_string($body) ? $body : ''];
    }
    $ctx = stream_context_create(['http' => [
        'method' => $method, 'timeout' => 15, 'ignore_errors' => true,
        'header' => $method === 'POST' ? "Content-Type: application/x-www-form-urlencoded\r\n" : '',
        'content' => $method === 'POST' ? http_build_query($form ?? []) : null,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $status = (int)$m[1];
        }
    }
    return [$status, is_string($body) ? $body : ''];
}
