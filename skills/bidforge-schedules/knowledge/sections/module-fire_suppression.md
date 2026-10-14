---
id: module-fire_suppression
version: 2
updated: 2026-10-13
hash: 2869d3ebbc08
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — Fire Suppression

Class: life_safety

Confirm question: Does the scope modify or add fire sprinkler / suppression?

Detection keywords: fire sprinkler, sprinkler, fire suppression, division 21, 21 13, standpipe, fire pump, clean agent, nfpa 13, sprinkler head, fire protection, fire marshal, backflow, sprinkler permit, impairment, 200 psi, fm-200, riser

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Sprinkler Hydraulic Calcs & Shop Drawings | 10 | Fire Sprinkler | life_safety | Y 21d | preconstruction | Confirm Job Start Approval (Gate) | Y | 3 |  |
| Sprinkler Permit Submittal to Fire Marshal | 1 | AHJ | permit | N | preconstruction | Confirm Job Start Approval (Gate) | Y | 3 |  |
| Sprinkler Impairment Notice & Fire Watch | 1 | Fire Sprinkler | life_safety | N | construction | Make Safe |  | 3 |  |
| Sprinkler Drain-Down & Head/Branch Demo | 2 | Fire Sprinkler | life_safety | N | construction | Selective & Interior Trench Demo |  | 2 |  |
| Sprinkler Main & Branch Line Relocation | 5 | Fire Sprinkler | life_safety | Y 14d | construction | Overhead MEP Rough |  | 3 | Y |
| Sprinkler Hydrostatic Test (200 psi / 2 hr) | 1 | AHJ | inspection | N | construction | Overhead MEP Rough |  | 2 | Y |
| Sprinkler Heads & Escutcheons Trim | 3 | Fire Sprinkler | life_safety | Y 14d | construction | Ceiling Grid or Hard Lid Installation & Prime |  | 3 |  |
| Clean agent suppression for IT/records rooms installed | 3 | Fire Sprinkler | life_safety | Y 56d | construction | Install Doors |  | 2 |  |
| Sprinkler Final, Main Drain & Flow Test | 1 | Fire Sprinkler | inspection | N | construction | Test, Adjust & Balance (TAB) |  | 3 |  |
| Contractor's Material & Test Certificate (NFPA 13) | 1 | Fire Sprinkler | project_management | Y 0d | closeout | Turnover (Project Complete) |  | 2 |  |

## Changelog
- v2 2026-10-13 — regenerated (hash 2869d3ebbc08)
- v1 2026-10-13 — regenerated (hash e3d01de9d47f)
