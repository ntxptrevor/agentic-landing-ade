<?php
/**
 * BidForge Schedules — shared server library (schedule.ntxpllc.com).
 *
 * Included by every endpoint in /api and /auth. Has NO side effects on
 * include (no output, no session start) so it can be unit-tested from the CLI.
 * Requires PHP 8.0+. Config lives OUTSIDE the web root — see config.sample.php.
 */
declare(strict_types=1);

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
        'session_name'         => 'BFSESSID',
        'session_lifetime'     => 43200,   // 12 h idle timeout
        'cookie_secure'        => null,    // null = auto (secure when the request is HTTPS)
        'max_upload_mb'        => 50,
        'max_save_mb'          => 15,
        'max_publish_mb'       => 60,
        'login_max_attempts'   => 10,
        'login_window_sec'     => 900,
    ];
    $cfg = array_merge($defaults, $loaded);
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

function bf_client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function bf_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
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
    $d = rtrim(trim((string)$cfg['data_dir']), '/');
    if ($d === '') {
        $webroot = dirname(__DIR__);
        $primary = dirname($webroot) . '/bidforge-data';
        if ((is_dir($primary) && is_writable($primary)) || (!is_dir($primary) && is_writable(dirname($webroot)) && bf_mkdir($primary))) {
            $d = $primary;
        } else {
            $d = __DIR__ . '/data';
        }
    }
    if (!bf_mkdir($d) || !is_writable($d)) {
        bf_error(500, 'data_dir_unwritable', 'Data directory is missing or not writable');
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
    foreach (scandir($vdir) ?: [] as $f) {
        if (!preg_match('/^v(\d+)-(\d{4}-\d{2}-\d{2})\.json$/', $f, $m)) {
            continue;
        }
        $info = is_array($meta[$f] ?? null) ? $meta[$f] : [];
        $out[] = [
            'version' => (int)$m[1],
            'file'    => $f,
            'savedAt' => $info['savedAt'] ?? gmdate('Y-m-d\TH:i:s\Z', (int)filemtime($vdir . '/' . $f)),
            'by'      => $info['by'] ?? null,
            'reason'  => $info['reason'] ?? null,
        ];
    }
    usort($out, static fn($a, $b) => $b['version'] <=> $a['version']);
    return $out;
}

/** Write an immutable version snapshot (never overwrites an existing file). */
function bf_version_write(string $slug, int $version, string $json, string $by, ?string $reason): string
{
    $vdir = bf_project_dir($slug) . '/versions';
    bf_mkdir($vdir);
    foreach (scandir($vdir) ?: [] as $f) {
        if (preg_match('/^v0*' . $version . '-\d{4}-\d{2}-\d{2}\.json$/', $f)) {
            return $f; // already snapshotted — immutable
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
    bf_with_lock($vdir . '/index.json', static function () use ($vdir, $file, $by, $reason) {
        $idx = bf_read_json($vdir . '/index.json', []);
        $idx[$file] = ['savedAt' => bf_now(), 'by' => $by, 'reason' => $reason];
        bf_write_atomic($vdir . '/index.json', bf_encode_store($idx));
    });
    return $file;
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

/** Merge entries (dedupe on ts+source+kind+text). */
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
            if (!is_array($e) || !isset($e['ts'], $e['text'])) {
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
    return hash('sha256', json_encode([$e['ts'] ?? '', $e['source'] ?? '', $e['kind'] ?? '', $e['text'] ?? '']));
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
    $folder = (is_array($e['folder'] ?? null) && isset($e['folder']['kind'], $e['folder']['path']))
        ? ['kind' => (string)$e['folder']['kind'], 'path' => (string)$e['folder']['path']]
        : bf_folder_for($status, $name);
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

function bf_rl_path(string $bucket): string
{
    return bf_data_dir() . '/ratelimit/' . $bucket . '-' . hash('sha256', bf_client_ip()) . '.json';
}

/** Seconds until allowed again, or 0 if not blocked. */
function bf_rl_blocked(string $bucket, int $max, int $window): int
{
    $hits = array_filter((array)bf_read_json(bf_rl_path($bucket), []), static fn($t) => is_int($t) && $t > time() - $window);
    if (count($hits) < $max) {
        return 0;
    }
    sort($hits);
    return max(1, $hits[count($hits) - $max] + $window - time());
}

function bf_rl_hit(string $bucket, int $window): void
{
    $p = bf_rl_path($bucket);
    bf_with_lock($p, static function () use ($p, $window) {
        $hits = array_values(array_filter((array)bf_read_json($p, []), static fn($t) => is_int($t) && $t > time() - $window));
        $hits[] = time();
        bf_write_atomic($p, json_encode($hits));
    });
}

function bf_rl_clear(string $bucket): void
{
    @unlink(bf_rl_path($bucket));
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
    $life = (int)$cfg['session_lifetime'];
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
        if (time() - (int)($_SESSION['last'] ?? 0) > $life) {
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
    return is_array($u) ? $u : null;
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
    return [
        'authenticated' => bf_current_user() !== null,
        'user'          => bf_current_user(),
        'authMethods'   => ['google' => bf_google_configured($cfg), 'passphrase' => bf_passphrase_configured($cfg)],
    ];
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
