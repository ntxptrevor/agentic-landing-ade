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
