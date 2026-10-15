# Council audit #3 — BidForge program (2026-10-15)

Three independent seats (A Opus, B Fable, C Sonnet; high effort) audited the whole program —
skill, web app, PHP server for schedule.ntxpllc.com, hooks and manifests — against fifteen user
requirements (R1–R15) plus a security review. Each seat built, ran the server smoke test, and
reproduced its findings with probes. 111 findings in total (A 39, B 27, C 45).

## Verdicts before fixes

| Req | A | B | C |
|---|---|---|---|
| R1 | PARTIAL | PARTIAL | PARTIAL |
| R2 | PARTIAL | PARTIAL | PARTIAL |
| R3 | PARTIAL | PARTIAL | PARTIAL |
| R4 | FAIL | FAIL | PARTIAL |
| R5 | PARTIAL | PARTIAL | PARTIAL |
| R6 | FAIL | FAIL | PARTIAL |
| R7 | PARTIAL | PARTIAL | PARTIAL |
| R8 | PARTIAL | PARTIAL | PARTIAL |
| R9 | FAIL | FAIL | PARTIAL |
| R10 | PARTIAL | PARTIAL | PARTIAL |
| R11 | FAIL | PARTIAL | PARTIAL |
| R12 | FAIL | FAIL | FAIL |
| R13 | PARTIAL | PARTIAL | PARTIAL |
| R14 | PARTIAL | PARTIAL | PARTIAL |
| R15 | PARTIAL | PARTIAL | PARTIAL |

R1 live editable HTML · R2 11x17 Document Engine · R3 Coda live link · R4 no forks · R5 integration
· R6 conversation capture + sourced changelog + folder routing · R7 self-learning · R8 efficiency ·
R9 logic loops · R10 program logic · R11 sync logic · R12 env scan + identifier crosswalk ·
R13 changelog + KB activity stream · R14 OAC forced update · R15 cloud front end.

## What was fixed (≥ 2 seats, or reproduced by one seat)

| Area | Fix | Seats |
|---|---|---|
| Forks (R4) | Site publish requires per-bundle baseVersion/baseHash and is refused while site saves are unpulled; live.html only written for accepted bundles; absurd version jumps 400 | A B C |
| Logic loops (R9) | Dependency cycles detected (tasks flagged, dates kept, `wouldCreateCycle`); invalid dates can no longer hang the tab (guarded parsers, iteration caps) | A B C |
| Row drag (R1/R10) | Keeps link types and lags, never drops constraints or actuals (asks first), header drop to first row, ids stay unique, every shifted task logged | A C |
| Sync (R11) | Held JEV ≥ 4 items can be acknowledged/applied/dismissed; bundle project/version checks; idempotent apply; unknown tasks logged as skipped; unapproved milestone moves tracked, not applied; earlier JobTread edits surfaced | A B C |
| OAC (R14) | OAC report no longer bumps the version; published = KB-published version only; unpulled site saves fail the gate (app, CLI, hook) | A B C |
| Changelog/activity (R6/R13) | Every entry carries sources with links; per-change activity merged into the KB activity stream on save and publish; publish writes a sourced changelog line; CHG ids from a counter | A B C |
| Hook (R5/R6) | Scored router: 100% precision/recall on a 66-prompt fixture (was 7 of 17 realistic statements); OAC wording triggers the gate step | A B C |
| Coda (R3) | Markers never cut; essential links kept whole; refuses with a clear rating when team notes leave no room (JobTread 1,024-char limit) | A B C |
| Crosswalk (R12) | New deterministic `crosswalk.mjs` (resolve/verify links with confidence, ambiguity never auto-picked), `env_scan.mjs` with a sources registry that records newly discovered sources, `write_guard.mjs` before every external write | A B C |
| Self-learning (R7) | `lessons_metrics.mjs` drift metrics per lesson + `lesson_toggle.mjs` | A B |
| Efficiency (R8) | CPM indexed (2,000 activities 182 → 33 ms; 2,675 291 → 35 ms); throttled local saves; split vendor/data chunks | A B C |
| 11x17 (R2) | 0.5 in margins on every side, header band repeats on every page, app chrome hidden in print, page number bold italic navy | A B |
| Security | CSP on the SPA and on live HTML (sandboxed); scheme-checked links; no innerHTML; atomic rate limiter + global passphrase lockout; viewer role; session lifetime; generic 500s; data dir never inside the web root | A B C |
| Deploy (R15) | `docs/` rebuilt with the PHP server, .htaccess and .user.ini; .mjs MIME; immutable asset caching | A B C |

## Open items for the user

1. **Team passphrase** — all three seats rate the chosen passphrase critical because it is guessable
   and was published in the repo. It is kept (user decision) with a global lockout, an optional
   read-only role (`passphrase_role: viewer`), and the literal removed from public docs. Recommended:
   set a different passphrase, or the viewer role.
2. UTSW-02 Ash Vault benchmark still 31 WD vs 14–26 (fixed AHJ notice tail; see audit #2).
3. Hosting: point schedule.ntxpllc.com at the Git-deployed `docs/`, create the Google OAuth client and
   the private config (web/public/api/README.md).

Tests after fixes: engine + canonical 44/44 and 20/20, skill 47/47, hook fixture 70/70, server smoke
129/129, Google auth unit 58/58, schedule audit unchanged, end-to-end browser flow passing.
Seat reports are kept outside this public repository (private NTXP Forge backup).
