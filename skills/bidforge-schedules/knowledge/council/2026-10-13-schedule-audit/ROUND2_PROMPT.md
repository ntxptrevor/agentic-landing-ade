Round 2 of the independent NTXP model council schedule audit. You are one seat. Research and judgment only: write exactly one file (OUTFILE). Do not coordinate with other seats.

Round 1 (files seat_a.md, seat_b.md, seat_c.md in DIR) was implemented. Links adopted: those proposed with the identical from/to/type by at least 2 seats. Results now (engine_audit_after.json in DIR): construction tasks run 91% concurrent, but construction WD is still above the band the council agreed (B 92 vs 60–85; C 116 vs 75–100; E 81 vs 55–80; A 47 vs 20–35; D 41 vs 15–36).

The critical path still runs through four relationship clusters. In round 1 all three seats proposed an overlap for each cluster, but each used a different exact task pair, so none was adopted. Vote on one unified rule per cluster.

Task names (exact, from backbone.md): Ceiling Tile Installation, Rough Clean, Clear Floors, Prep Floor — Level or Grind, Slab Moisture / pH Testing (Resilient Flooring), Install Flooring — All Types, Prime Coat Walls, Selective & Interior Trench Demo, GPR Scanning — Demo & Core Locations, Selective Demo (Core Drilling Wall & Floor Penetrations), NLB Framing, Salvage Owner Items (Retain/Reuse/Turnover), Install Wall Base, GC PM / Super Pre-Punch, Install ADA Room Signage, Furniture, Wall Hangings & Owner Item Installation, Final Clean, GC Generated Punch List Sent to Architect / Owner, Perform Punch Corrections, Complete Punch Items.

Round-1 proposals per cluster:
- K1 Flooring start. A: Prime Coat Walls→Prep Floor SS2 (by area, after Clear Floors). C: Prime Coat Walls→Install Flooring SS3 +FF2. B: (new) Finish Paint→Prep Floor SS2 and Finish Paint→Install Flooring SS4. Today the engine runs Ceiling Tile→Rough Clean→Clear Floors→Prep Floor→Moisture→Flooring as a serial FS tail.
- K2 Demolition by zone. A: Trench Demo→Core Drilling SS1 by zone. B: Trench Demo→Structural SS3, Make Safe→Trench Demo SS1. C: Trench Demo→NLB Framing SS3 (walls not on trenches) +FF2, Salvage→Trench Demo SS1. GPR→Core Drilling FS0 is adopted (3/3). Today Salvage→Trench Demo→GPR→Core Drilling→NLB Framing is serial FS.
- K3 Finish-out tail. Today GC Pre-Punch→ADA Signage→Furniture/Owner Items→Final Clean is serial. No seat proposed a link for signage or furniture.
- K4 Punch. A: Perform Punch Corrections→Complete Punch Items SS5. B: Architect Approved Punch List→Perform Punch Corrections FF5. C: merge Complete Punch Items into Perform Punch Corrections (note: Complete Punch Items is a user-protected critical row and cannot be removed without the user).

Write OUTFILE as a pipe-delimited block, with one row per link you vote to adopt:
`cluster | from_task | to_task | type(SS/FF/FS) | lag_wd | vote(yes/no) | one-line reason`
Use only the exact task names above. Propose 1–3 rows per cluster. Mark each `yes` or `no`. A `no` row records a link you reject. After the block, write at most 5 lines on anything else still serializing construction that the round-1 implementation missed. Keep it under 350 words. Reply with a one-line confirmation.
