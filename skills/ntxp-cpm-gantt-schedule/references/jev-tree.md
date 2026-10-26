# JEV decision tree

## Structure

```
Project
 ├─ Backbone (NTXP canon, constructionPhases.js) ─ always present, protected items marked critical
 │    Preconstruction → Construction (demo → finishes) → Closeout, grouped in sub-phases
 └─ Gated modules (jevTaxonomy.js + generated jevModuleTasks.js)
      detected by keywords → CONFIRMED by documents (strong evidence) or the user → spliced after anchors
```

Modules (24): selective_demo, abatement, icra, occupied_phasing, low_voltage, access_control,
fire_alarm, fire_suppression, medical_specialties, medical_specific, imaging, mep_lab, opci,
complex_owner, site_work, exterior_improvements, roofing, elevator, kitchen_foodservice,
isd_college, secured_building, hvac_replacement*, emergency_power*, joc_csp_admin.
(*added by council, 3/3 and 2/3 seats.) Candidates not yet adopted (1/3 seats): ada_tas_upgrades,
electrical_gear_upgrade, storm_shelter — surfaced to the user at next use.

Declining a module removes backbone rows tagged with it (e.g. declining `site_work` removes
Site Work, Underground Inspections, Pourback — Exterior). That is a user decision and is logged.

## Five-level classification (`classifyLineItem`)

| Level | Values | Source order |
|---|---|---|
| 1 Class | standard_renovation, security, hospital, low_voltage, life_safety, inspection, oac, project_management, design, permit | explicit → council library (128 consensus items) → regex rules |
| 2 Trade | Demolition, Framing/Drywall, Electrical, Plumbing, HVAC, Fire Sprinkler, Fire Alarm, Low Voltage, … GC, Owner, Architect, AHJ | explicit → library → rules |
| 3 Has submittal or lead time | yes/no + lead days | explicit → library → rule; **yes seeds the submittal register** |
| 4 Phase | preconstruction, construction, closeout | anchor phase → library |
| 5 Milestone | yes/no | explicit → rule (NTP, SC, turnover, gates, 0-day) |

## Scope profile (required at the module step)

Tier, affected SF, owner sector, constraints and, for equipment jobs, units. Rules live in
`web/src/data/jevOverlap.js` (council schedule audit 2026-10-13):

| Tier | Effect |
|---|---|
| light | Drops underground, structural, framing, rough-in, cover-up and above-ceiling inspections, MEP equipment, fire sealing, millwork, doors/hardware, controls; drywall becomes a 2-day patch |
| standard | Drops underground MEP, pourback, structural and MEP equipment |
| heavy | Drops structural only; adds TAB |
| gut | Keeps every row; adds TAB |
| equipment | Keeps only mobilization, containment, make safe, equipment set, above-ceiling inspection, controls, start-up, TAB, final clean, SC; unit-rate durations |

Durations: trade rows scale by `(SF / 4500)^0.379 × sector × constraints^0.8` (capped at 1.6).
Inspections, tests, reviews, meetings and admin rows never scale. A construction row over 10 WD is
split by area (DISD 01 32 16). Sectors: ISD 1.0, college 1.05, municipal/TxDOT 1.0, healthcare
1.15, secured 1.2. Constraints: occupied 1.10, ICRA 1.15, phased 1.10, secure 1.10, night 1.30.

## Phases and zones (user rule, 2026-10-13)

Each **phase** is a complete work group and each **zone or area** is a complete sub-group. A zone
carries only the trade groups chosen for it (construction sub-phases: demo, underground MEP,
framing, wall rough-in, drywall & ceiling, finishes, punch prep, low voltage & controls). The full
overlap model runs inside the zone, and the zone must finish (`<Zone> complete — handover`) before
the next zone starts. Each phase then closes with its own final clean, owner punch walk, punch
corrections and `Turnover to Owner`, plus optional owner change-over days, before the next phase.
The last phase's walk is the project's Substantial Completion.

Precedents from past NTXP jobs: Rocksprings (punch walk and owner change-over between phases),
Parkland (owner objected to Phase 1 punch overlapping Phase 2), Ralls (restroom zones carrying only
demo, rough-in, tile/finish and fixtures). Days gate for zoned work: sum of each zone's envelope plus
phase turnovers and change-over days.

## Inspection holds and mockup gates (user rules)

- AHJ and state inspections (underground, cover-up, above-ceiling, fire marshal, TDLR, HHSC, jail standards, city/building final) carry a 5 WD request notice and a 2 WD re-inspection contingency. The request milestone starts SS with the inspected work and links FS+5 to the inspection, so it only delays inspections of short work.
- Healthcare (medical_specific / medical_specialties / imaging): the rough-in mockup must be accepted before wall rough-in, and the finish (complete-stage) mockup before prime coat. Both are hard gates.
- Drywall is two rows (Hang, then Tape, Float & Finish at SS+2 / FF+2). Finish Paint follows prime at SS+3 / FF+2 and must finish before the flooring moisture gate.

## Calibration from real UT System / UNT schedules (council audit #2, 2026-10-14)

Source: `web/src/data/jevCalibration.js`. Evidence: `knowledge/council/2026-10-14-ut-system-audit/REPORT.md`. All values are provisional (n ≤ 3).

- **Size band** (`sizeBand(scope)`):
  - **Micro:** SF envelope ≤ 30 WD, or contract value ≤ $250k when SF is unknown.
  - **Large:** envelope > 90 WD or value > $1M.
  - The exterior and equipment tiers keep their own rules.
- **Micro jobs:**
  - AHJ inspection base is 1 WD.
  - Submittal processing 8 WD (15 standard, 20 large). Punch corrections 4 WD (6 / 10). Punch list sent 1 WD.
- **Owner notice profile** (`ownerProfile`):
  - Default is 5 WD notice / 2 WD contingency (canon LL-22).
  - The `unt` preset (72 h = 3 WD) and a per-project contingency override exist. Selecting either is a logged user decision; neither is ever applied automatically.
- **Exterior work:**
  - Tier `exterior` keeps only site and exterior rows, cleanup and SC. Envelope factor 0.5.
  - Site and exterior backbone rows and exterior modules (site_work, exterior_improvements, roofing, below_grade_structural, structural_exterior_rebuild) run as one flow from Mobilization and join at **Final Clean**, never at Make Safe.
- **Below-grade structure** (`below_grade_structural`):
  - CIP lifts (1–3, `wallLifts`) with 3 WD cure lags; the lid needs 5 WD of cure before backfill.
  - Waterproofing has a QC hold that gates backfill.
  - Rows scale with `footprintSf`, not site area.
  - `precast`: a leveling pad, then a crane set at FS+3.
  - The as-built slip on C1 (+97% from redesign) is a risk note, not a duration.
- **Exterior structural rebuild** (`structural_exterior_rebuild`): one ~25 WD building cycle, not SF-scaled. Repeat it per building via phases/zones; stagger mode awaits a user decision (LL-2026-10-14-02).
- **Weather:** one visible row after the last exposed row and its inspection. Size = ceil(exposed WD × the average monthly rate over the exposed span), with rates 0.10 Oct–Jun and 0.05 Jul–Sep, capped at 20. `weatherDays` overrides it.
- **Precon:**
  - Design-document reviews start at NTP and feed the job-start gate.
  - Sub shop drawings, permits and `Submittals:` rows start at subcontract signing, chain within their trade, and feed Ready to Mobilize.
- **Post-SC and closeout:**
  - Rows after SC move to closeout.
  - Module AHJ tests (FA acceptance, hood trip test) are branches into Final Clean.
  - Phase turnover and re-mobilization need more than one phase.
  - Closeout is measured SC → Final Walk; billing rows run beside it.
- **Contract-value envelope:** `valueEnvelopeWd` = 27.3·(V/$100k)^0.511 for interior tiers. V is escalated 4%/yr, net of owner equipment over 25% of value. It is a warn-only pre-flight check (0.6–1.6×), shown with the SF envelope and their geometric mean.
- **Food service:**
  - GPR scan and core before under-slab plumbing.
  - "All MEP Below Slab Complete" releases millwork.
  - MEP through millwork runs SS+1.
- **Scope options:** `ownerStoredItems` adds an FF&E transport row.
- **User decisions, LL-2026-10-14-03 (canon):**
  - Micro jobs carry a 1 WD re-inspection contingency (a value typed in the scope profile wins).
  - The UNT 72 h profile is the default when the project name identifies UNT.
  - `buildings` > 1 leapfrogs `structural_exterior_rebuild`: building k starts SS+5 after building k-1, and each trade follows its own crew from the previous building. This is an exception to LL-21.
  - Small site-only jobs (exterior tier, micro band by contract value) take 1 WD each for Mobilization, Final Clean and the SC walk.
  - Healthcare mockup gates apply to `mep_lab` in the healthcare sector.

## Overlap model

- `OVERLAP_LINKS`: 51 SS/FF/FS links with lags. A link is adopted when at least 2 of 3 council
  seats proposed the identical pair; the lag is the median (scripts/council_lag_merge.mjs).
  Examples: framing → wall rough-in SS+2 / FF+2, drywall → prime SS+5, prime → floor prep SS+2,
  NTP → each preconstruction track SS+0–3.
- A council link replaces the plain sequential link into a task. Hard gates (cover-up, above-ceiling,
  moisture, underground inspection, make safe, final clean, SC, final walk, turnover) hold only the
  work linked to them explicitly. An SS lag never exceeds the predecessor's duration.
- Module rows in construction and closeout run as their own trade flow: the first row starts SS+1
  after its anchor (FS if the anchor is a hard gate), and later rows follow in order.
- Any task left without a successor feeds the next hard gate in its phase, so every activity has
  a predecessor and a successor (DISD).

## Wiring rules (deterministic)

- Sequential FS by default in backbone order; module rows insert right after their anchor in
  council `seq` order (overrides: `knowledge/council/anchor-overrides.json`).
- `parallel` rows (submittals, permits, recurring logs, training, coordination) hang off their
  anchor and feed the next protected gate/milestone in the phase, so a late permit pushes the
  schedule instead of showing false float.
- Reference milestones (`predOffset: null`, e.g. SC date per contract) never carry the chain.
- Anchor removed with a declined module → nearest preceding backbone row present.
- Actuals win: `actualStart/actualFinish` override CPM; `constraintStart` = start-no-earlier-than.

## Non-negotiable sequence rules (checked in pre-flight, `preflight.js`)

Council notes, seats agreeing in brackets (A Sonnet, B Fable, C Opus — 2026-10-13):

1. Abatement clearance before any demolition in the area. [A B C]
2. In-wall rough-in, firestopping and insulation pass pre-cover inspection before walls close. [A B C]
3. Above-ceiling inspection before ceiling tile (grid may go up first). [A B C]
4. Underground inspection before trench infill / pourback. [B C]
5. Life-safety acceptance (FA 100% test, sprinkler final, egress release) before fire marshal / building final / CO. [B C, A by sequence]
6. ICRA barriers and negative air up before demo; removed only after terminal clean and Infection Prevention clearance. [A B C]
7. Finish paint before flooring; slab moisture/pH test before resilient flooring. [A B C] → backbone LL-2026-10-13-04
8. Long-lead equipment released at submittal approval; approval + lead time tracked against need-by. [A B C] → trackers
9. TDLR TAS registration / RAS review in precon, RAS inspection within 1 year of SC. [A B C] → backbone LL-2026-10-13-03
10. TAB / controls checkout before commissioning and pressure verification. [B C]
11. Building / FA / sprinkler permits in hand before covered rough-in. [A C] → *proposed backbone gate, awaiting user (2/3 is not overwhelming)*

NTXP backbone rules (user canon, not council): final clean before owner punch walk; punch complete
before turnover. Imaging module rows (2–3 seats each): physicist shielding inspection before closing
lead-lined walls.

## Inference vs determinism

Priorities: reliability first, then cost/tokens, then output quality.

| Step | Mode | Why |
|---|---|---|
| CPM passes, float, critical path | **Determinism** (scheduler.js) | Arithmetic; must be reproducible |
| Module detection from text | **Determinism** (keywords) | Cheap, auditable; confirmation is human/document |
| Module confirmation | **User / document** | Gate, not a guess |
| Line-item classification | **Determinism** (library + rules); inference only if no match and item is high impact | 95% of items match |
| Backbone + module composition | **Determinism** (jevTree.js) | Same inputs → same schedule |
| Spec / Project Manual reading | **Inference** (frontier, `spec_requirements`) | Unstructured legal text, high impact |
| Initial schedule review | **Inference** (frontier, once) | High stakes, one-time |
| Meeting / email / transcript extraction | **Inference** (mid) → output is a *proposal* | Language; verified by JEV rules |
| Daily report vs plan comparison | **Inference** (mid-high) | Photos/comments; deviations become rated items |
| JobTread date push / pull diff | **Determinism** (`schedule_diff.mjs`) | Exact compare |
| AP invoice rules (20th, PO, waiver, PM approval) | **Determinism** (trackers.js) | Rule check |
| Rating impact 1–5 | **Determinism** first; rating ≥4 escalates to inference for narrative and options | Gate wording matters |
| Milestone impact assessment | **Inference** (high) + user permission | Owner/contract consequences |
| Changelog, exports, MSPDI | **Determinism** | |
| Pre-flight layout/sequence checks | **Determinism**; council reviews the results | |
| Lessons learned conclusions | **Inference** (frontier) + council vote | Methodology change |
| Research sweeps | **Inference** (low/mid seats) | Volume, low stakes |

Rule of thumb: **intelligence monitors and improves the JEV tree; the JEV tree runs the job.**
