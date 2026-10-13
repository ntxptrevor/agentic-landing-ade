---
id: module-abatement
version: 1
updated: 2026-10-13
hash: 13575cbc4dc2
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — Abatement (Asbestos / Lead)

Class: life_safety

Confirm question: Is any asbestos, lead or other hazardous-material abatement required?

Detection keywords: asbestos, acm, lead-based paint, lead paint, abatement, hazardous material, 02 82, 02 83, mold remediation, tdshs, mold, dshs, hazardous materials, neshap, ahera, mercury, negative air, clearance, clearance letter, disposal, mastic, pipe insulation

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Licensed Asbestos/Lead Survey Confirmation (DSHS) | 5 | Abatement | inspection | N | preconstruction | Confirm Job Start Approval (Gate) |  | 3 |  |
| Abatement Project Design & Work Plan | 5 | Abatement | permit | Y 0d | preconstruction | Confirm Job Start Approval (Gate) |  | 3 |  |
| Abatement Containment & Negative Air Setup | 2 | Abatement | standard_renovation | N | construction | Salvage Owner Items (Retain/Reuse/Turnover) |  | 3 | Y |
| Asbestos / Lead / Mold Removal | 8 | Abatement | life_safety | N | construction | Salvage Owner Items (Retain/Reuse/Turnover) |  | 2 | Y |
| Visual Inspection & Final Air Clearance (Third-Party) | 1 | Abatement | inspection | N | construction | Salvage Owner Items (Retain/Reuse/Turnover) |  | 3 | Y |
| Waste Manifests & Abatement Closeout Report | 2 | Abatement | project_management | N | closeout | Begin Closeout Documentation | Y | 2 | Y |

## Changelog
- v1 2026-10-13 — regenerated (hash 13575cbc4dc2)
