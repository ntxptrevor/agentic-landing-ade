# BidForge Schedules — server (schedule.ntxpllc.com)

PHP 8.x endpoints for the BidForge SPA on Hostinger shared hosting (Apache/LiteSpeed, no Node at runtime).
Everything here lives in `web/public/`, so `npm run build` copies it into `web/dist/` and from there into `docs/`.
This README itself is blocked from web access by `.htaccess`.

## 1. Deploy

1. Build and copy as usual: `cd web && npm run build`, then replace `docs/` with `web/dist/*` (including the dotfiles `.htaccess` and `.user.ini`).
2. In hPanel, create the subdomain **schedule.ntxpllc.com** and set its document root to the Git-deployed **`docs/`** folder.
3. Enable SSL for the subdomain. Once HTTPS works, you can uncomment the HSTS line in `docs/.htaccess` (`web/public/.htaccess`).
4. Use PHP 8.0 or newer (hPanel → Advanced → PHP Configuration). The `curl`, `openssl` and `fileinfo` extensions must be on (they are by default).

## 2. Google OAuth client (primary login)

1. Google Cloud Console → a project owned by the ntxpllc.com Workspace → **OAuth consent screen** → User type **Internal**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: `https://schedule.ntxpllc.com/auth/callback.php`
3. Copy the client ID and secret into the config (step 3).

Sign-in sends `hd=ntxpllc.com`. The server also checks the ID token through Google's tokeninfo endpoint: `aud` must equal the client ID, plus `iss`, `exp` and `nonce`; `email_verified` must be true; and the email domain and `hd` claim must be in `allowed_domains`.

## 3. Private config (never in the repo — it is public)

Copy `config.sample.php` to **`bidforge-config.php` one level above the web root**. The server searches these paths in order and uses the first one it finds:

1. `<document root>/../bidforge-config.php`
2. `api/../../bidforge-config.php` (resolves to the same place)
3. the file named in the `BIDFORGE_CONFIG` environment variable
4. `$HOME/bidforge-config.php`

If the Git deploy directory sits inside `public_html`, the folder above `docs/` may still be reachable from the main domain. In that case use `$HOME/bidforge-config.php`, which is always outside `public_html`. The config is a PHP file that prints nothing, but keeping it out of reach is safer.

Generate the secrets in a terminal (SSH or locally):

```bash
# passphrase login ("admin", as chosen) — store ONLY the hash
php -r 'echo password_hash("admin", PASSWORD_DEFAULT), PHP_EOL;'
# publish token for the agent-side sync — keep the token secret, store its sha256
php -r '$t = bin2hex(random_bytes(32)); echo "token: $t", PHP_EOL, "sha256: ", hash("sha256", $t), PHP_EOL;'
```

Put the results in `passphrase_hash` and `publish_token_hash`. Give the token itself only to the BidForge sync agent.
If you leave `passphrase_hash` empty, passphrase login is turned off.

## 4. Data directory

Set `data_dir` to an **absolute path outside `public_html`**, for example `/home/u123456789/bidforge-data`. Create the folder and make it writable by PHP (`chmod 750`; Hostinger runs PHP as your user).
If `data_dir` is empty, the server uses `<web root>/../bidforge-data` when that is writable. Otherwise it falls back to `docs/api/data/`, which a deny-all `.htaccess` protects. The server also writes a deny-all `.htaccess` into any data dir it uses.

Layout: `kb/projects.json` (projects index) and `projects/<slug>/{canonical.json, versions/, changelog.md, activity_stream.json, uploads/, uploads.json, pending_sync.jsonl, live.html}`, plus `sessions/` and `ratelimit/`.
Back the directory up. It is the site's only state.

## 5. API summary

All endpoints take and return JSON. State-changing session endpoints require **POST + `X-BidForge: 1`** and a same-origin `Origin`/`Referer` when the browser sends one. The session cookie is HttpOnly and SameSite=Lax, and Secure on HTTPS.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/session.php` | none | `{authenticated, user, authMethods}` |
| `POST /api/login.php` `{passphrase, name?}` | none (10 failures / 15 min / IP) | passphrase login |
| `POST /api/logout.php` | session | end session |
| `GET /auth/google.php[?next=/…]` → `/auth/callback.php` | none | Google login; errors → `/?auth_error=<code>` |
| `GET /api/projects.php[?all=1]` | session | index (bid/active by default); entries include `liveUrl`, `hostUrl` |
| `GET /api/project.php?slug=` | session | `canonical`, `version`, `hash`, `activity{critical,recent}`, `versions`, `uploads` |
| `POST /api/save.php` | session | fork-guarded save → `{ok, version, hash, liveUrl}` or 409 `{conflict, currentVersion, currentHash}` |
| `POST /api/upload.php` (multipart `slug`, `kind`, `files[]`) | session | records include `url` |
| `GET /api/file.php?slug=&id=` | session | stream an upload |
| `GET /api/live.php?slug=` | session | generated live schedule HTML |
| `POST /api/publish.php` | Bearer | KB → site push; stale bundles are refused with a 409 in their result |
| `GET /api/changes.php?since=` / `POST {ack}` / `GET ?slug=&version=` | Bearer | site saves → KB pull |

Version rule: the canonical's top-level `version`, or `meta.version` if there is none. `hash` is the sha256 of the stored `canonical.json` bytes. Send back the `version` and `hash` you loaded as `baseVersion` and `baseHash`. A new slug needs `baseVersion: null`.

## 6. Local testing

```bash
bash web/dev-server/smoke-test.sh          # fixture + php -S + 74 end-to-end checks
php web/dev-server/test-google.php         # OIDC URL + claim-validation unit tests
```

`web/dev-server/` (fixture, `php -S` router, tests) is not part of the build.
