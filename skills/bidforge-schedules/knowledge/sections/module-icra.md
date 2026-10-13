---
id: module-icra
version: 1
updated: 2026-10-13
hash: 7e4142a30b16
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — ICRA Containment / Infection Control

Class: hospital

Confirm question: Is the work in an occupied healthcare area that requires ICRA containment?

Detection keywords: icra, infection control, negative air, anteroom, class iii, class iv, pcra, hepa, hospital, clinic, patient care, negative pressure, infection prevention, barrier removal, ilsm, pressure, manometer, hard barrier, above ceiling permit, terminal clean, fire watch, egress

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| ICRA Permit Signed by Infection Prevention | 3 | Owner | life_safety | N | preconstruction | Submittal Register Approval | Y | 3 |  |
| Hard-Wall ICRA Barriers & Anteroom Construction | 2 | GC | hospital | N | construction | Interior Containment |  | 3 | Y |
| Negative Air Machines & HEPA Exhaust Setup | 1 | GC | life_safety | Y 0d | construction | Interior Containment |  | 2 | Y |
| ICRA Barrier Inspection by Infection Prevention | 1 | Owner | life_safety | N | construction | Interior Containment |  | 3 | Y |
| Above-ceiling work permits and daily ICRA inspection (recurring) | 1 | GC | life_safety | N | construction | Selective & Interior Trench Demo | Y | 2 |  |
| Daily Pressure Monitoring & Barrier Log (Recurring) | 1 | GC | life_safety | N | construction | Selective & Interior Trench Demo | Y | 3 |  |
| HEPA Terminal Clean & ICRA Barrier Removal | 2 | GC | hospital | N | construction | Final Clean |  | 3 | Y |

## Changelog
- v1 2026-10-13 — regenerated (hash 7e4142a30b16)
