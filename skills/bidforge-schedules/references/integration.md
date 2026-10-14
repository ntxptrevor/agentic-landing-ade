# Integration, hooks and conversation capture

The canonical schedule (`bidforge.canonical.v1`) is the **single source of truth** for every NTXP
project schedule. This page is the workspace-level contract. It covers how any tool, skill or
agent reads the schedule, how schedule conversations are captured into it, and the rules that
keep it from forking.

```
 any tool / skill / agent ──► schedule_query.mjs ──► canonical.json  (read-only, deterministic)
 any conversation ──► schedule_router hook ──► bidforge input + sourced changelog entry ──► new version
 OAC report request ──► oac_gate.mjs ──fail──► /bidforge-schedules --sync <project> ──► gate again
 schedule.ntxpllc.com ◄──publish.php── KB canonical ──changes.php──► next sync (pending_sync items)
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

`hooks/schedule_router.mjs` is a Claude Code **UserPromptSubmit** hook. It is registered two ways:

- **Plugin:** `.claude-plugin/plugin.json` → `"hooks": "./skills/bidforge-schedules/hooks/hooks.json"`,
  command `node "${CLAUDE_PLUGIN_ROOT}/skills/bidforge-schedules/hooks/schedule_router.mjs"`.
- **This repo:** `.claude/settings.json`, command `node "$CLAUDE_PROJECT_DIR/skills/bidforge-schedules/hooks/schedule_router.mjs"`.
  If the plugin is also enabled in this repo, the context is injected twice, which does no harm.

The hook reads `{prompt, session_id, cwd, …}` from stdin. It only acts on schedule prompts, which it
detects with word-bounded, case-insensitive matching:

- **Strong terms** (one is enough): Gantt, CPM, critical path, look-ahead, milestone, substantial
  completion, NTP, notice to proceed, recovery/baseline/project schedule, schedule update/impact,
  MSPDI, .mpp, MS Project, OAC, pay-app schedule, time extension, liquidated damages, weather days,
  total/free float, behind/ahead of schedule, WBS, BidForge.
- **Weak terms** (schedule, duration, delay, slip, sequence, float, baseline, lead time, work days):
  these count only with construction context (trade, inspection, sub, owner, job, phase…) or with
  another weak term.
- **Not routed:** calendar talk such as "schedule a meeting/call/appointment" or "calendar invite".

For a schedule prompt it prints `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}`
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
node skills/bidforge-schedules/scripts/oac_gate.mjs <canonical.json> [--max-age-hours 24] [--json]
```

The gate exits 0 only when all three of these hold:

1. The schedule was synced (`sync.lastFullSyncAt` or `sync.lastSyncAt`) within the window (default 24 h).
2. No pending item rated JEV ≥ 4 is still unacknowledged. Pending items are read from
   `sync.pending` / `pendingItems` / `pending_sync`, plus changelog entries with `acknowledged:false`.
3. The published version (`sync.publishedVersion`, or `sync.lastPublish.version`) equals the canonical `version`.

If any check fails, the gate prints the reasons and exits 2 with
`Run /bidforge-schedules --sync <project> before generating the OAC report`. Run the full sync,
resolve the gated items, republish, then run the gate again. `schedule_query … oac` runs the same
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
- **Hosted site** `https://schedule.ntxpllc.com` (API built separately):
  - Edits made on the site are saved as new versions with `pending_sync` entries.
  - `GET /api/changes.php?project=<slug>&since=<version>` returns those entries. The next sync
    pulls them into the KB canonical as sync items, so they enter through the changelog like any
    other source.
  - `POST /api/publish.php` pushes the KB canonical back to the site with `baseVersion`/`baseHash`.
    The site rejects the push if its version moved, and the agent then pulls and reconciles first.
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
