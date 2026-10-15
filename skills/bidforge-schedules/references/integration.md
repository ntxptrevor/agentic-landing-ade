# Integration, hooks and conversation capture

The canonical schedule (`bidforge.canonical.v1`) is the **single source of truth** for every NTXP
project schedule. This page is the workspace-level contract. It covers how any tool, skill or
agent reads the schedule, how schedule conversations are captured into it, and the rules that
keep it from forking.

```
 any tool / skill / agent ──► schedule_query.mjs ──► canonical.json  (read-only, deterministic)
 any conversation ──► schedule_router hook ──► bidforge input + sourced changelog entry ──► new version
 OAC report request ──► oac_gate.mjs ──fail──► /bidforge-schedules --sync <project> ──► gate again
 schedule.ntxpllc.com ◄──publish.php (per-bundle baseVersion/baseHash)── KB canonical
 schedule.ntxpllc.com ──changes.php?since=<ISO> (pending saves)──► next sync ──POST ack──► site
 env_scan.mjs plan ──► connector calls ──► scan.json ──► crosswalk.mjs resolve|verify ──► canonical links
```

## 1 · Querying the schedule (all tools)

Never re-derive dates, float or the critical path from a PDF, a Drive copy or memory. Read the
canonical file (`<KB>/schedule/canonical.json`) with the deterministic CLI:

```
node skills/bidforge-schedules/scripts/schedule_query.mjs <canonical.json> <command> [args] [--json]
     [--today YYYY-MM-DD] [--activity <KB>/activity_stream.json] [--max-age-hours 24]
```

| Command | Returns |
|---|---|
| `summary` | project, version (and published version), SC forecast vs contract with variance in calendar days, duration-weighted % complete, open critical count, late count, last sync, pending items (JEV ≥ 4 count), last change |
| `lookahead [weeks=3]` | open tasks active or starting in each week of the window (Monday-based), critical flagged `[CP]`, milestones `◆` |
| `milestones` | every milestone: forecast, contract date, variance |
| `critical` | open critical-path tasks |
| `task <id or name substring>` | detail: plan, actuals, float, contract date, predecessors, successors, notes |
| `late` | `endDate < today` and under 100 %, or milestone variance > 0 |
| `changes [since ISO]` | changelog entries (default: last 30 days), newest first, with sources and hyperlinks |
| `activity [n=20]` | the project activity stream, from `meta.activity` or the KB file given with `--activity` |
| `oac` | ready-to-paste OAC schedule section; **refuses with exit 3** if the OAC gate fails |

Markdown is the default (paste-ready). `--json` returns `{command, project, version, asOf, result}`
for programs. Missing fields degrade to `n/a` / empty lists. Both the flat document written by
`buildCanonicalDocument` and a nested `{meta:{…}, project:{wbs}}` shape are accepted. Exit codes:
0 ok, 1 usage or unreadable file, 3 OAC gate failed.

Examples:

```bash
Q=skills/bidforge-schedules/scripts/schedule_query.mjs
node $Q "$KB/schedule/canonical.json" summary
node $Q "$KB/schedule/canonical.json" lookahead 3            # 3-week look-ahead for a daily report
node $Q "$KB/schedule/canonical.json" task "partitions"      # when do partitions install?
node $Q "$KB/schedule/canonical.json" changes 2026-10-01 --json
node $Q "$KB/schedule/canonical.json" activity 10 --activity "$KB/activity_stream.json"
```

Consumers include the OAC dashboard, the project command center, the pay-app / SOV skills (percent
complete), daily reports, ITB briefs (look-ahead) and any agent answering "when is …".

## 2 · The schedule router hook

`hooks/schedule_router.mjs` is a Claude Code **UserPromptSubmit** hook. It is registered in two places:

- **Plugin:** the `bidforge-schedules` entry in `.claude-plugin/marketplace.json` carries
  `"hooks": "./skills/bidforge-schedules/hooks/hooks.json"`. That file runs
  `node "${CLAUDE_PLUGIN_ROOT}/skills/bidforge-schedules/hooks/schedule_router.mjs"`. The root
  `.claude-plugin/plugin.json` lists skills only and does **not** register the hook. Installing
  another plugin from the same `./` source, such as `landing-ade`, does not load it either.
- **This repo:** `.claude/settings.json` runs
  `node "$CLAUDE_PROJECT_DIR/skills/bidforge-schedules/hooks/schedule_router.mjs"`, so the hook
  also works when the plugin is not installed.
- **Double registration:** with the plugin enabled *inside this repo*, both registrations fire and
  the same context is injected twice. This is harmless, because the text is identical and the hook
  never blocks. To avoid it, disable one of the two.

The hook reads `{prompt, session_id, cwd, …}` from stdin and scores the prompt. Matching is
word-bounded and case-insensitive, except for milestone abbreviations:

| Signal | Examples | Score |
|---|---|---|
| Strong schedule term | Gantt, CPM, critical path, look-ahead, milestone, substantial completion, NTP, recovery/baseline/project schedule, schedule update, MSPDI, .mpp, MS Project, OAC, time extension, LDs, weather days, float, behind/ahead of schedule, WBS, BidForge | +5 |
| Construction activity × time/progress signal | activity: trades, work items, inspections, permits, deliveries, mobilization, punch walk, pay app, CSI terms, SC/FC/TCO; time: dates, weekdays, today, *N days/weeks*, behind/ahead/late, slip, moved, pushed back, passed/failed, rained out, ships, delivered, start/finish, percent complete, "when is…" | +3 |
| "schedule" as a noun (the/our/this schedule, update the schedule) | | +3 |
| Weak schedule word next to an activity | duration, delay, sequence, lead time, work days | +2 |
| Calendar or meeting talk | schedule/book/send/move a meeting, call, appointment or email; calendar invite; dentist; flight; 1:1. Not applied when OAC is mentioned. | −4 |
| Code questions, personal errands | Python, function, cron, API… / Netflix, movie, my car, gym… | −4 each |

A prompt with a score of 3 or more is routed. OAC plus report, agenda, minutes, narrative, notes,
recap, prep or meeting (in either order) adds the **gate step** to the context. The contract is a
labelled fixture of 66 prompts in `hooks/router.test.mjs`. It contains the council audit #3 probes
(for example "inspection passed today", "owner moved SC to 12/20", "the AHU ships 3 weeks late",
"pour got rained out" and "OAC narrative for Thursday") and false positives that must stay silent
("schedule a meeting with Bob tomorrow", "schedule the email for 9am", "calendar invite",
"duration of the Netflix show", Python questions). The test asserts recall ≥ 95 % and zero false
positives, and prints precision and recall.

For a routed prompt the hook prints `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}`
(about 1 kB), which restates rules 3 to 6 below. On anything else, including errors, it exits 0
silently and never blocks the prompt.

## 3 · Conversation-capture rule

Any schedule **fact, decision or date** stated in a conversation (for example "drywall slipped
3 days", "owner moved SC to 12/20" or "inspection passed today") is captured as an input to the
canonical schedule. Use bidforge input mode (`recordInput` + `applySyncItems` / `logChange`).
Do not just answer it.

- The input is saved to `<KB>/schedule/inputs/<date>-conversation-<topic>.md`.
- The changelog entry's `sources[]` lists the conversation, as
  `{type:'conversation', title:'Claude session <session_id> (<YYYY-MM-DD> UTC)', link:'<session URL if known>'}`.
  It also lists every file, email, meeting or recording referenced, each with its hyperlink.
- Milestone moves remain variance until the user approves them (SKILL.md hard rule 4). Inputs that
  touch protected or critical items are rated JEV 4–5 and wait for acknowledgement.
- Never edit the Drive, JobTread or hosted copies directly. They are regenerated from canonical.

## 4 · OAC forced-update rule

**Every** OAC report, agenda or minutes generation starts with:

```bash
curl -sS -H "Authorization: Bearer $BIDFORGE_SITE_TOKEN" "https://schedule.ntxpllc.com/api/changes.php?since=<lastSyncAt>" > changes.json
node skills/bidforge-schedules/scripts/oac_gate.mjs <canonical.json> --changes changes.json [--max-age-hours 24] [--json]
```

The gate exits 0 only when all four of these hold:

1. The schedule was synced (`sync.lastFullSyncAt` or `sync.lastSyncAt`) within the window (default 24 h).
2. No pending item rated JEV ≥ 4 is still unacknowledged. Pending items are read from
   `sync.pending` / `pendingItems` / `pending_sync`, plus changelog entries with `acknowledged:false`.
3. The **KB-published** version (`sync.publishedVersion`, or `sync.lastPublish.version`) equals the
   canonical `version`. Only the agent publish sets `publishedVersion`, after the KB, Drive and
   JobTread writes are verified. A save on the hosted site sets `sync.siteSavedVersion` and
   never counts as published.
4. There are **no unpulled site saves**. Every pending entry for this project in `--changes`
   (the output of `GET /api/changes.php`) must have been pulled into the KB canonical and
   acknowledged, and `sync.siteSavedVersion` must not be newer than `sync.publishedVersion`.

If any check fails, the gate prints the reasons and exits 2 with
`Run /bidforge-schedules --sync <project> before generating the OAC report`. Run the full sync
(pull the site saves too), resolve the gated items, republish, then run the gate again. `schedule_query … oac` runs the same
gate and refuses (exit 3) rather than produce a stale OAC section. Writers should set
`sync.publishedVersion` on each publish, `sync.lastFullSyncAt` on each full sync and
`sync.lastOacAt` after each OAC, which scopes the "changes since last OAC" list.

## 5 · Folder routing (ntxp-folder-system)

| Project status | Drive location | KB |
|---|---|---|
| Pursuit (`scope.status` = `bid`, or no project folder yet) | bid folder `Schedules/`, with `links.driveFolderName` marked `(bid)` | `<KB>/schedule/` |
| Awarded | project folder `06 - Schedule/` | `<KB>/schedule/` |

When a pursuit is awarded, the next publish writes to `06 - Schedule/`. The bid-folder copies stay
as history. Versions are **immutable** snapshots `versions/v<NNN>-<YYYY-MM-DD>.json`, with Drive
files named `<slug>_Schedule_v<N>_<date>.pdf|xml|html`. Never overwrite a published version.

## 6 · Version control and the no-fork rule

- Always load the **latest** canonical version before changing anything. Every save carries
  `baseVersion` (the version you loaded) and `baseHash` (sha-256 of the loaded canonical JSON).
- A save whose `baseVersion` is not the current version is a **conflict**. Reconcile it: reload
  latest, re-apply your inputs as changelog items and re-rate them. Never overwrite and never save
  a parallel copy.
- **Hosted site** `https://schedule.ntxpllc.com` (API built separately; bearer token from ntxp-id):
  - A save on the site writes a new site version and a pending entry, and sets
    `sync.siteSavedVersion`. It is **not** a publish.
  - `GET /api/changes.php?since=<ISO>` returns the pending, un-acknowledged saves newer than
    `since`: `{changes:[{slug, version, hash, savedAt, by, reason, sources, canonicalUrl}]}`.
    Omit `since` to get all of them. The next sync pulls each save into the KB canonical as sync
    items, so site edits enter through the changelog like any other source. Then
    `POST /api/changes.php {ack:[{slug, version}]}` acknowledges the pulled entries.
  - `POST /api/publish.php` pushes KB bundles to the site. **Each bundle carries its own
    `baseVersion` and `baseHash`** (the site version and hash the agent last pulled). The site
    refuses a bundle (409) whose base is not its current version, and **refuses every publish while
    the project has unpulled site saves**. Pull, reconcile and ack first, then publish again.
  - Before writing, check the site with `write_guard.mjs check <canonical> site --observed-version <site version>`
    (canonical-and-offramp.md § 7).
  - Both directions are guarded by version, so neither side can silently overwrite the other.

## 7 · Changelog and source rules

Every changelog entry carries:

| Field | Rule |
|---|---|
| `at` | ISO date-time, UTC |
| `type` | change type (`duration_change`, `add_event`, `milestone_move`, `conversation_input`, …) |
| `sources[]` | at least one `{type, title, link}`: type is one of conversation, email, meeting, recording, daily_log, jobtread, drive, site, rfi, submittal |
| `link` | a hyperlink for every source that has one (Gmail thread, Drive file, Plaud recording, JobTread log, session URL) |
| `reason`, `jevRating`, `target` | as in `canonical.js logChange` |

`schedule_query changes` prints these as `[type: title](link)`, ready for minutes and reports.

## 8 · KB activity stream

Every changelog entry is also appended to the project KB `activity_stream.json`, using the NTXP
Plans-Atlas activity-stream schema:

```json
{ "ts": "2026-10-12T15:00:00Z", "source": "schedule", "kind": "event",
  "text": "v42 CHG-0137 Drywall tape & finish +3 WD (super, conversation 2026-10-12)",
  "link": "https://schedule.ntxpllc.com/<slug>#CHG-0137" }
```

The stream is append-only, with one line per CHG id and `text` starting with the version and CHG id.
`schedule_query … activity --activity <KB>/activity_stream.json` reads it.

## 9 · Paste into workspace instructions

An admin can paste this block into the claude.ai project or organization instructions:

```
Construction schedules: the BidForge canonical schedule (<KB>/schedule/canonical.json) is the single
source of truth for every NTXP project. Use the bidforge-schedules skill. Read schedule facts with
`node skills/bidforge-schedules/scripts/schedule_query.mjs <canonical.json> summary|lookahead|late|task <q>`
and never re-derive them from PDFs or copies. Log any schedule fact, decision or date stated in a
conversation as a canonical input, with a changelog entry citing the conversation (session id, UTC
date) and links to the emails, files and meetings referenced. Never edit Drive, JobTread or site copies
directly. Pursuits save to the bid folder Schedules/, awarded jobs to 06 - Schedule/, and versions are
immutable. Before any OAC report, agenda or minutes, run oac_gate.mjs; if it fails, run
/bidforge-schedules --sync <project> first.
```

## 10 · Environment scan, crosswalk and write guard

Project identifiers (JobTread job and number, Drive bid/project folders, Lightfield, QuickBooks,
KB path, site slug) are resolved by deterministic code. `env_scan.mjs` prints the connector
calls, `crosswalk.mjs resolve|verify` scores the results, and ambiguous matches are never
auto-picked. See `references/environment-scan-and-crosswalk.md`. Before every write to a derived
copy (Drive, JobTread, Lightfield, site, KB), run `write_guard.mjs check`. It refuses with exit 2
to write a canonical older than the target already holds (canonical-and-offramp.md § 7).
