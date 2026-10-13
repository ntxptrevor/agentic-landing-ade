---
id: module-secured_building
version: 1
updated: 2026-10-13
hash: 83d83608fac9
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — Secured Building (Jail / Court / Holding)

Class: security

Confirm question: Is the building a jail, court, holding area or other secured facility?

Detection keywords: detention, jail, holding cell, sally port, courtroom, court, security hollow metal, detention hardware, security glazing, escort, tcjs, cell, holding, correctional, judicial, juvenile, sheriff, lock, tool control, contraband, security clearance, inmate, detention door, security ceiling, control room, intercom

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Escorted Work Zones & Daily Tool Inventory | 1 | GC | security | Y 0d | preconstruction | Infection Control & Logistics Meeting | Y | 2 |  |
| Escort, secured-zone and inmate movement coordination plan | 2 | Owner | oac | N | preconstruction | Infection Control & Logistics Meeting | Y | 2 |  |
| Tool & Material Control (Contraband) Plan | 2 | GC | security | N | preconstruction | Submittal Register Approval |  | 2 |  |
| Facility Security Clearance & Background Checks | 10 | GC | security | N | preconstruction | All Subcontracts Signed — Confirmed |  | 3 |  |
| Submittals: Detention Equipment, Glazing & Fixtures | 10 | Detention Equipment | security | Y 84d | preconstruction | Confirm Job Start Approval (Gate) | Y | 2 |  |
| Detention Frames Set & Grouted | 6 | Detention Equipment | security | Y 112d | construction | Wood Blocking (Millwork, Windows, Wall-Mounted Items) |  | 3 |  |
| Grouted/Reinforced CMU Security Walls | 4 | Detention Equipment | security | N | construction | Wall MEP Rough |  | 2 |  |
| Security Electronics (Intercom, PLC) Rough-In | 5 | Low Voltage | security | N | construction | Wall MEP Rough |  | 3 | Y |
| Security Ceilings & Sheet Steel Barrier Install | 4 | Ceilings | security | Y 56d | construction | Ceiling Grid or Hard Lid Installation & Prime |  | 3 |  |
| Security Glazing & Vision Panels | 2 | Millwork | security | Y 70d | construction | Install Millwork / Cabinetry / Casework |  | 2 |  |
| Detention Doors, Locks & Sliding Devices | 4 | Detention Equipment | security | Y 84d | construction | Install Doors |  | 2 |  |
| Detention Plumbing Fixtures (Combo Units) | 2 | Plumbing | security | Y 84d | construction | Install Doors |  | 2 |  |
| Tamper-Resistant Fasteners & Security Sealant | 2 | GC | security | N | construction | Install Doors |  | 2 |  |
| Texas Commission on Jail Standards Inspection | 1 | AHJ | inspection | N | construction | Owner Punch Walk / Substantial Completion |  | 2 |  |

## Changelog
- v1 2026-10-13 — regenerated (hash 83d83608fac9)
