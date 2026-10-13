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
2. Search for JobTread job, Drive bid/project folder and QuickBooks job (initialization § 1).
   If the bid folder exists but no project folder does, the job is still a pursuit: save under
   the bid folder's `Schedules/` and mark `links.driveFolderName` with `(bid)`.
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
Rule: change the schedule only through /bidforge-schedules (sync or input). Drive and JobTread
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
Create missing task: `createTask { targetType: "job", targetId, name, startDate, endDate }`.
Update dates: `updateTask { id, startDate, endDate }` — only changed fields, only for tasks whose
canonical dates changed in this version. Write `jobTreadTaskId` back to canonical. Record the push
time as `sync.lastJobtreadPushAt` and the exact JobTread `updatedAt` values returned, so the pull
can tell NTXP pushes apart from manual edits.

Safe-write model (jobtread-data-integrator): date pushes derived from an approved canonical version
are allowed; deleting JobTread tasks, editing budgets or documents is never done by this skill.

## 4b · Project Coda backup → JobTread job custom field "Notes" (every sync event)

Runs on **every** sync event: full sync (SYNC / `--sync`), the daily JobTread pull routine,
every publish / off-ramp push, initialization when the Coda is created or corrected, and any
Coda edit. The KB holds the primary Coda; the JobTread "Notes" field is the backup.

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
Regenerated on every BidForge sync — edit the Coda in the project KB, not here.
=== END NTXP PROJECT CODA ===
```

Procedure (deterministic; the logistics tier runs it, no judgment needed):
1. Read the current value:
   `{ "job": { "$": { "id": "<jobId>" }, "customFieldValues": { "$": { "size": 50 }, "nodes": { "value": {}, "customField": { "name": {} } } } } }`
   and save the "Notes" value to `notes.txt` (use `-` if it is empty).
2. `node scripts/coda_backup.mjs build canonical.json notes.txt <event> > coda.json`.
   The output carries `mutation`, `readBack` and `changed`.
3. Send `coda.json.mutation` through `mcp__JobTread__query` (`updateJob` with
   `customFieldValues: { "Notes": <merged value> }`). Write even when `changed` is false, so the
   "Last sync" line stays current.
4. Run `coda.json.readBack`, save it as `rb.json`, then run
   `node scripts/coda_backup.mjs verify coda.json rb.json`. Its JSON result is the `codaBackup`
   object.
5. Put `codaBackup` into the sync bundle (the popup shows it) and log it in the canonical
   changelog with `recordCodaBackup`. `written` or `unchanged` → rating 1. A failure or mismatch
   → rating 3, retried on the next sync. Three failures in a row → rating 4, shown to the user.
6. A read-back shorter than the value sent means a field length limit. Rebuild with the compact
   form (values truncated; every label kept), write again, and note the limit in the KB Coda.

Safe-write basis: the block is a generated backup of an approved record and the team's text is
preserved byte-for-byte, so this falls under the jobtread-data-integrator safe historical writes.
It never deletes or overwrites the team's notes.

## 5 · One-way JobTread → canonical pull (daily routine and every full sync)

1. Read tasks (query above) and daily logs since `sync.lastJobtreadPullAt`.
2. Save as `jt_tasks.json` and run
   `node scripts/schedule_diff.mjs canonical.json jt_tasks.json > jt_items.json`.
   The script ignores tasks whose `updatedAt` equals the recorded push value and emits
   `jobtread_manual_edit` items (rated: milestone or protected → 4, critical → 3, else 2).
3. Items join the sync bundle (rating ≥ 4 waits for acknowledgement; ≤ 3 auto-apply in the
   unattended routine and are listed in the next conversation).
4. Set `sync.lastJobtreadPullAt`.
5. Back up the Project Coda to JobTread "Notes" (§ 4b). Every pull counts as a sync event.

Routine (create once per project when the user asks; `create_trigger`, fresh session per fire):
```
name: BidForge daily JobTread pull — <project>
cron: CRON_TZ=America/Chicago 47 6 * * 1-6
prompt: Run /bidforge-schedules --pull-jobtread <project>. Load canonical from <KB path>, apply
        rating ≤3 JobTread manual edits, queue ≥4 for the user, republish if changed, back up the
        Project Coda to the JobTread job "Notes" field (canonical-and-offramp § 4b, verify by
        read-back), and post a five-line summary to the project KB changelog.
```

## 6 · Version discipline

`meta.version` increments on every logged change; a **published** version is the version at
publish time and gets a snapshot. The footer of every output shows `v<N> · <date>`, so any
printed copy can be traced back to its snapshot.
