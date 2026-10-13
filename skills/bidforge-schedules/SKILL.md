---
name: bidforge-schedules
description: >-
  NTXP canonical construction schedule engine. Use for any construction schedule, WBS, Gantt,
  look-ahead, or schedule update on an NTXP project; when the user says sync the schedule, update
  the schedule from meetings/emails/daily reports, track RFIs, submittals, lead times, ASIs,
  change orders, pay apps or sub invoices against the schedule; when they upload a Project Manual,
  specifications or UGCs for scheduling; when they mention BidForge, MS Project / .mpp XML, the
  canonical schedule, or projecttitle.ntxpllc.com/schedule; and when they say "remember this",
  "save this to memory" or "from now on" about scheduling.
metadata:
  author: NTXP LLC
  version: "2.1.0"
  canonical_schema: bidforge.canonical.v1
  sync_schema: bidforge.sync.v1
---

# NTXP BidForge Schedules v2

One **Canonical Project Schedule** per project. The knowledge base, the Google Drive project
folder and JobTread are copies derived from it and kept in sync through an auditable changelog.
A deterministic **JEV decision tree** builds and maintains the schedule; model intelligence is
used to read documents, judge complex changes and improve the tree, not to redo arithmetic.

The web app (`web/`, built to `docs/`) is the visual, deterministic half. This skill is the
agent half: it reaches the systems a browser cannot (JobTread, Gmail, Calendar, Drive, Plaud,
the model council, Hostinger).

## Hard rules (never bypass)

1. **Initialization confirmation first.** Before any schedule work in a conversation, run
   `references/initialization.md` and print the Optimization Confirmation block. No silent starts.
2. **Requirements gate.** Never generate a schedule until project-specific requirements (Project
   Manual, Specifications, owner UGC / supplementary conditions) are uploaded and read, **or** the
   user explicitly types the acknowledgement that none exist. Record which, with date, in the
   changelog. The app enforces the same gate.
3. **Protect the critical path.** Backbone items marked `critical: true` stay unless the user
   removes them manually, repeatedly asks, or declines the module that owns them. Inputs that
   would move them are rated JEV 4–5 and need acknowledgement.
4. **Milestones never move without permission.** Projected milestone slippage is tracked as
   variance against `contractDate`; it is applied only after explicit user approval.
5. **One canonical source.** All writes go through the canonical changelog (`logChange`). Never
   edit JobTread or Drive copies directly except the one-way JobTread → canonical pull.
6. **Determinism before inference.** Use the matrix in `references/jev-tree.md` § Inference vs
   determinism. A model is only called for rows marked *inference*.
7. **Model routing.** Choose executors with `references/model-routing.md`. A model named in an
   instruction is an intent (capability floor), not a hard selection. Council configuration
   decides which seats exist; routing only picks among them.
8. **Pre-flight before every publish.** Deterministic checks + council inspection + final
   Opus-level integrity audit (`references/preflight-and-publish.md`). Fail → fix loop, never ship.
9. **Back up the Project Coda on every sync event.** Every full sync, daily JobTread pull,
   publish, Coda creation or correction, and Coda edit rewrites the Coda block in the JobTread
   job custom field **"Notes"**. Read the field back to verify the write. The team's text outside
   the block is never changed (`scripts/coda_backup.mjs`; canonical-and-offramp.md § 4b).
10. **Owner-facing words stay with Claude.** RFI/submittal responses, pay apps, CO language and
   owner narratives are never routed to other providers (ntxp-model-router hard no-list).

## Entry points

| Invocation | Does |
|---|---|
| `/bidforge-schedules` | Init → requirements gate → scope modules → build → pre-flight → off-ramp |
| `/bidforge-schedules --sync <project>` | Full sync scan → sync bundle → review popup → apply → publish |
| `/bidforge-schedules --pull-jobtread <project>` | One-way JobTread manual-edit pull (daily routine) |
| `/bidforge-schedules --trackers <project>` | Rate RFIs, submittals, ASIs/COs, AR, AP; notify by JEV rating |
| `/bidforge-schedules --improve` | Self-improvement audit across projects (lessons-learned loop) |
| `/bidforge-schedules --research` | Best-practice research sweep (low/mid-intelligence seats) |
| `/bidforge-schedules --from-json canonical.json` | Load an existing canonical schedule |

## Workflow

### 1 · Initialize (every conversation) — `references/initialization.md`
Discover host model, models/council seats, skills/plugins, connectors, project file, JobTread job,
Drive folder, QuickBooks project, knowledge base and **Project Coda**. Fix anomalies (wrong or
missing job, unlocated folder). Print the confirmation block; on user confirmation append it to
the optimization chain (canonical + KB).

### 2 · Requirements gate — `references/requirements-gate.md`
Parse uploaded documents (LandingAI ADE patterns in `references/legacy-wizard-and-ade.md`), extract
work hours, phasing, milestones, liquidated damages, submittal/inspection/closeout rules and
module signals. Or capture the explicit "none exist" acknowledgement.

### 3 · Build with the JEV tree — `references/jev-tree.md`
Backbone (NTXP 3-phase canon) + gated modules. Detection is deterministic (`detectModules`);
**confirmation** comes from documents (strong evidence) or the user. Every line item gets
class → trade → has-submittal/lead → phase → milestone. CPM is code (`web/src/utils/scheduler.js`).

### 4 · Pre-flight and publish — `references/preflight-and-publish.md`
Deterministic checks, council inspection (rules, sequence, spec instructions, visual layout),
final integrity audit of data sources and sync links, then host at
`https://<project-slug>.ntxpllc.com/schedule` (hostinger-ntxp-skill ladder). If hosting fails:
export HTML + 11x17 PDF + MSPDI XML to Drive and JobTread before quitting.

### 5 · Off-ramp and canonical sync — `references/canonical-and-offramp.md`
Identify the project, locate the bid/project folder, save to the knowledge base (original
schedule, every input, dated changelog), write 11x17 PDF + MSPDI XML to Drive, push dates to
JobTread through Pave, back up the Project Coda to the JobTread job "Notes" field. Install the
daily one-way JobTread pull routine.

### 6 · Sync — `references/sync-workflow.md`
SYNC button (top right of the canonical page) or `--sync`: scan JobTread (edits, daily reports,
comments, photos), Plaud, Gemini notes in the Meetings folder, Calendar, Gmail and Drive since the
last sync; write `sync-bundle.json`; the popup shows every source and its effect; apply by
priority (P1 accurate-to-date, P2 necessary remaining changes, P3 milestone effects with
permission). Every sync ends by backing up the Project Coda to JobTread "Notes".

### 7 · Trackers — `references/trackers.md`
RFIs, submittal lifecycle (approval → order → lead → ship → deliver → install), ASIs/COs, owner
pay apps (AR), sub invoices (AP: due the 20th, PM approval + NTXP PO + conditional waiver).
JEV rating 1–5 drives highlighting, notification, user gating and model escalation. Sub-agents:
`agents/`.

### 8 · Learn — `references/self-improvement.md`
Measure how much of each schedule later changed and why; propose JEV changes; council votes;
overwhelming majority applies, anything else is asked of the user next session (user answer is
canon). Every applied change is a removable, dated entry in `knowledge/lessons-learned.md`.
"Remember this / from now on" directives go to `knowledge/memory.md` (project or global scope).

## Files

| Path | Role |
|---|---|
| `web/src/data/constructionPhases.js` | NTXP backbone (user canon), sub-phases, module tags |
| `web/src/data/jevTaxonomy.js` | Classes, modules, detection, five-level classifier |
| `web/src/data/jevModuleTasks.js`, `jevLibrary.js` | **Generated** council consensus (do not hand-edit) |
| `web/src/utils/jevTree.js` | Backbone + modules → WBS, wiring, submittal register seed |
| `web/src/utils/canonical.js` | Canonical document, changelog, memory, sync application |
| `web/src/utils/trackers.js` | Tracker rules and JEV ratings |
| `web/src/utils/modelRouter.js` | Mini-JEV model router and registry |
| `web/src/utils/mspdi.js` | MS Project XML (.mpp-compatible) |
| `web/src/utils/preflight.js` | Deterministic pre-flight checks |
| `scripts/council_merge.mjs` | Seats → consensus data files + report |
| `scripts/schedule_diff.mjs` | JobTread export vs canonical → `jobtread_manual_edit` items |
| `scripts/validate_bundle.mjs` | Sync bundle / canonical validation |
| `scripts/coda_backup.mjs` | Project Coda → JobTread job "Notes" block (build, verify, restore) |
| `web/src/utils/codaBackup.js` | Coda block format, merge that preserves the team's notes, parser, hash |
| `scripts/export_sections.mjs` | Writes versioned knowledge sections from the data files |
| `schemas/*.schema.json` | Canonical and sync-bundle contracts |
| `knowledge/` | Versioned section DB, lessons learned, memory, council records, metrics |
| `agents/*.md` | Sub-agent definitions (sync collector, tracker watch, preflight, lessons, research) |
