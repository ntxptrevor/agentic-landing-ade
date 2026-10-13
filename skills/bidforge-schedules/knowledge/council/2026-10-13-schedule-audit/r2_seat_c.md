# Round 2 — Seat C

```
cluster | from_task | to_task | type | lag_wd | vote | reason
K1 | Prime Coat Walls | Prep Floor — Level or Grind | SS | 2 | yes | Floor prep follows prime by area; removes the full Ceiling Tile→Rough Clean→Clear Floors gate from the flooring start.
K1 | Prep Floor — Level or Grind | Slab Moisture / pH Testing (Resilient Flooring) | SS | 1 | yes | Testing runs zone-by-zone on prepped slab; Moisture→Flooring FS kept, so the resilient QA gate stays intact.
K1 | Prime Coat Walls | Install Flooring — All Types | SS | 3 | no | Skips the prep/moisture gate; lets flooring go down before slab acceptance (warranty risk).
K2 | Salvage Owner Items (Retain/Reuse/Turnover) | Selective & Interior Trench Demo | SS | 1 | yes | Demo starts in cleared zones while salvage finishes elsewhere.
K2 | Selective & Interior Trench Demo | GPR Scanning — Demo & Core Locations | SS | 1 | yes | GPR scans each zone as it opens; adopted GPR→Core Drilling FS0 still protects coring.
K2 | Selective Demo (Core Drilling Wall & Floor Penetrations) | NLB Framing | SS | 2 | yes | Framing follows coring by zone; most walls do not sit on core or trench locations.
K3 | GC PM / Super Pre-Punch | Install ADA Room Signage | SS | 1 | yes | Signage goes in room by room behind the pre-punch walk; it does not need the whole walk done.
K3 | Install ADA Room Signage | Furniture, Wall Hangings & Owner Item Installation | SS | 1 | yes | Independent crews in different rooms; owner items follow signage by area.
K3 | Furniture, Wall Hangings & Owner Item Installation | Final Clean | FF | 1 | yes | Clean trails owner-item install and finishes 1 day after it, not a full serial block.
K4 | GC Generated Punch List Sent to Architect / Owner | Perform Punch Corrections | SS | 2 | yes | GC starts on its own punch items while the architect reviews; approved additions get folded in.
K4 | Perform Punch Corrections | Complete Punch Items | SS | 5 | yes | Keeps the protected Complete Punch Items row; verification overlaps the second half of corrections.
K4 | Perform Punch Corrections | Complete Punch Items | FS | 0 | no | Current serial link (and merging the rows) rejected; the row is user-protected and serial double-counts the punch.
```

Other remaining serialization:
- Pourback — Interior Trenches → Structural Metals / Masonry / Framing (10d) looks fully FS. Needs SS by zone, or Structural should hang off Demo, not Pourback.
- Drywall & Taping (10d) → Prime Coat Walls → Ceiling Grid looks serial. Prime should be SS4 off Drywall, and Grid SS2 off Prime.
- Ceiling Tile Installation → Rough Clean should be SS2, not FS. Tile is not a floor gate once K1 is adopted.
- Doors/Hardware and Controls start-up (53–57) should be checked for FS chains into Final Clean. They should feed Owner Punch Walk with FF instead.
- Scenario A's only module is isd_college. Its flooring/paint tail is the whole critical path, so K1 matters most there.
