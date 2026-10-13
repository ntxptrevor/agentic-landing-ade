# Lessons Learned — BidForge Schedules

Dated, removable entries. Status: `applied` · `applied-provisional` · `awaiting-user` · `removed`.
Format and vote rules: ../references/self-improvement.md. Newest first.

## 2026-10-13

### LL-2026-10-13-09…18 — Schedule engine realism (council schedule audit)
Status: applied (R1–R6, R8–R10 were 3/3 adopt votes; link values from the ≥2-seat merge)   Scope: jevTree, scheduler, jevOverlap, preflight, trackers, setup
Evidence: knowledge/council/2026-10-13-schedule-audit/ (Drive benchmarks for Parkland, Ralls, TAMU, TxDOT; seats A/B/C rounds 1–2; engine audits before and after).
Before: construction 147–282 WD on five reference scenarios, 0–8% concurrent, FS only.
After: B 65, C 93, D 33, E 60 WD (all four inside the council bands), 61–96% concurrent, 31–53% critical; A 37 WD, 2 WD above its band. Cover-Up → Drywall kept FS for the first area (seats A + C).
Changes: 09 overlap links (41 round 1 + 10 round 2); 10 scope tiers; 11 size/sector/constraint scaling; 12 parallel precon (via links); 13 the 10 WD rule splits by area; 14 procurement order-by and release-at-risk; 15 NTXP calendar and requested inspection weeks; 16 days sanity gate; 17 TAB row (heavy/gut/equipment); 18 equipment unit rates. Engine fixes: the scheduler honors multiple links per pair; the SS lag is capped at the predecessor's duration; a gate holds only the work linked to it.
Remove by: delete the entries in web/src/data/jevOverlap.js, or pass no scope to buildWbs (legacy serial behavior returns).

### LL-2026-10-13-19 — Decisions surfaced to the user (not overwhelming)
Status: **awaiting-user**
1. Merge "Complete Punch Items" into "Perform Punch Corrections" (3/3 favored, but the row is user-protected). Round 2 overlapped the two rows instead (SS+5, 3/3), so nothing is removed.
2. Location-based area repetition for phased or occupied work (3/3 favor on value; one seat says phase 2; large build). Not built.
3. Inspection notice lead of 5 WD plus a 2-day re-inspection contingency (2/3).
4. Healthcare mockup gates before rough-in and before finishes (1/3, supported by the Parkland HW comment).
5. A Finish Paint row; split Drywall into Hang + Tape/Float (1/3 each).
6. To close the remaining 2 WD on light refresh: overlap the specialties rows and Ceiling Tile → Rough Clean SS1 (1/3 each).
7. Crew diminishing returns (rejected or deferred by all seats). Not built.

### LL-2026-10-13-08 — Project Coda backup to JobTread "Notes" on every sync
Status: applied (user directive — canon; no council vote needed)   Scope: sync, off-ramp, initialization, pre-flight
Change: every sync event writes a delimited Coda block to the end of the JobTread job custom field "Notes" (field 22PEPTyrwL4W) and verifies it by read-back. The team's text outside the block is preserved. Initialization restores the Coda from the block when the KB copy is missing, and flags hand edits.
Expected effect: Coda survives KB loss; every job shows its canonical sources in JobTread.
Remove by: delete hard rule 9 in SKILL.md, § 4b in canonical-and-offramp.md, and the backup step in sync-workflow.md.

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
