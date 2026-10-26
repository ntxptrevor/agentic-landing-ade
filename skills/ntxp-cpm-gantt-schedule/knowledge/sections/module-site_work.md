---
id: module-site_work
version: 1
updated: 2026-10-13
hash: 0ba998ffabfa
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — Exterior Site Work

Class: standard_renovation

Confirm question: Is there excavation, grading, paving or site-utility work?

Detection keywords: excavation, grading, earthwork, division 31, division 32, paving, asphalt, site concrete, storm drain, utility trench, division 33, swppp, sidewalk, site work, parking lot, site utilities, sitework, silt fence, fill, subgrade, curb, ada ramp, striping, landscape, irrigation, planting

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Texas 811 Locates & Private Utility Survey | 3 | Earthwork | design | N | construction | Site Work |  | 3 |  |
| SWPPP / TCEQ NOI & Erosion Control Install | 2 | Earthwork | permit | N | construction | Site Work |  | 3 |  |
| Site Demolition (Paving, Curbs, Sidewalks) | 3 | Demolition | standard_renovation | N | construction | Site Work |  | 2 |  |
| Earthwork, Grading & Subgrade Prep | 4 | Earthwork | standard_renovation | N | construction | Site Work |  | 2 |  |
| Site Utilities Install (Water, Sewer, Storm) | 8 | Utilities | standard_renovation | Y 21d | construction | Site Work |  | 3 | Y |
| Utility Tie-In & City Inspection | 1 | AHJ | inspection | N | construction | Site Work |  | 3 | Y |
| Concrete Paving, Curbs, Sidewalks & ADA Ramps | 6 | Concrete | standard_renovation | Y 7d | construction | Pourback — Exterior |  | 3 | Y |
| Landscape, Irrigation & Sod | 4 | Landscape | standard_renovation | N | construction | Landscape Repairs |  | 2 | Y |
| Final Stabilization & SWPPP NOT Filed | 1 | GC | project_management | N | closeout | GC Generated Punch List Sent to Architect / Owner |  | 2 |  |

## Changelog
- v1 2026-10-13 — regenerated (hash 0ba998ffabfa)
