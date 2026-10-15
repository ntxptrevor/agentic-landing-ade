# BidForge Schedules — server (schedule.ntxpllc.com)

PHP 8.x endpoints for the BidForge SPA on Hostinger shared hosting (Apache/LiteSpeed, no Node at runtime).
Everything here lives in `web/public/`, so `npm run build` copies it into `web/dist/` and from there into `docs/`.
This README itself is blocked from web access by `.htaccess`.

## 1. Deploy

1. Build and copy as usual: `cd web && npm run build`, then replace `docs/` with `web/dist/*` (including the dotfiles `.htaccess` and `.user.ini`).
2. In hPanel, create the subdomain **schedule.ntxpllc.com** and set its document root to the Git-deployed **`docs/`** folder.
3. Enable SSL for the subdomain. Once HTTPS works, you can uncomment the HSTS line in `docs/.htaccess` (`web/public/.htaccess`).
4. Use PHP 8.0 or newer (hPanel → Advanced → PHP Configuration). The `curl`, `openssl`, `fileinfo` and `zlib` extensions must be on (they are by default).

`.htaccess` also sends the site-wide **Content-Security-Policy** (script-src 'self', Google Fonts, data:/blob: images, same-origin XHR, `worker-src 'self' blob:` for the pdf.js module worker, `form-action 'self' https://accounts.google.com`), serves `.mjs` as `text/javascript` (module workers fail on `application/octet-stream`), caches hashed `assets/*-<hash>.js|mjs|css` for a year (`immutable`) and sends `index.html` with `no-cache`.
`.user.ini` turns `display_errors` off. Every endpoint also answers uncaught errors with a generic `500 {"error":"server_error"}`; details go only to the PHP error log.

## 2. Google OAuth client (primary login)

1. Google Cloud Console → a project owned by the ntxpllc.com Workspace → **OAuth consent screen** → User type **Internal**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: `https://schedule.ntxpllc.com/auth/callback.php`
3. Copy the client ID and secret into the config (step 3).

Sign-in sends `hd=ntxpllc.com`. The server verifies the ID token through Google's tokeninfo endpoint (sent in a POST body, never in a URL): `aud` must equal the client ID, plus `iss`, `exp` and `nonce`; `email_verified` must be true; and the email domain and `hd` claim must be in `allowed_domains`.

Login failures redirect to `/?auth_error=<code>`. The code is always one of:

| Code | Meaning |
| --- | --- |
| `bad_state` | state missing, forged or older than 10 min — start again |
| `access_denied` | the user cancelled at Google |
| `domain` | not an allowed Workspace account (email domain or `hd`) |
| `unverified` | Google says the email is not verified |
| `nonce` | nonce mismatch (replayed or foreign token) |
| `token` | code exchange / token verification failed (any other Google or token error) |
| `config` | Google sign-in is not configured on the server |

## 3. Private config (never in the repo — it is public)

Copy `config.sample.php` to **`bidforge-config.php` one level above the web root**. The server searches these paths in order and uses the first one it finds:

1. `<document root>/../bidforge-config.php`
2. `api/../../bidforge-config.php` (resolves to the same place)
3. the file named in the `BIDFORGE_CONFIG` environment variable
4. `$HOME/bidforge-config.php`

If the Git deploy directory sits inside `public_html`, the folder above `docs/` may still be reachable from the main domain. In that case use `$HOME/bidforge-config.php`, which is always outside `public_html`.

Generate the secrets in a terminal (SSH or locally):

```bash
# the team passphrase (set by the owner) — type it, press Enter; store ONLY the printed hash
php -r 'echo password_hash(trim(fgets(STDIN)), PASSWORD_DEFAULT), PHP_EOL;'
# publish token for the agent-side sync — keep the token secret, store its sha256
php -r '$t = bin2hex(random_bytes(32)); echo "token: $t", PHP_EOL, "sha256: ", hash("sha256", $t), PHP_EOL;'
```

Put the results in `passphrase_hash` and `publish_token_hash`. Give the token itself only to the BidForge sync agent.
If you leave `passphrase_hash` empty, passphrase login is turned off.

### Passphrase login — know the risk

The owner chose to keep a shared passphrase as the alternative to Google sign-in. It is weaker than Google sign-in in every way:

- **Anyone on the internet who guesses it is in.** There is no domain lock and no second factor. A short or common word (a dictionary word, the company name) can be guessed on the first few tries, and the hash in the config does not slow down online guessing.
- **No attribution.** Every passphrase user saves as the same `passphrase_user` identity. The changelog, activity stream, version index and `pending_sync` entries record `method: "passphrase"` so these edits can be told apart from Google sign-ins, but not from each other.
- **What limits the damage:**
  - `passphrase_role` — `'editor'` (default: can save and upload) or `'viewer'` (read-only: `save.php` and `upload.php` answer `403 read_only` for passphrase sessions). **Recommended: `'viewer'`**, so editing requires Google sign-in.
  - Per-IP limit: `login_max_attempts` failures per `login_window_sec` (10 / 15 min). The attempt is recorded atomically before the hash check, so parallel bursts cannot exceed it.
  - Global limit: `login_global_max_failures` failures across all IPs per window (30 / 15 min) lock passphrase login for everyone for `login_global_lockout_sec` (15 min) → `429 passphrase_locked`. Google sign-in is not affected. Rotating IPs therefore buys at most ~30 guesses per 15 min.
  - Sessions end after `session_idle_minutes` idle (240) and at most `session_max_hours` after login (12).
  - Every passphrase login is written to the PHP error log with the client IP.
- **Recommended:** a long random passphrase (four or more random words), `passphrase_role => 'viewer'`, and rotating it when someone leaves.

### Other settings

| Key | Default | Purpose |
| --- | --- | --- |
| `trusted_proxy_header` | `''` | Header with the real client IP (e.g. `X-Forwarded-For`, `CF-Connecting-IP`) when a proxy/CDN you control fronts the site. Empty = `REMOTE_ADDR` only; `X-Forwarded-For`/`X-Forwarded-Proto` from clients are then ignored. When set, the last valid IP in the header is used and `X-Forwarded-Proto` is trusted for HTTPS detection. |
| `trusted_proxies` | `[]` | Optional `REMOTE_ADDR` allow-list for the header above. |
| `session_idle_minutes` / `session_max_hours` | 240 / 12 | idle timeout / absolute lifetime (the legacy `session_lifetime` seconds key still sets the idle timeout). |
| `keep_plain_versions` | 20 | newest N snapshots stay `.json`; older ones are gzipped to `.json.gz` (still immutable, still served by `changes.php`). |

## 4. Data directory

Set `data_dir` to an **absolute path outside `public_html`**, for example `/home/u123456789/bidforge-data`. Create the folder and make it writable by PHP (`chmod 750`; Hostinger runs PHP as your user).
If `data_dir` is empty, the server uses `<web root>/../bidforge-data`. A data directory **inside the web root or document root is refused** (`500 data_dir_inside_webroot`) — the Git-deployed `docs/` folder is replaced on every deploy, which would wipe all schedules and sessions. The server also writes a deny-all `.htaccess` into the data dir it uses.

Layout: `kb/projects.json` (projects index) and `projects/<slug>/{canonical.json, versions/, changelog.md, activity_stream.json, uploads/, uploads.json, pending_sync.jsonl, live.html, live.json}`, plus `sessions/` and `ratelimit/` (files untouched for 24 h are deleted).
Back the directory up. It is the site's only state.

## 5. API summary

All endpoints take and return JSON. State-changing session endpoints require **POST + `X-BidForge: 1`** and a same-origin `Origin`/`Referer` when the browser sends one. The session cookie is HttpOnly and SameSite=Lax, and Secure on HTTPS.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/session.php` | none | `{authenticated, user:{email,name,method,role}, readOnly, authMethods}` |
| `POST /api/login.php` `{passphrase, name?}` | none (per-IP + global limits) | passphrase login; `429 rate_limited` / `429 passphrase_locked` |
| `POST /api/logout.php` | session | end session |
| `GET /auth/google.php[?next=/…]` → `/auth/callback.php` | none | Google login; errors → `/?auth_error=<code>` (§2) |
| `GET /api/projects.php[?all=1]` | session | index (bid/active by default); entries include `liveUrl`, `hostUrl`, `publishedVersion`, `siteSavedVersion` |
| `GET /api/project.php?slug=` | session | `canonical`, `version`, `hash`, `activity{critical,recent}`, `versions`, `uploads`, `hasLive`, `liveVersion`, `unpulled` |
| `POST /api/save.php` | session, editor | fork-guarded save (below) |
| `POST /api/upload.php` (multipart `slug`, `kind`, `files[]`) | session, editor | records include `url`, `by`, `method` |
| `GET /api/file.php?slug=&id=` | session | stream an upload |
| `GET /api/live.php?slug=` | session | generated live schedule HTML, served with `Content-Security-Policy: default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'self'; sandbox` (no scripts run) |
| `POST /api/publish.php` | Bearer | KB → site push (below) |
| `GET /api/changes.php?since=` / `POST {ack}` / `GET ?slug=&version=` | Bearer | site saves → KB pull (below) |

Version rule: the canonical's top-level `version`, or `meta.version` if there is none. `hash` is the sha256 of the stored `canonical.json` bytes. Send back the `version` and `hash` you loaded as `baseVersion` and `baseHash`. A new slug needs `baseVersion: null`.

### Save (site)

`POST /api/save.php {slug, name?, status?, canonical, baseVersion, baseHash?, reason, sources:[{type,title,url?,date}]}`
→ `200 {ok, slug, version, hash, liveUrl, activityAdded, slugRewritten?, canonicalSlugWas?}` · `409 {conflict, currentVersion, currentHash}` · `400 version_jump {maxVersion}` / `400 invalid_version` · `403 read_only`.

- The stored version is `max(stored+1, canonical.version)`, but `canonical.version` may not exceed the stored version plus the number of changelog entries added since the stored canonical (newer than its `generatedAt`, or beyond its changelog length), clamped to +1…+500; non-integers and values above 1,000,000 are refused.
- `canonical.project.slug`, when present, is rewritten to the routing slug (noted in the response and changelog).
- A site save is **not a publish**: it sets `sync.siteSavedVersion`/`siteSavedAt` and never lets `sync.publishedVersion` exceed the KB-published version in the index (`publishedVersion` is set only by `publish.php`).
- Writes `canonical.json`, an immutable snapshot, a `pending_sync.jsonl` entry (under the canonical lock), a `changelog.md` line, one activity line plus the canonical's per-change `activity[]` (merged, deduped on ts+text, links limited to http(s)/relative), and the index. Every line records `by` and `method`.
- An active project is never set back to `bid` by a save.

### Changes (site → KB pull)

```
GET /api/changes.php?since=<ISO-8601>[&project=<slug>]          (Bearer)
200 {"changes":[{"slug","version","hash","savedAt","by","method","reason",
                 "sources":[{type,title,url?,date}],"file",
                 "canonicalUrl":"/api/changes.php?slug=<slug>&version=<n>"}], "now"}
GET /api/changes.php?slug=<slug>&version=<n>                     → snapshot JSON (gz served decompressed)
POST /api/changes.php {"ack":[{"slug","version"}]}               → {"ok":true,"acked":n}
```

Only un-acknowledged site saves are listed, oldest first.

### Publish (KB → site)

```
POST /api/publish.php                                              (Bearer)
{"projects":[{slug, name, status, …index fields}],
 "bundles":[{"slug", "baseVersion": <stored version the KB last pulled, null for a new slug>,
             "baseHash": "<sha256 of that stored canonical>", "canonical": {…, "version": n},
             "reason"?, "sources"?, "activity_stream"?, "html"?, "htmlVersion"?}]}
200 {"ok":true, "projects":{upserted, invalid}, "results":[
  {"slug","ok":true,"status":200,"version","hash","activityAdded","live"?, "liveVersion"?}          accepted
  {"slug","ok":true,"status":200,"unchanged":true,"version","hash"}                                 identical
  {"slug","ok":false,"status":409,"conflict":true,"error":"stale_version|version_fork|base_mismatch|unpulled_site_saves",
   "currentVersion","currentHash","unpulled":[versions], "live":false, "liveError"?}                refused
  {"slug","ok":false,"status":400,"error":"invalid_version|version_jump|canonical_missing_version"}]}
```

Agent flow: `GET changes.php` → merge each listed version (fetch `canonicalUrl`) into the KB canonical as sync items → `POST changes.php {ack}` → `GET project.php` (or use the last publish result) for the current `version`/`hash` → publish with those as `baseVersion`/`baseHash`. Use the `hash` in the publish result as the next `baseHash`.
On publish the server merges the canonical's `activity[]`, adds one activity line and one dated `changelog.md` line (reason from the bundle or from the new changelog entries; their sources as markdown links), and sets the index `publishedVersion`. The KB's index `status`/`folder` win; a status change re-routes the folder.
`live.html` is written only when the bundle's canonical was accepted or unchanged (`htmlVersion`, if sent, must match it), or — for a bundle without a canonical — when `htmlVersion` equals the stored version; otherwise `live:false, liveError:"canonical_refused|html_version_mismatch|no_canonical"`.

## 6. Local testing

```bash
bash web/dev-server/smoke-test.sh [workdir] [port]   # fixture + two php -S servers (port, port+1) + end-to-end checks
php web/dev-server/test-google.php                   # OIDC, auth_error codes, version/slug/link helper unit tests
```

`web/dev-server/` (fixture, `php -S` router that emulates the `.htaccess` headers, tests) is not part of the build. The fixture's passphrase and token are dev-only values printed by `make-fixture.php`.
