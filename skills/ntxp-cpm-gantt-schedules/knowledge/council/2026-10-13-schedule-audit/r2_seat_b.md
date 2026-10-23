```
cluster | from_task | to_task | type | lag_wd | vote | reason
K1 | Prime Coat Walls | Prep Floor — Level or Grind | SS | 2 | yes | By area after prime (Ralls: prime, grid, flooring start together); frees prep from the tile tail
K1 | Prime Coat Walls | Install Flooring — All Types | SS | 3 | yes | Rule 7 off the paint row; Moisture FS0 gate still governs resilient
K1 | Ceiling Tile Installation | Rough Clean | SS | 1 | yes | Clean trails the tile crew; stops Clear Floors re-serializing behind T-Bar
K2 | Salvage Owner Items (Retain/Reuse/Turnover) | Selective & Interior Trench Demo | SS | 1 | yes | Parkland: salvage SS with Zone 1 demo
K2 | Selective & Interior Trench Demo | GPR Scanning — Demo & Core Locations | SS | 2 | yes | Scan as demo opens areas; GPR→Core FS0 stays, so Demo→Core SS1 is dominated
K2 | Selective & Interior Trench Demo | NLB Framing | SS | 3 | yes | Walls off trenches frame during demo (TAMU overlapped 6 d); gut tier still ruled by Structural/Pourback
K3 | Install Wall Base | Install ADA Room Signage | SS | 1 | yes | Signage is a finish trade, not a pre-punch successor
K3 | GC PM / Super Pre-Punch | Furniture, Wall Hangings & Owner Item Installation | SS | 1 | yes | Owner items set behind the walk; Final Clean gate collects both
K4 | Perform Punch Corrections | Complete Punch Items | SS | 5 | yes | Both lists close ~10 WD after the walk (Ralls: 10 WD); detaches Complete Punch from the docs chain
K4 | Perform Punch Corrections | Complete Punch Items | FS | 0 | no | Double-counts punch at 15 WD; merge needs the user
```

Also serializing:

1. Overhead MEP Rough keeps a backbone FS from Cover-Up Inspections (gate links kept), so overhead, T-Bar and tile wait ~9 WD; let Wall MEP Rough SS0 drive it.
2. Slab Moisture should follow Clear Floors; needs Clear Floors→Moisture FS0 plus Prep Floor→Install Flooring FS0 together, or feedDeadEnds re-adds Prep→Moisture.
3. Verify Acceptance of Closeout Docs inherits FS from Complete Punch Items; Submit 100% Pay App dead-ends into Final Walk; rewire both or K4 saves nothing.
4. No Finish Paint row: Prime (3 d) proxies paint, and the SS clamp already cuts Doors SS5 / Millwork SS4 to SS2.
