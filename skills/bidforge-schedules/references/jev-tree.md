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
