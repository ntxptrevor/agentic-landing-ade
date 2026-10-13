# Lessons Learned — BidForge Schedules

Dated, removable entries. Status: `applied` · `applied-provisional` · `awaiting-user` · `removed`.
Format and vote rules: ../references/self-improvement.md. Newest first.

## 2026-10-13

### LL-2026-10-13-07 — Fix FS/FF/SF off-by-one in CPM forward pass
Status: applied (defect fix, not a methodology change)   Scope: web/src/utils/scheduler.js
Evidence: zero-lag FS successors started on the predecessor's finish day while the backward pass assumed the next day, so real critical tasks showed float.
Change: FS start = finish + 1 + lag; FF/SF use duration − 1; backward SF matched.
Remove by: revert the scheduler.js hunks in the commit that added this entry.

### LL-2026-10-13-06 — Candidate modules proposed by a single seat
Status: **awaiting-user**   Scope: taxonomy
Evidence: ada_tas_upgrades (seat A), electrical_gear_upgrade (seat A), storm_shelter (seat C). 1/3 is not a majority.
Question for user: adopt any of these as gated modules? (Answer is canon.)

### LL-2026-10-13-05 — Permit-issued gate before covered rough-in
Status: **awaiting-user**   Scope: backbone/preconstruction
Evidence: seats A and C notes (2/3; not overwhelming).
Proposed change: + "Building / FA / Sprinkler Permits Issued" milestone feeding "Confirm Job Start Approval (Gate)".
Question for user: add it? (Answer is canon.)

### LL-2026-10-13-04 — Slab moisture / pH testing before resilient flooring
Status: applied   Scope: backbone/construction (Finishes)
Evidence: seats A, B, C notes. Vote 3/3 (overwhelming).
Change: + "Slab Moisture / pH Testing (Resilient Flooring)" 2d after "Prep Floor — Level or Grind".
Expected effect: fewer flooring failures/delays logged; +2 working days on the critical path.
Remove by: delete the row tagged `lesson: 'LL-2026-10-13-04'` in web/src/data/constructionPhases.js.

### LL-2026-10-13-03 — TDLR TAS registration / RAS review and RAS inspection
Status: applied   Scope: backbone/preconstruction, backbone/closeout
Evidence: seats A, B, C notes (B: "sits in base, not a gated module"). Vote 3/3.
Change: + "TDLR TAS Project Registration & RAS Plan Review" (parallel, feeds start gate); + "TDLR RAS Inspection (within 1 year of SC)" (closeout, parallel, does not gate turnover).
Expected effect: no backfilled TAS events in syncs; precon length unchanged unless review exceeds float.
Remove by: delete rows tagged `lesson: 'LL-2026-10-13-03'`.

### LL-2026-10-13-02 — 42 anchor corrections to council module rows
Status: **applied-provisional** — pending council ratification at next council run; user may veto any line
Scope: knowledge/council/anchor-overrides.json
Evidence: orchestrator review of the merge found rows anchored against construction logic (e.g. roof membrane before insulation, sprinkler hydro after drywall, OPCI install in precon, ICRA barrier removal after SC).
Remove by: delete an override object and re-run scripts/council_merge.mjs.

### LL-2026-10-13-01 — Initial JEV tree from three-seat council
Status: applied   Scope: jevModuleTasks.js, jevLibrary.js, jevTaxonomy.js
Evidence: independent seats A (Sonnet), B (Fable), C (Opus) — knowledge/council/seat_*.psv; merge report 2026-10-13-merge-report.md.
Rule: a task enters the tree only if ≥2 of 3 seats proposed it; single-seat rows kept as candidates.
Result: 24 modules (22 required + hvac_replacement 3/3, emergency_power 2/3), 197 module tasks, 128-item base library.
Note: the cross-provider NTXP council engine was not reachable in this environment; seats were three Claude model families. Re-run with ≥3 providers when the engine is available and record the diff here.
