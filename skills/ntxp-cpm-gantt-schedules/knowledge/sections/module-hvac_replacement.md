---
id: module-hvac_replacement
version: 2
updated: 2026-10-13
hash: e704b580156f
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — HVAC Equipment Replacement (Council-added)

Class: standard_renovation

Confirm question: Is major HVAC equipment (RTU / AHU / chiller) being replaced?

Detection keywords: rtu replacement, ahu replacement, chiller, crane pick, temporary cooling, rooftop unit, refrigerant recovery, crane, boiler, cooling tower, central plant, hvac replacement, mechanical upgrade, dx unit

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Crane Lift Plan & Street/Lane Closure Permit | 3 | HVAC | project_management | Y 0d | preconstruction | Infection Control & Logistics Meeting | Y | 2 |  |
| Submittals: RTU/AHU/Chiller Replacement Equipment | 7 | HVAC | design | Y 120d | preconstruction | Confirm Job Start Approval (Gate) | Y | 2 |  |
| Temporary Cooling/Heating Rental Setup | 2 | HVAC | project_management | N | construction | Mobilization |  | 2 |  |
| Structural Review of Roof for New Unit Weights | 5 | Architect | design | Y 0d | construction | Site Work |  | 3 |  |
| Existing Unit Disconnect & Refrigerant Recovery | 1 | HVAC | standard_renovation | N | construction | Make Safe |  | 2 |  |
| New equipment set by crane | 1 | HVAC | standard_renovation | N | construction | Selective & Interior Trench Demo |  | 2 |  |
| Curb Adapters & Roof Patching at Units | 2 | HVAC | standard_renovation | Y 21d | construction | Drywall Hang |  | 2 |  |
| Manufacturer Factory Startup & Warranty Registration | 1 | HVAC | standard_renovation | N | construction | Start Up Control Systems & Test | Y | 2 |  |
| EPA Refrigerant Records & Old Unit Disposal Docs | 1 | HVAC | project_management | N | closeout | Turnover (Project Complete) |  | 2 |  |

## Changelog
- v2 2026-10-13 — regenerated (hash e704b580156f)
- v1 2026-10-13 — regenerated (hash 5cb27f7c6d11)
