# Sync workflow (SYNC button / `--sync`)

The SYNC button sits top right of the canonical page. In the browser it opens the review popup and
loads `./sync-bundle.json` if one is published beside the page; otherwise it explains how to start
an agent sync or load a bundle. The agent does the scanning, because the browser cannot reach
private systems.

## 1 · Collect (sub-agent `sync-collector`, logistics tier)

Window: `sync.lastSyncAt` → now. Search with project-specific terms only (name, job number,
address, owner, architect, major subs, RFI/submittal numbers).

| Source | Look for |
|---|---|
| JobTread tasks | manual date/progress edits (schedule_diff) |
| JobTread daily logs, comments, photos | work actually performed, trades on site, crew counts, delays, inspections, deliveries vs planned tasks for those dates |
| Plaud (plaud-data-source) | recordings / summaries of meetings, PM site visits, impromptu calls |
| Gemini notes | Drive `Meetings/` folder documents created by Gemini |
| Google Calendar | OAC, site walks, inspections, pre-installs, deliveries, shutdowns, impromptu meetings |
| Gmail | directions/requests to change sequence or dates, RFI responses, ASIs, submittal actions, delivery/shipping confirmations, inspection results, owner directives |
| Drive / Chat | revised drawings, ASI/bulletin PDFs, inspection reports, meeting minutes |

Each source becomes a `sources[]` entry with link, date and a two-sentence summary.

## 2 · Interpret (routed: `sync_summarize` mid, `daily_report_compare` mid-high, `milestone_impact` high)

Turn each source into `items[]` (schema `schemas/sync-bundle.schema.json`) in this priority order:

**P1 — accurate to date.** Record actual start/finish and percent complete for work evidenced in
daily logs and photos. Backfill meetings and inspections that happened but were not on the
schedule (`add_event`, with date and result). Note trades on site out of sequence (tag
`out-of-sequence`).

**P2 — necessary remaining changes.** Duration changes, resequencing and added work that are
confirmed and unavoidable (inspection failed → re-inspection + rework activity; RFI response
adds work; delivery confirmed late). State the constraint that forces it.

**P3 — milestone effects.** Compute the projected effect on milestones and inspection dates.
Emit `milestone_move` items with old/new dates; they are applied only if the user approves in the
popup. Unapproved moves stay as tracked variance (`contractDate` marker on the Gantt).

Always highlight (tag) these when found: architect-requested revisions, RFI responses and
whether they were sent to affected subs, ASIs and whether all of owner/architect/GC/subs received
them, inspections (prep deliverables → scheduled → passed / failed → reinspection and rework),
and each submittal's chain (approval → confirmed order → lead time → shipping tracking → delivery
→ installation).

## 3 · Rate (deterministic first)

Ratings 1–5 per `references/trackers.md`. Items touching protected or critical tasks get +1.
Anything ≥4 gets a model-written one-line consequence and options; 5 also opens a council gate
notification (email/text) per ntxp-model-council § 5.

## 4 · Back up the Project Coda (every sync, before publishing the bundle)

Write the Coda block to the JobTread job's "Notes" custom field and verify it by read-back
(canonical-and-offramp.md § 4b). Put the verify result into the bundle as `codaBackup`. A failed
backup does not block the sync. It is rated 3 (4 after three failures in a row) and retried next
time.

## 4a · Validate and publish the bundle

`node scripts/validate_bundle.mjs sync-bundle.json` must pass; it warns when `codaBackup` is missing. Publish it beside the hosted page
(or hand it to the user to load). In conversation, also print a compact table: source, change,
rating, priority.

## 5 · Apply

User reviews in the popup (or in chat for unattended runs). Applying runs `applySyncItems`: each
item becomes a changelog entry, the schedule is recalculated, trackers update, and
`sync.lastSyncAt` is set. Then republish per `canonical-and-offramp.md` (KB → Drive → JobTread).
In hosted read-only mode, the viewer's applied changes stay local until the agent republishes; the
agent run is the durable path.
