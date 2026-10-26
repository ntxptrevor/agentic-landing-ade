# Seat C: NTXP CPM Gantt Schedules Schedule Engine Audit

## 1. Verdict

All five **FAIL**: 3.4 to 4.7 times benchmark WD, 0–8% concurrent, 89–95% critical.

| Scn | Engine constr WD / total CD | Realistic constr WD | Realistic total CD | Result | Reason |
|---|---|---|---|---|---|
| A ISD refresh 3k SF | 147 / 353 | 20–35 | 65–100 | **FAIL** | A finishes job carries structural, underground and wall-rough rows. It would miss the summer window. |
| B Standard 10k SF | 237 / 490 | 60–85 | 140–190 | **FAIL** | Construction WD equals the sum of durations, so nothing overlaps. Typical is 3–6 months on site. |
| C Clinic ICRA 6k SF | 282 / 569 | 75–100 | 175–230 | **FAIL** | Parkland (~2k SF, ICRA IV) took 79–83 WD and a clinic took 16 weeks. |
| D ISD RTU x4 | 158 / 380 | 20–35 | 120–200 (set by lead time) | **FAIL** | This is a crane-and-connect job. Lead time, not the interior backbone, should drive it. |
| E Jail holding 4k SF | 232 / 498 | 55–80 | 140–185 | **FAIL** | Secure work adds drag, but not 232 WD. |

Precon (72–89 WD vs 16–42 real) and closeout (36 WD vs 7–13 real) also fail.

## 2. Root causes (ranked)

1. **FS-only serial wiring.** Sum of durations ≈ construction WD (237/237). Real NTXP CPMs run 80–95% concurrent with SS+1 to SS+5 ladders (`engine_audit_before.json`; `jev-tree.md`; `drive_benchmarks.md`: Parkland 87%, Ralls 91%, TAMU 89–95%).
2. **Scope tier does not gate the backbone.** Underground, structural, wall rough and millwork are always present, so light work carries a gut chain (`backbone.md`; A has 79 activities).
3. **No size or sector scaling.** 3k and 10k SF use the same durations. Both prior skills scale (`ntxp_gantt_schedule_SKILL.md` §4; `cpm_schedule_SKILL.md` Step 3).
4. **Serial precon.** Only TDLR is parallel. The full 15 d of Submittal Processing gates mobilization instead of the specific installs (`backbone.md`). Real precon: Ralls 42, TAMU 20, Parkland 16 WD (`drive_benchmarks.md`).
5. **Serial closeout with punch counted twice.** Corrections 10 d is followed by Complete Punch 5 d, for 36 WD. Ralls ran 13 WD and TAMU 7 (`backbone.md`; `drive_benchmarks.md`).
6. **No float.** 89–95% of activities are critical, which violates the DISD 10% float rule (`drive_benchmarks.md` §6).
7. **No procurement pull.** RTU lead time drives D but is never modeled (`ntxp_gantt_schedule_SKILL.md` §4; Ralls lead bars 36–81 WD).
8. **Module rows spliced in series.** C has 151 rows (`jev-tree.md`).
9. **No holiday or inspection-window calendars** (Parkland HW comments 4–5).

## 3. Recommended changes

| id | change | value | effort | evidence | adopt? |
|---|---|---|---|---|---|
| R1 | Overlap model: SS/FF pairs per §4. FS only at hard gates (inspections, ICRA, med gas, mockups). | High | M | Parkland/Ralls/TAMU | **yes** |
| R2 | Scope tiers gate backbone rows (list below). | High | S | Gantt intake; CPM exclusions | **yes** |
| R3 | Envelope plus per-task scaling, quantity rates when known; fixed-time rows exempt (§5). | High | M | Gantt §4; CPM multipliers | **yes** |
| R4 | Parallel precon off NTP; submittals by package at 14 CD review (21 CD TxDOT). Mobilization needs only first-3-week submittals, badging, subs and schedule. | High | S | Ralls/TAMU/Parkland; HW 14-day note | **yes** |
| R5 | Cap construction rows at 10 WD; split by area or sub-trade. Exempt admin, procurement, cure, mob. | Med | S | DISD 01 32 16 | **yes** |
| R6 | Procurement pull: order-by = need-by − lead − review. Flag release-at-risk. Delivery feeds the install row. | High | M | Gantt §4; Ralls | **yes** |
| R7 | Area repetition: over 5k SF or occupied/phased, use 2–3 areas offset SS+1 to SS+3, each with its own inspections. | High | L | Parkland zones; Ralls restrooms | **yes** |
| R8 | Pre-flight gate: within ±25% of envelope, ≥70% concurrent, ≤50% critical, ≥10% float. Warn on a miss, never auto-compress. | High | S | DISD; Gantt | **yes** |
| R9 | Merge closeout rows 3 and 6 (10 WD max). Closeout docs SS with finishes. | High | S | Ralls/TAMU | **yes** |
| R10 | Holiday/school calendars; state inspections as week windows. | Med | S | Parkland comments | **yes** |
| R11 | Inspections as 0–1 d holds with 2 d re-inspection contingency and 5 WD notice. | Med | S | Parkland; Ralls | **yes** |
| R12 | Healthcare mockup gates before rough-in and before finishes. | Med | S | Parkland HW #6 | **yes** |

**R2 drops (construction row numbers):**
- **Light refresh:**
  - Drop 14–30, 32, 45, 53–54, 56–57.
  - Row 13 becomes a 2–3 d finish demo.
  - Row 31 becomes a 2 d patch.
  - Keep 34 only if MEP is touched above the ceiling.
- **Standard:** drop 16–20 (unless plumbing relocates), 21 (unless structural), 14–15 (unless coring), 28 (unless equipment).
- **Heavy MEP:** Standard rows, plus 16–20, 28, 56–57 and TAB required.
- **Full gut:** all rows.
- **Equipment tier (needed for D):** keep 1, 10–11, 28, 34, 56–59, plus crane, curbs and TAB.

## 4. Lag table (machine-usable)

```
from_task | to_task | type | lag_wd | condition
Notice to Proceed (NTP) | Preliminary Schedule Submitted | SS | 0 | always
Notice to Proceed (NTP) | MBE / SBE / HUB Plans Submitted | SS | 0 | always
Notice to Proceed (NTP) | Badging Meeting & Processing Time | SS | 2 | ISD/medical/jail
Notice to Proceed (NTP) | All Subcontracts Signed — Confirmed | SS | 0 | always
Submittal Register Approval | Submittal Processing Time | SS | 2 | per package, 14 CD review
Salvage Owner Items (Retain/Reuse/Turnover) | Selective & Interior Trench Demo | SS | 1 | always
GPR Scanning — Demo & Core Locations | Selective Demo (Core Drilling Wall & Floor Penetrations) | FS | 0 | hard gate
Selective & Interior Trench Demo | Interior Underground Plumbing | SS | 3 | released area; +FF2
Selective & Interior Trench Demo | NLB Framing | SS | 3 | walls not on trenches; +FF2
Pourback — Interior Trenches | NLB Framing | FS | 2 | walls on trenches
Structural Metals / Masonry / Framing | NLB Framing | SS | 3 | during CMU cure; +FF2
NLB Framing | Wood Blocking (Millwork, Windows, Wall-Mounted Items) | SS | 1 | +FF1
NLB Framing | Install Door Frames | SS | 2 | +FF1
NLB Framing | Wall MEP Rough | SS | 2 | +FF2
Wall MEP Rough | Overhead MEP Rough | SS | 0 | +FF2
Overhead MEP Rough | Fire Suppression Main Lines & Branch Pipe Rough | SS | 0 | fire_suppression
Wall MEP Rough | Fire Alarm & Low Voltage Prewiring | SS | 3 | +FF1
Overhead MEP Rough | MEP Equipment Installation (Panels / HVAC Units) | SS | 3 | delivered
Wall MEP Rough | Fire Sealing — Wall & Floor Penetrations | SS | 3 | +FF1
Fire Sealing — Wall & Floor Penetrations | Cover-Up Inspections | FS | 0 | hard, per area
Cover-Up Inspections | Drywall & Taping | FS | 0 | hard, per area; next area SS3
Drywall & Taping | Prime Coat Walls | SS | 5 | +FF2
Drywall & Taping | Ceiling Grid or Hard Lid Installation & Prime | SS | 2 | grid only
Overhead MEP Rough | T-Bar Above-Ceiling MEP Inspection | FS | 0 | hard; +2 d contingency
Ceiling Grid or Hard Lid Installation & Prime | Fire Alarm Trim | SS | 2 | always
Ceiling Grid or Hard Lid Installation & Prime | Fire Suppression Trim | SS | 2 | always
T-Bar Above-Ceiling MEP Inspection | Ceiling Tile Installation | FS | 0 | hard gate
Slab Moisture / pH Testing (Resilient Flooring) | Install Flooring — All Types | FS | 0 | resilient only
Prime Coat Walls | Install Flooring — All Types | SS | 3 | by area; +FF2
Install Flooring — All Types | Install Wall Base | SS | 2 | +FF1
Prime Coat Walls | Install Millwork / Cabinetry / Casework | SS | 4 | +FF2
Prime Coat Walls | Install Doors | SS | 5 | always
Install Doors | Install Door Hardware & Accessories | SS | 1 | +FF1
Install Door Hardware & Accessories | Terminate & Integrate Access Control & Building Controls | SS | 1 | +FF1
Install Wall Base | GC PM / Super Pre-Punch | SS | 1 | by area
Final Clean | Owner Punch Walk / Substantial Completion | FS | 0 | hard gate
Install Flooring — All Types | Begin Closeout Documentation | SS | 0 | always
GC Generated Punch List Sent to Architect / Owner | Perform Punch Corrections | SS | 1 | absorbs Complete Punch Items
```

## 5. Duration model

**Envelope:** `WD_c = 2.13 × AffectedSF^0.379 × T × S × K`

- **T (tier):** light 0.6 · standard 1.0 · heavy MEP 1.25 · gut 1.4
- **S (sector):** office/ISD/TxDOT 1.0 · higher-ed 1.05 · healthcare 1.15 · detention 1.15
- **K (constraints):** K = (Π(1+kᵢ))^0.8, so stacked constraints are damped.
  - occupied 0.10
  - ICRA III–IV 0.15
  - each extra phase 0.10
  - secure escort 0.10
  - night-only 0.30

**Per task:**
- `d = clamp(round(base × (SF/5,000)^0.38 × T), 1, 10)` for labor rows.
- **Exempt:** inspections, tests, reviews, cure, mobilization.
- **Override order:** committed sub durations first, then quantity rates.

**Equipment tier:** `10 + 3.5 × units` WD. The start is pulled from delivery.

**Precon:** 15–40 WD. **Closeout:** 8–15 WD.

| Scn | Calculation | Construction WD |
|---|---|---|
| A | 44.3 × 0.6 | **27** |
| B | 69.8 | **70** |
| C | 57.6 × 1.15 × 1.30 | **86** |
| D | 10 + 14 | **24** |
| E | 49.4 × 1.15 × 1.165 | **66** |

## 6. Expected results after the fix

| Scn | Construction WD (band) | Total CD (band) | % concurrent |
|---|---|---|---|
| A | 27 (20–35) | ~80 (65–100) | ≥70% |
| B | 70 (60–85) | ~150 (140–190) | ≥80% |
| C | 86 (75–100) | ~190 (175–230) | ≥75% |
| D | 24 (20–35) | ~150 (120–200) | ≥60% |
| E | 66 (55–80) | ~150 (140–185) | ≥75% |

**All scenarios must also show:**
- No construction row over 10 WD.
- Float ≥10%.
- Critical ≤50%.
- Precon ≤40 WD.
- Closeout ≤15 WD.

R1 alone gets B only to about 90–100 WD. R2 and R3 are also required.
