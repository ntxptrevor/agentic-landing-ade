# Initialization — adapt to the host, confirm the optimization chain

Run at the start of every conversation or workflow that touches a schedule. Cost target: one pass
of cheap discovery calls, no model reasoning beyond filling the block.

## 1 · Discover (deterministic, parallel)

| Item | How to find it | If missing |
|---|---|---|
| Host model | `get_session` (session_context.model, last_served_model) or the system prompt model line | State "unknown" |
| Council seats | `council_env` / `python3 -m council env`; else the NTXP Model Council sheet *01 Config* via Sheets connector | Use available Claude agents (Fable/Opus/Sonnet/Haiku) as a reduced council and say so |
| Models + costs | ntxp-model-router `route.py registry`; fall back to `web/src/utils/modelRouter.js` registry | Note estimates |
| Skills / plugins | Skill listing; look for: ntxp-model-council, ntxp-model-router, ntxp-branded-document-2, hostinger-ntxp-skill, jobtread-data-integrator, plaud-data-source, google-workspace-intelligence, meeting-intelligence-automator, submittal-register, dallas-isd-sov-payapp-review, canonical-project-model, ntxp-gantt-schedule, continuous-learning-v2 | List what is absent |
| Connectors | JobTread (`mcp__JobTread__query`), Gmail, Google Calendar, Google Drive, Plaud, QuickBooks | Mark unavailable; continue |
| Project file | Canonical `canonical.json` in KB / Drive `Schedules/`; local `bidforge.canonical.*` | New project |
| JobTread job | Search by project name, job number, address (jobtread-data-integrator § Project lookup) | Ask once, then record |
| Drive folder | NTXP folder system search by name / job number; prefer current over archived | Ask once |
| QuickBooks project | Customer:Job match by name | Record "not located" |
| Knowledge base | Project KB file (Drive `Knowledge Base/` or project `CLAUDE.md`/KB doc) | Create section stub |
| Project Coda | `## Project Coda` section inside the project KB | See § 3 |

## 2 · Confirmation block (print verbatim, then wait for "confirm" or corrections)

```
BIDFORGE OPTIMIZATION — <YYYY-MM-DD HH:MM CT>
Model:        <host model> (routing via mini-JEV; council: <seats>)
Skills:       <loaded skills used by this workflow>
Council:      <council id / reduced council>
Project file: <canonical path or NEW>          v<version>
JobTread job: <name> (<id>)                   <OK | NOT LOCATED | CORRECTED from X>
Drive folder: <name> (<id>)                   <OK | NOT LOCATED | CORRECTED>
QuickBooks:   <customer:job>                  <OK | NOT LOCATED>
Knowledge base: <path>                        <OK | CREATED>
Project Coda: <found v# | CREATED via council | PENDING>
Anomalies:    <list or none>
```

On confirmation: append the entry to `optimizationChain` in the canonical document (app:
Environment tab → Confirm optimization) **and** to the KB under `## Schedule Optimization Chain`
in dated order. Corrections the user makes are canon and are written back to the Coda.

## 3 · Project Coda

The Coda is the project's canonical selection of files, databases, tools and models, so models do
not double-work or pick different sources.

1. Read `## Project Coda` in the project KB. Use its default file/DB selections and tool/model
   environment for every later step.
2. If absent: invoke the Project Coda skill if the environment has one. If none exists (true as of
   2026-10-13 in this environment), create the Coda here: run a council (`change_type:
   classification`) on the proposed selections below, then write the section.

```
## Project Coda  (v1, <date>, council <id>)
Canonical schedule: <path>       JobTread job: <id>      Drive folder: <id>
QuickBooks: <customer:job>       KB: <path>              Hosted URL: <slug>.ntxpllc.com/schedule
Primary meeting sources: Plaud / Gemini Meetings folder / Calendar
Default models: orchestrator <model>; logistics <model>; judgment <model>
Sync cadence: daily JobTread pull <time CT>; full sync on SYNC / weekly
```

3. Any anomaly (job ID mismatch between Coda and JobTread search, folder moved) is corrected,
   logged as a changelog entry (`type: coda_correction`) and shown in the Anomalies line.
