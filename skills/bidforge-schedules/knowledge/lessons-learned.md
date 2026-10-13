# Lessons Learned — BidForge Schedules

Dated, removable entries. Status: `applied` · `applied-provisional` · `awaiting-user` · `removed`.
Format and vote rules: ../references/self-improvement.md. Newest first.

## 2026-10-13

### LL-2026-10-13-22…25 — Inspection holds, mockup gates, finish rows, specialty overlap (user decisions — canon)
Status: applied   Scope: jevTree, constructionPhases, jevOverlap, preflight, audit
- 22 AHJ / state inspections (underground, cover-up, above-ceiling, fire marshal, TDLR, HHSC, jail standards, city/building final) get a "Request … (5 WD notice)" milestone. It starts SS with the inspected work and must precede the inspection by 5 WD. Each inspection also carries a 2 WD re-inspection contingency. Owner, Infection Prevention and third-party checks are excluded.
- 23 Healthcare mockup gates (medical_specific / medical_specialties / imaging): Rough-in Mockup (5 WD, SS+2 after framing) holds Wall MEP Rough; Finish Mockup (5 WD, SS+3 after tape/float) holds Prime Coat Walls. Both are hard gates.
- 24 "Drywall & Taping" splits into Drywall Hang (5 WD) and Drywall Tape, Float & Finish (7 WD, SS+2 / FF+2, per Parkland). A new Finish Paint row (4 WD, SS+3 / FF+2 after prime) sits after ceiling tile so it gates flooring (council rule 7). Module anchors re-merged to the finish row; the light tier patch now overrides Drywall Hang and drops tape/float.
- 25 Specialties overlap (wall base → wall protection → restroom accessories → life-safety items, SS+1 each) and Ceiling Tile → Rough Clean SS+1, applied to all tiers.
Engine fixes found while building it: split areas of one activity stay in order; module submittal rows never hold a site gate (the procurement tracker gates their install).
Result: all five reference scenarios pass (A 34, B 66, C 108 incl. 10 WD of user mockup holds, D 35, E 68 WD).
Remove by: delete the rows/links tagged LL-22…25 and the INSPECTION_RULES block.

### LL-2026-10-13-21 — Phases and zones as complete, sequential work groups
Status: applied (user decision — canon)   Scope: jevTree expandZones, ModuleSelection phasing editor, preflight/audit aggregation, envelope
Rule: each phase is a complete work group; each zone is a complete sub-group with only its chosen trade groups; each group finishes before the next begins. Each phase ends with clean, punch walk, corrections and owner turnover (plus change-over days).
Engine fixes found while building it: a group that opens with a parallel/module row still chains from the previous group; any task whose finish drives nothing (no successor, or only SS successors) now feeds the next hard gate (DISD 01 32 16), so a zone cannot hand over with work still open.
Remove by: turn off "Phased / zoned work" for a project; delete expandZones to remove globally.

### LL-2026-10-13-20 — Merge Complete Punch Items into Perform Punch Corrections
Status: applied (user decision — canon)   Scope: backbone/closeout
Change: removed "Complete Punch Items" (protected row, removed by the user's explicit decision); "Perform Punch Corrections" (10 WD, size-scaled) now covers punch completion. The round-2 SS+5 link between the rows is removed.
Remove by: restore the row in constructionPhases.js and the link in jevOverlap.js.

### LL-2026-10-13-09…18 — Schedule engine realism (council schedule audit)
Status: applied (R1–R6, R8–R10 were 3/3 adopt votes; link values from the ≥2-seat merge)   Scope: jevTree, scheduler, jevOverlap, preflight, trackers, setup
Evidence: knowledge/council/2026-10-13-schedule-audit/ (Drive benchmarks for Parkland, Ralls, TAMU, TxDOT; seats A/B/C rounds 1–2; engine audits before and after).
Before: construction 147–282 WD on five reference scenarios, 0–8% concurrent, FS only.
After: B 65, C 93, D 33, E 60 WD (all four inside the council bands), 61–96% concurrent, 31–53% critical; A 37 WD, 2 WD above its band. Cover-Up → Drywall kept FS for the first area (seats A + C).
Changes: 09 overlap links (41 round 1 + 10 round 2); 10 scope tiers; 11 size/sector/constraint scaling; 12 parallel precon (via links); 13 the 10 WD rule splits by area; 14 procurement order-by and release-at-risk; 15 NTXP calendar and requested inspection weeks; 16 days sanity gate; 17 TAB row (heavy/gut/equipment); 18 equipment unit rates. Engine fixes: the scheduler honors multiple links per pair; the SS lag is capped at the predecessor's duration; a gate holds only the work linked to it.
Remove by: delete the entries in web/src/data/jevOverlap.js, or pass no scope to buildWbs (legacy serial behavior returns).

### LL-2026-10-13-19 — Decisions surfaced to the user (not overwhelming)
Status: **awaiting-user**
1. ~~Merge Complete Punch Items~~ — answered yes by the user → LL-2026-10-13-20.
2. ~~Area repetition for phased work~~ — answered by the user (complete, sequential phase/zone groups) → LL-2026-10-13-21.
3–6. ~~Inspection notice/contingency, mockup gates, Finish Paint + drywall split, specialty overlaps~~ — all answered yes by the user → LL-2026-10-13-22…25.
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
