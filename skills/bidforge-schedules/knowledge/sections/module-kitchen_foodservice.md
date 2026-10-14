---
id: module-kitchen_foodservice
version: 2
updated: 2026-10-13
hash: 3b451287567d
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — Kitchen / Food Service

Class: standard_renovation

Confirm question: Is there commercial kitchen or food-service work?

Detection keywords: kitchen equipment, food service, walk-in cooler, grease interceptor, kitchen hood, type i hood, health department, kitchen, foodservice, cafeteria, hood, serving line, commercial kitchen, 11 40, food permit, grease trap, ansul, walk-in, dishwasher, plan review, floor drain, trench drain, make-up air, grease duct, refrigeration, health inspection

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Submittals: Foodservice Equipment & Exhaust Hood | 7 | Kitchen Equipment | design | Y 84d | preconstruction | Confirm Job Start Approval (Gate) | Y | 2 |  |
| Health Department Plan Review | 15 | AHJ | permit | N | preconstruction | Confirm Job Start Approval (Gate) |  | 3 |  |
| Grease interceptor and grease waste piping | 3 | Plumbing | standard_renovation | Y 35d | construction | Interior Underground Plumbing |  | 2 |  |
| Grease Interceptor, Floor Sinks & Trench Drains | 2 | Plumbing | standard_renovation | N | construction | Wall MEP Rough |  | 2 |  |
| Makeup Air Unit & Hood Exhaust Fan Set | 2 | HVAC | life_safety | Y 70d | construction | Drywall Hang |  | 2 |  |
| Welded Grease Duct & Rated Enclosure | 4 | HVAC | standard_renovation | Y 0d | construction | Drywall Hang |  | 2 |  |
| Walk-In Cooler/Freezer Installation | 3 | Kitchen Equipment | standard_renovation | Y 56d | construction | Install Millwork / Cabinetry / Casework |  | 3 |  |
| Kitchen Equipment Set & Utility Connections | 5 | Kitchen Equipment | standard_renovation | Y 84d | construction | Install Doors |  | 3 |  |
| Hood Fire Suppression System Install | 2 | Fire Sprinkler | life_safety | Y 21d | construction | Install Doors |  | 2 |  |
| Hood Suppression Trip Test & Fire Marshal Inspection | 1 | AHJ | inspection | N | construction | Test, Adjust & Balance (TAB) |  | 2 |  |
| Health Department Final Inspection | 1 | AHJ | inspection | N | construction | Owner Punch Walk / Substantial Completion |  | 3 |  |
| Foodservice Equipment Startup & Staff Training | 1 | Food Service Equipment | project_management | N | closeout | Turnover (Project Complete) | Y | 2 |  |

## Changelog
- v2 2026-10-13 — regenerated (hash 3b451287567d)
- v1 2026-10-13 — regenerated (hash 6519a5229512)
