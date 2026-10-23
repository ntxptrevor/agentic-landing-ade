# Canonical schedule and off-ramp

```
                 ┌────────────── canonical.json (bidforge.canonical.v1) ──────────────┐
                 │ schedule · requirements · modules · trackers · inputs · changelog │
                 └───────┬───────────────────────┬──────────────────────────┬────────┘
     Knowledge base (md + json)      Drive project folder          JobTread job (Pave)
     original · inputs · changelog   11x17 PDF · MSPDI XML · HTML   task dates / progress
                 ▲                                                          │
                 └──────────── one-way pull of manual JobTread edits ◄──────┘
```

Every target is regenerated from the canonical document; none is edited by hand. The only reverse
flow is the JobTread pull, and it enters through the changelog like any other change.

## 1 · Identify the project (off-ramp start)

1. Project name and number from the app or conversation. Slug = `slugify(name)`.
2. Find the JobTread job, Drive bid/project folder, Lightfield account and QuickBooks job with the
   deterministic crosswalk (`env_scan.mjs plan` → connector calls → `crosswalk.mjs resolve`;
   environment-scan-and-crosswalk.md). Ambiguous matches are asked, never auto-picked.
   If the bid folder exists but no project folder does, the job is still a pursuit: save under
   the bid folder's `Schedules/` and mark `links.driveFolderName` with `(bid)`.
   Drive roots: pursuits `!Active Bids/<bid>/Schedules/`; awarded jobs `!Active Projects/<project>/06 - Schedule/`.
   KB root: `!!NTXP Knowledge Base/<project>/schedule/` (canonical.json, versions/, changelog.md,
   activity_stream.json).
3. Write the IDs into canonical `links` (app: Environment → Canonical sync targets).

## 2 · Knowledge base save

Project KB (path from the Coda) gets a `## Canonical Schedule` section and a folder:

```
<KB>/schedule/
  canonical.json                  # latest, overwritten each version
  versions/v<NNN>-<date>.json     # immutable snapshot per published version
  original/                       # first generated schedule + requirements record
  inputs/<date>-<type>-<name>.md  # every input processed (transcripts, emails, quotes…)
  changelog.md                    # dated, newest first, one line per CHG id
```

KB section text (persistent link + instructions):

```
## Canonical Schedule
Source of truth: <KB>/schedule/canonical.json (v<N>, <date>)
Hosted: https://<slug>.ntxpllc.com/schedule
Drive: <folder>/Schedules/   JobTread job: <id>
Rule: change the schedule only through /ntxp-cpm-gantt-schedules (sync or input). Drive and JobTread
copies are regenerated from canonical; manual JobTread date edits are pulled back daily.
```

## 3 · Google Drive

Folder `<project>/Schedules/` (ntxp-folder-system naming). Upload per version:
`<slug>_Schedule_v<N>_<YYYY-MM-DD>.pdf` (11x17 landscape, from the canonical HTML print —
`Export → Canonical 11x17 PDF`, or render the HTML with Playwright at 17in×11in),
`…_v<N>.xml` (MSPDI; opens in MS Project, Save As .mpp), `…_v<N>.html`. Read back each file's
metadata after upload to verify. Previous versions stay; never overwrite a published version.

## 4 · JobTread (Pave via `mcp__JobTread__query`, org `22PEKtgSScq2`)

Introspect first (`root.updateTask`, `root.createTask`, `root.job.tasks`) — fields can differ by
account. Mapping is stored per task as `jobTreadTaskId`.

Read job tasks:
```json
{ "job": { "$": { "id": "<jobId>" }, "tasks": { "$": { "size": 100 },
  "nodes": { "id": {}, "name": {}, "startDate": {}, "endDate": {}, "progress": {}, "updatedAt": {} }, "nextPage": {} } } }
```
Push with `scripts/jobtread_push.mjs`. Never hand-write the mutations:

1. Read the job tasks (query above) into `jt_tasks.json`, then run
   `node scripts/write_guard.mjs check canonical.json jobtread` (§ 7).
2. `node scripts/jobtread_push.mjs plan canonical.json jt_tasks.json > plan.json` builds **one
   request per task**. Missing tasks get `createTask { targetType: "job", targetId, name, startDate, endDate }`.
   Changed tasks get `updateTask { id, <changed fields only> }`. A batched multi-`createTask`
   request fails on JobTread (2026-10-14 smoke test), so never combine them. A mapped task whose
   JobTread dates differ from the last recorded push is a manual edit. It is listed under
   `conflicts` and **not** pushed: pull it first (§ 5).
3. Send each `plan.requests[i].body` through `mcp__JobTread__query`, in order, one call each.
4. Run `plan.readBack` and save it as `readback.json`. Then
   `node scripts/jobtread_push.mjs record canonical.json plan.json readback.json --write` writes
   `sync.jobtreadPushed[jobTreadTaskId] = {startDate, endDate, progress, updatedAt, version, at}` for
   every task whose read-back matches. It also writes `jobTreadTaskId` on created tasks and sets
   `sync.lastJobtreadPushAt`. Mismatches are not recorded (exit 1) and are retried on the next sync.
5. `node scripts/write_guard.mjs record canonical.json jobtread --write`.

The pushed-dates map is what the pull compares against. A canonical change that has not been
pushed yet is never mistaken for a manual JobTread edit, which prevents the revert ping-pong
found in council audit #3 (A-08).

Safe-write model (jobtread-data-integrator): date pushes derived from an approved canonical version
are allowed; deleting JobTread tasks, editing budgets or documents is never done by this skill.

## 4b · Project Coda backup → JobTread job custom field "Notes" (every sync event)

Runs on **every** sync event: full sync (SYNC / `--sync`), the daily JobTread pull routine,
every publish / off-ramp push, initialization when the Coda is created or corrected, and any
Coda edit. The KB holds the primary Coda; the JobTread "Notes" field is the backup.

**Field limit: 1,024 characters.** JobTread rejects longer values (verified by the 2026-10-14 smoke
test). The team's notes and the block share that budget, and `fitCodaBlock` builds the largest form
that fits. Every form contains both markers, and none is ever sliced:

- **full**: every field.
- **compact** (`· compact`): the live schedule, KB, Drive and JobTread pointers whole, plus the short
  instruction "Use the Live schedule link; change dates only via NTXP CPM Gantt Schedules.". Other fields are
  added whole while they fit, never truncated.
- **minimal**: head marker, live schedule, KB and END marker (about 240–300 characters).

When the team's notes leave less room than the minimal block, `coda_backup.mjs build` **writes
nothing**. It exits 4 with `{status:'skipped', reason:'notes_too_long', budget, minChars, jevRating:3,
mutation:null, codaBackup}` and tells the user the team notes leave no room. The team's notes are
never truncated. A realistic Coda still fits in compact form beside about 300 characters of team
notes. The full Coda always lives in the project KB.

The job-level text custom field is **Notes** (org `22PEKtgSScq2`, field id `22PEPTyrwL4W`; in
other orgs resolve it by name:
`organization.customFields where targetType = job, name = "Notes"`). Teams already write scope
and status notes there, so the backup is a delimited block appended to the end. Each run replaces
only that block. Text outside the markers is never changed, and `coda_backup.mjs` refuses to
produce a write that would change it.

```
=== NTXP PROJECT CODA (BidForge backup) v<coda version> · <UTC time>Z · sha:<hash> ===
Canonical schedule / Knowledge base / Drive folder / JobTread job / QuickBooks / Hosted /
Meeting sources / Default models / Sync cadence / Council   (one "Label: value" line each)
Last sync: <UTC>Z (<event>) · schedule v<N> · <last CHG id>
Regenerated on every NTXP CPM Gantt Schedules sync — edit the Coda in the project KB, not here.
=== END NTXP PROJECT CODA ===
```

Procedure (deterministic; the logistics tier runs it, no judgment needed):
1. Read the current value:
   `{ "job": { "$": { "id": "<jobId>" }, "customFieldValues": { "$": { "size": 50 }, "nodes": { "value": {}, "customField": { "name": {} } } } } }`
   and save the "Notes" value to `notes.txt` (use `-` if it is empty).
2. `node scripts/coda_backup.mjs build canonical.json notes.txt <event> > coda.json`.
   The output carries `mutation`, `readBack` and `changed`. Exit 4 (`status: skipped`,
   `notes_too_long`) means nothing is sent: record its `codaBackup` (rating 3) and tell the user
   to shorten the team notes in JobTread. If it returns `derivedCoda` (the
   canonical file had no Coda yet), save that as the canonical Coda first (`updateCoda`). The
   backup is only accepted when its sha matches the current Coda; stale results count as a
   mismatch.
3. Send `coda.json.mutation` through `mcp__JobTread__query` (`updateJob` with
   `customFieldValues: { "Notes": <merged value> }`). Write even when `changed` is false, so the
   "Last sync" line stays current.
4. Run `coda.json.readBack`, save it as `rb.json`, then run
   `node scripts/coda_backup.mjs verify coda.json rb.json`. Its JSON result is the `codaBackup`
   object.
5. Put `codaBackup` into the sync bundle (the popup shows it) and log it in the canonical
   changelog with `recordCodaBackup`. `written` or `unchanged` → rating 1. A failure or mismatch
   → rating 3, retried on the next sync. Three failures in a row → rating 4, shown to the user.
6. A read-back shorter than the value sent means a field length limit. Rebuild (the builder picks a
   smaller form), write again, and note the limit in the KB Coda.

Safe-write basis: the block is a generated backup of an approved record and the team's text is
preserved byte-for-byte, so this falls under the jobtread-data-integrator safe historical writes.
It never deletes or overwrites the team's notes.

## 4c · Lightfield CRM (every published version)

Post one note per published version on the matching account (and opportunity when one exists),
found through the crosswalk (`links.lightfieldId`). Read the docs first (`search_lightfield_api_docs`
→ `get_lightfield_api_details api/resources/note/methods/create/index.md`), then
`POST /v1/notes` with `fields.$title` = "NTXP CPM Gantt Schedules schedule sync — <project> v<N>" and `fields.$content`
(markdown): version + data date, live schedule link, forecast SC, next three milestones, Drive folder,
JobTread job. Relationships: `$account` (and `$opportunity`). Notes are append-only history; never edit
or delete earlier ones.

## 4d · Hosted site (schedule.ntxpllc.com)

Pull first: `GET /api/changes.php?since=<ISO>` returns the pending site saves. Bring each one into
the KB canonical as sync items, then send `POST /api/changes.php {ack:[{slug,version}]}`. A site save
sets only `sync.siteSavedVersion`, never `publishedVersion`. Then run
`write_guard.mjs check canonical.json site --observed-version <site version>` and publish
(`POST /api/publish.php`, bearer token from ntxp-id) with a per-bundle `baseVersion` and `baseHash`.
The site refuses a stale base (409) and refuses any publish while saves are unpulled. After a
verified publish, set `sync.publishedVersion` and run `write_guard.mjs record … site`. See
`references/integration.md` § 6.

## 5 · One-way JobTread → canonical pull (daily routine and every full sync)

1. Read tasks (query above) and daily logs since `sync.lastJobtreadPullAt`.
2. Save as `jt_tasks.json` and run
   `node scripts/schedule_diff.mjs canonical.json jt_tasks.json > jt_items.json`.
   This is a three-way diff against `sync.jobtreadPushed` (what NTXP CPM Gantt Schedules pushed), not against the
   current canonical:
   - JobTread equal to the pushed dates → no item. Canonical changes not pushed yet are listed
     as `pushPending`.
   - JobTread equal to the canonical → no item.
   - Otherwise → a `jobtread_manual_edit` item, rated 4 for a milestone or protected task, 3 for
     a critical task, else 2.
   - A mapped task with no push snapshot is `skipped` and reported, never guessed.
   - Durations count working days with the canonical `workingDays` and `holidays`.
   - An edit that moves a task **earlier** carries `direction:'earlier'` and is rated at least 3,
     with a note that predecessors may prevent it. The app decides how to show it.
3. Items join the sync bundle (rating ≥ 4 waits for acknowledgement; ≤ 3 auto-apply in the
   unattended routine and are listed in the next conversation).
4. Set `sync.lastJobtreadPullAt`.
5. Back up the Project Coda to JobTread "Notes" (§ 4b). Every pull counts as a sync event.

Routine (create once per project when the user asks; `create_trigger`, fresh session per fire):
```
name: NTXP CPM Gantt Schedules daily JobTread pull — <project>
cron: CRON_TZ=America/Chicago 47 6 * * 1-6
prompt: Run /ntxp-cpm-gantt-schedules --pull-jobtread <project>. Load canonical from <KB path>, apply
        rating ≤3 JobTread manual edits, queue ≥4 for the user, republish if changed, back up the
        Project Coda to the JobTread job "Notes" field (canonical-and-offramp § 4b, verify by
        read-back), and post a five-line summary to the project KB changelog.
```

## 6 · Version discipline

`meta.version` increments on every logged change; a **published** version is the version at
publish time and gets a snapshot. The footer of every output shows `v<N> · <date>`, so any
printed copy can be traced back to its snapshot.

## 7 · Write guard (every Drive / JobTread / Lightfield / site / KB write)

Each derived copy records the canonical version it holds:
`sync.targets[<target>] = {version, hash, at}`. The hash is a sha-256 of the canonical with
`sync` excluded. Targets are `drive`, `jobtread`, `jobtread-notes`, `lightfield`, `site` and
`kb`.

```bash
node scripts/write_guard.mjs check canonical.json drive [--observed-version N] [--observed-hash H]
#   WRITE  (exit 0) — canonical is newer, or the target was never written; prints the record to save
#   SKIP   (exit 0) — the target already holds this version (same hash)
#   REFUSE (exit 2) — the target holds a NEWER version, or the same version with a different hash
#   (a fork). Load the latest canonical or pull the target first. Never write an older version.
# … do the write and read it back …
node scripts/write_guard.mjs record canonical.json drive --write
```

`--observed-version` is the version read from the target itself, and it raises the bar above the
record. Sources:

- Drive: the file name `…_v<N>_…`.
- JobTread "Notes": the Coda block's `schedule v<N>`.
- Site: the project version from `projects.php`.
- Lightfield: the last "NTXP CPM Gantt Schedules schedule sync — <project> v<N>" note.

Recording does not bump the canonical version, because it is sync metadata.
