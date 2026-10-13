# Seat B — BidForge schedule engine audit

## 1. Verdict

All five scenarios **FAIL**. Construction WD equals the plain sum of task durations (`engine_audit_before.json`: `sumOfDurationsConstruction` ≈ `constructionWd`, FS-only links, 0–8% concurrent), so every run lands 3.4–4.7× over benchmark. Ranges assume 5-day weeks, holidays removed.

| Sc. | Engine constr WD / total CD | Realistic constr WD | Realistic total CD | Reasoning |
|---|---|---|---|---|
| A — ISD light refresh 3,000 SF, summer | 147 / 353 | 18–30 | 80–105 | Paint/ceiling/flooring has no underground, framing, drywall or rough-in, yet 147 is exactly the sum of every untagged backbone row. A summer window is ~10 weeks total. |
| B — standard 10,000 SF office/classroom | 237 / 490 | 60–90 | 150–210 | 10k SF interior work is 3–6 months on site; Ralls/Rocksprings ran 67–70 WD. 237 WD serial is a 16-month job. |
| C — occupied clinic, ICRA, 6,000 SF | 282 / 569 | 70–100 | 170–235 | Parkland Ph2 (~2k SF, ICRA IV, med gas, ARU) ran 79–83 WD; a 16-week clinic reference is 80 WD. |
| D — ISD summer RTU replacement, 4 units | 158 / 380 | 12–25 | 90–150 (lead-driven) | Four swaps are crane days plus electrical/controls/TAB; the real driver is 12–20-week unit lead, not 158 WD on site. |
| E — county jail holding area 4,000 SF | 232 / 498 | 55–80 | 150–205 | Escort/tool control adds ~20%, but 4k SF is one quarter of construction; 232 is 3.5× the 67 WD benchmark. |

Precon (72–89 WD) and closeout (36–37 WD) also fail: real precon is 20–42 WD (Ralls 42 with 21-CD reviews, TAMU 20, Parkland Ph2 16, DISD rule 10–50); real closeout is 10–20 WD (Ralls 13, TAMU 8–11, Parkland 6–10).

## 2. Root causes (ranked)

1. **Pure FS chain, zero overlap.** `jev-tree.md`: "sequential FS by default in backbone order"; `engine_audit_before.json`: one link type, 0–8% concurrent. Real NTXP schedules run 85–95% concurrent on SS+1…SS+5 ladders (`drive_benchmarks.md`). This alone is ~3× of the error.
2. **No scope-tier gating.** Only module-tagged rows can be dropped (`jev-tree.md`); underground MEP, pourback, structural, framing, rough-in, drywall, millwork and doors always run. Scenario A = untagged backbone sum (`backbone.md`).
3. **Serial preconstruction.** Only TDLR is `parallel` (`backbone.md`); schedule, HUB plans, badging, submittals and subcontracts are chained. Benchmarks run them concurrently (Ralls, TAMU; `cpm_schedule_SKILL.md` precon 10–50 d).
4. **Serial, doubled closeout.** "Perform Punch Corrections 10d" plus "Complete Punch Items 5d" plus chained docs = 36 WD; benchmarks show punch 4–10 WD with docs in parallel (`drive_benchmarks.md`).
5. **No size or sector scaling.** 3k and 10k SF differ only by module count; both prior skills scale (`ntxp_gantt_schedule_SKILL.md` §4; `cpm_schedule_SKILL.md` multipliers).
6. **89–95% critical.** No parallel paths means no float; DISD 01 32 16 requires 10% project float (`drive_benchmarks.md` §6).
7. **Procurement is one 15 d lump**, not per-package lead bars pulled from need-by (Ralls lead bars to 81 WD; TAMU storefront 16 wk; `ntxp_gantt_schedule_SKILL.md` §4). It also breaks the 10 WD cap.
8. **No non-work calendars.** Owners rejected holiday-week punch and 100% ARU before mid-January (`drive_benchmarks.md` Parkland comments).
9. **Missing rows:** Finish Paint, Light Fixtures/MEP Trim, TAB, inspection-notice lead; "Drywall & Taping 10d" should be Hang + Tape/Float (Parkland 4 + 8).

## 3. Recommended changes

| id | change | value | effort | evidence | adopt? |
|---|---|---|---|---|---|
| R1 | SS/FF+lag pairs between trade pairs (§4); FS only at hard gates | High | M | Parkland/Ralls/TAMU logic; online SS+1–2/FF pairs | yes |
| R2 | Scope tiers gate backbone rows. **Light refresh** drops UG MEP, pourback, structural, NLB framing, door frames, blocking, wall/overhead rough, cover-up, MEP equipment, drywall, fire sealing, millwork, doors/hardware, controls. **Standard** drops UG MEP, pourback, structural, MEP equipment. **Heavy MEP** drops structural. **Full gut** keeps all | High | S | backbone.md; A = full-backbone sum | yes |
| R3 | Per-task scaling `(AffectedSF/4000)^0.379`, clamped 0.5–2.5, on area-driven rows; sector/constraint multipliers (§5); parametric formula as cross-check | High | M | gantt skill §4; cpm skill scaling | yes |
| R4 | Parallel precon: schedule, HUB plans, badging, TDLR, submittals, subcontracts SS off NTP/Precon Meeting, feeding "Confirm Job Start Approval" | High | S | Ralls 42 WD precon; DISD 14/30 CD | yes |
| R5 | Cap 10 WD; auto-split (Submittal Processing per package; Drywall → Hang + Tape/Float) | Med | S | DISD 01 32 16; benchmarks max 8 WD | yes |
| R6 | Procurement pull: per-package review (10 WD) + lead bar set backward from install need-by; flag release-at-risk | High | M | Ralls lead bars; TAMU storefront | yes |
| R7 | Location-based repetition: split demo/rough/drywall/finishes into N areas, SS+1–2 between areas, when `occupied_phasing` or ICRA | Med | L | Parkland 3 zones SS+1; Ralls restrooms | yes, phase 2 |
| R8 | Pre-flight gate: float ≥10%, critical ≤40%, construction WD within 0.7–1.4× parametric, no activity >10 WD; block export on fail | High | S | DISD float rule; this audit | yes |
| R9 | Non-work calendars: owner window, Thanksgiving week, Dec 22–Jan 2, STAAR; no inspections/punch in those weeks | Med | S | Parkland comments; DISD calendars | yes |
| R10 | Add rows: Finish Paint 3d, Light Fixtures & MEP Trim 4d, TAB 3d, FS+5 notice lead to AHJ inspections; A/E review 14–21 CD per package | Med | S | benchmark tables; HW markup; jev rules 7, 10 | yes |
| R11 | Merge "Complete Punch Items" into "Perform Punch Corrections" (5–8d); closeout docs SS with punch | Med | S | Ralls/TAMU closeout | yes |
| R12 | Unit-rate durations for equipment scopes (RTU: 1.5 WD/unit + 2 crane days + 3d controls/TAB) | Med | M | scenario D | yes |

## 4. Lag table

```
from_task | to_task | type | lag_wd | condition
Notice to Proceed (NTP) | Preliminary Schedule Submitted | SS | 1 | always
Notice to Proceed (NTP) | MBE / SBE / HUB Plans Submitted | SS | 1 | always
Notice to Proceed (NTP) | Badging Meeting & Processing Time | SS | 3 | isd/medical/secured
Notice to Proceed (NTP) | TDLR TAS Project Registration & RAS Plan Review | SS | 3 | always
Submittal Register Approval | Submittal Processing Time | SS | 0 | per package, 10 WD each
Submittal Register Approval | All Subcontracts Signed — Confirmed | SS | 0 | always
Mobilization | Interior Containment | SS | 1 | always
Interior Containment | Make Safe | FS | 0 | hard gate, ICRA verified
Make Safe | Selective & Interior Trench Demo | SS | 1 | salvage runs SS 0 with demo
GPR Scanning — Demo & Core Locations | Selective Demo (Core Drilling Wall & Floor Penetrations) | FS | 0 | hard gate
Selective & Interior Trench Demo | Interior Underground Plumbing | SS | 3 | released trench areas
Interior Underground Plumbing | Interior Underground Electrical | SS | 2 | always
Interior Underground Plumbing | Interior Underground HVAC | SS | 2 | always
Interior Underground HVAC | Underground MEP Inspections | FS | 0 | hard gate, 5-WD notice
Underground MEP Inspections | Pourback — Interior Trenches | FS | 0 | hard gate
Selective & Interior Trench Demo | Structural Metals / Masonry / Framing | SS | 3 | heavy/full gut
Structural Metals / Masonry / Framing | NLB Framing | SS | 3 | framing during CMU cure
Pourback — Interior Trenches | NLB Framing | FF | 2 | trench areas framed last
NLB Framing | Install Door Frames | SS | 2 | always
NLB Framing | Wood Blocking (Millwork, Windows, Wall-Mounted Items) | SS | 1 | always
NLB Framing | Wall MEP Rough | SS | 2 | plus FF+3
NLB Framing | Overhead MEP Rough | SS | 1 | ceilings open from demo
Overhead MEP Rough | Fire Suppression Main Lines & Branch Pipe Rough | SS | 0 | FP leads ladder
Overhead MEP Rough | Fire Alarm & Low Voltage Prewiring | SS | 3 | fire_alarm/low_voltage
Overhead MEP Rough | MEP Equipment Installation (Panels / HVAC Units) | SS | 3 | delivered
Wall MEP Rough | Fire Sealing — Wall & Floor Penetrations | SS | 4 | always
Wall MEP Rough | Cover-Up Inspections | FS | 0 | hard gate; blocking, frames, firestop FF 0
Cover-Up Inspections | Drywall & Taping | SS | 2 | inspected areas only
Drywall & Taping | Prime Coat Walls | SS | 6 | plus FF+2
Drywall & Taping | Ceiling Grid or Hard Lid Installation & Prime | SS | 3 | grid before inspection allowed
MEP Equipment Installation (Panels / HVAC Units) | T-Bar Above-Ceiling MEP Inspection | FS | 0 | hard gate, powered and lit
T-Bar Above-Ceiling MEP Inspection | Ceiling Tile Installation | FS | 0 | hard gate, after fixtures
Ceiling Grid or Hard Lid Installation & Prime | Fire Alarm Trim | SS | 1 | same for Fire Suppression Trim
Prime Coat Walls | Finish Paint (new) | SS | 3 | always
Finish Paint (new) | Prep Floor — Level or Grind | SS | 2 | always
Slab Moisture / pH Testing (Resilient Flooring) | Install Flooring — All Types | FS | 0 | hard gate, resilient
Finish Paint (new) | Install Flooring — All Types | SS | 4 | painted areas only
Install Flooring — All Types | Install Wall Base | SS | 2 | always
Finish Paint (new) | Install Millwork / Cabinetry / Casework | SS | 4 | always
Finish Paint (new) | Install Doors | SS | 5 | always
Install Doors | Install Door Hardware & Accessories | SS | 1 | always
Install Door Hardware & Accessories | Terminate & Integrate Access Control & Building Controls | SS | 1 | access_control
Ceiling Tile Installation | Trim Out & Test Low Voltage | SS | 0 | low_voltage
Start Up Control Systems & Test | TAB (new) | FS | 0 | hard gate
Install Wall Base | GC PM / Super Pre-Punch | SS | 0 | by area; doors, millwork FF 0
GC PM / Super Pre-Punch | Final Clean | SS | 2 | always
Final Clean | Owner Punch Walk / Substantial Completion | FS | 0 | NTXP canon
GC Generated Punch List Sent to Architect / Owner | Perform Punch Corrections | SS | 1 | always
GC Generated Punch List Sent to Architect / Owner | Begin Closeout Documentation | SS | 0 | always
Architect Approved Punch List Received | Perform Punch Corrections | FF | 5 | always
Perform Punch Corrections | Final Walk | FS | 0 | hard gate
```

## 5. Duration model

**Base:** backbone durations stand; they match Parkland and Ralls per-trade values within ±2 d, i.e. calibrated near 4,000 SF affected.

**Per-task scaling** on area-driven rows (demo, framing, rough, drywall, paint, ceilings, flooring, base, millwork, clean, punch):
`WD = clamp(ceil(base × (AffectedSF/4000)^0.379 × sector × constraint), 1, 10)`; rows over 10 WD split by area. Inspections, tests, cures, reviews and meetings never scale.

- **Scope tier** gates rows (R2) and sets the parametric check: light 0.5, standard 1.0, heavy MEP 1.25, full gut 1.5.
- **Sector:** ISD/college 1.0, municipal/TxDOT 1.0, higher-ed occupied 1.05, healthcare ICRA 1.15, jail/secured 1.2.
- **Constraints** (damped): occupied 1.10, phased 1.10, night/weekend only 1.30, ICRA III–IV 1.10, no laydown 1.05; combined = 1 + Σ(m−1)×0.8, capped 1.5.
- **Equipment scopes** use unit rates (R12).
- **Cross-check:** `WD = 2.13 × AffectedSF^0.379 × sector × tier × constraints`; pass when engine construction WD is within 0.7–1.4×.

Parametric results: A 44×0.5 = **22**; B **70**; C 57.5×1.25×1.15×1.1 ≈ **91** (accept 80–90); D unit-rate **18**; E 49×1.1×1.2 ≈ **65**.

## 6. Expected results after the fix

| Sc. | Precon WD | Construction WD | Closeout WD | Total CD | % concurrent | Critical % |
|---|---|---|---|---|---|---|
| A | 20–25 | 22–28 | 10 | 80–95 | ≥55% | ≤45% |
| B | 30–35 | 65–80 | 15 | 160–185 | ≥75% | ≤40% |
| C | 40–45 (HHSC review parallel) | 80–90 | 15 | 190–215 | ≥75% | ≤40% |
| D | 25–30, RTU lead to ~NTP+80 WD | 15–22 | 10 | 95–150 (lead-driven) | ≥50% | ≤50% |
| E | 35–40 (detention hardware lead) | 60–70 | 15 | 155–180 | ≥70% | ≤40% |

Pass gate: construction WD within 0.7–1.4× the §5 parametric value, no activity over 10 WD, project float ≥10%, concurrency ≥50%, and no punch or inspection inside a declared non-work week.
