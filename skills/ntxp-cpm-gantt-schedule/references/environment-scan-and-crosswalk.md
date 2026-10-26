# Environment scan and project crosswalk

Finding a project's JobTread job, Drive folders, Lightfield account, QuickBooks project, KB folder
and site slug is **code**, not judgment. The agent only runs the connector calls and saves what
they return. Deterministic scripts decide which record belongs to the project, and they never
pick an ambiguous match. Added after council audit #3 (A-13 / F-06).

```
knowledge/sources.json ──env_scan.mjs plan──► connector calls (tool + args) + checklist
        ▲                                             │ agent runs them, saves scan.json
        └──env_scan.mjs register (lastScanAt, discovered, stale)◄──┤
                                                      ▼
canonical.json ◄──crosswalk.mjs resolve --apply── scan.json ──crosswalk.mjs verify──► drift report
```

## 1 · Sources registry: `knowledge/sources.json`

There is one entry per source. Each entry gives `id`, `kind`, `title` and `tool` (the connector
tool name, or `curl`). It also gives `args`, which may carry the placeholders `{projectName}`,
`{jobtreadJobId}`, `{folderId}` and `{lastSyncAt}`. The rest are `candidatesKey` (where the mapped
records go in `scan.json`), `map` (how to map them) and `lastScanAt`. The registry covers:

- JobTread jobs (org `22PEKtgSScq2`) and the job "Notes" field.
- Drive `!Active Bids`, `!Active Projects` and `!!NTXP Knowledge Base`. A `folderId` of `null` means
  the folder is first resolved by name; `register` then records the id.
- Lightfield accounts. Run the docs search first, as the Lightfield instructions require.
- The QuickBooks customer:job.
- The hosted site's project list and its unpulled saves (`changes.php`).
- Plaud recordings and Gemini meeting notes.

`staleAfterDays` (default 7) sets when a source counts as stale. The `discovered[]` list holds
sources seen in a scan but not yet registered.

## 2 · Plan the scan

```bash
S=skills/ntxp-cpm-gantt-schedule/scripts
node $S/env_scan.mjs plan --project "McShan Elementary Restroom Renovation" --job <jobtreadJobId> --since <lastSyncAt>
```

For each source, the output gives the exact call (`call: <tool> <args JSON>`). It also gives any
preflight or resolve step, the `candidates.<key>` mapping, and a `[STALE]` flag for sources never
scanned or older than N days (`--stale-days N`). It ends with the checklist. Discovered sources
are listed for review. `--json` gives the same output for programs.

Save the results as one `scan.json`:

```json
{ "scannedAt": "2026-10-15T12:00:00Z",
  "scanned": { "jobtread-jobs": { "ok": true, "count": 42 }, "drive-active-bids": { "ok": true, "count": 31, "folderId": "<id>" } },
  "connectors": ["mcp__JobTread__query", "mcp__Google_Drive__search_files", "…every tool available this session"],
  "driveFolders": [{ "id": "…", "name": "!Active Bids" }, { "id": "…", "name": "!Warranty" }],
  "found": [{ "kind": "connector", "name": "Procore", "tool": "mcp__Procore__list_projects" }],
  "candidates": {
    "jobtread": [{ "id": "…", "name": "…", "number": "1125301", "address": "…", "owner": "Dallas ISD", "archived": false }],
    "driveBid": [{ "id": "…", "name": "…" }], "driveProject": [], "lightfield": [], "quickbooks": [],
    "kb": [{ "path": "!!NTXP Knowledge Base/<project>", "name": "<project>" }], "site": [{ "slug": "…", "name": "…" }] } }
```

## 3 · Register what was found

```bash
node $S/env_scan.mjs register scan.json --write
```

- Sets `lastScanAt` (and `lastCount`) on every source scanned OK, and fills unknown Drive `folderId`s.
- Adds NEW sources to `discovered` with `firstSeen` and `lastSeen`, deduplicated by kind and name.
  A new source is a connector whose server is not in the registry, a new top-level `!…` Drive
  folder type, or an explicit `found` entry.
- Lists stale sources. A discovered source stays in every plan until someone registers it as a
  source (edit `sources[]`) or marks it `"status": "ignored"`.

## 4 · Resolve and verify the crosswalk

```bash
node $S/crosswalk.mjs resolve "$KB/schedule/canonical.json" scan.json [--apply canonical.new.json] [--json]
node $S/crosswalk.mjs verify  "$KB/schedule/canonical.json" scan.json [--json]
```

`lib/crosswalk.mjs` holds the rules:

| Function | Rule |
|---|---|
| `normalizeName(s)` | Lower-case, strip accents and punctuation, drop `(bid)` / `(TEST …)` / `(archive)` markers and leading `!`, expand abbreviations (ES → elementary, MS → middle, reno → renovation, bldg → building, …). |
| `tokens(s)` | The normalized words minus stop words (the, of, project, job, bid, …). |
| `scoreCandidate(project, c)` | A weighted mean over the attributes both sides have. Weights: **number 0.45 · name 0.35 · address 0.12 · owner 0.08**. Name, address and owner similarity is the larger of the token Dice score and 0.85 × containment. A job number found inside a folder name counts as a number match. A different job number caps the score at 0.5. An archived record is multiplied by 0.9. |
| `resolveLinks(project, candidates)` | Per source, the best candidate is linked only when its score is **≥ 0.75** and it leads the runner-up by **≥ 0.10**. Otherwise the source goes to `ambiguous` (top 3, **never auto-picked**, so ask the user) or `missing`. Returns `{links:{jobtreadJobId, jobNumber, driveBidFolderId, driveProjectFolderId, lightfieldId, quickbooksProjectId, kbPath, siteSlug}, confidence, ambiguous, missing}`. |
| `verifyLinks(canonical, scan)` | Reports drift. `missing_id`: a linked id is no longer found. `name_changed`: the linked record no longer matches the project. `better_match`: another record now leads the linked one by the margin. `unlinked_match`: a source with no link now resolves. |

Exit codes:

- `resolve`: 0 when resolved (missing sources are allowed), 4 when any source is ambiguous.
- `verify`: 0 when there is no drift, 6 on drift.

`--apply` writes a copy of the canonical with the new links and a `crosswalk` record. It never
overwrites an existing link that differs. Such a link is reported under `conflicts` for the user
to decide. Save the copy through the normal canonical save, with `baseVersion` and a changelog
entry `links_resolved` that cites `scan.json`.

## 5 · When to run

- **Initialization** (`initialization.md` § 1) runs plan, scan, register and resolve, then prints
  the confirmation block. Ambiguous or missing links show under *Anomalies*.
- **Every full sync** runs `verify` first. Drift is rated JEV 3 and shown in the sync popup. A
  `missing_id` on the JobTread job or the KB path is rated 4, and nothing is written until it is fixed.
- **Before every write** to a derived copy, run `write_guard.mjs` (canonical-and-offramp.md § 7).

Tests: `node --test skills/ntxp-cpm-gantt-schedule/` (`scripts/crosswalk.test.mjs`).
