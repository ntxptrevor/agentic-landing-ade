# Seat A: NTXP CPM Gantt Schedules schedule engine audit

## 1. Verdict

All five scenarios FAIL. Construction WD is 3.4x to 4.7x the benchmark. Concurrency is 0-8%, against 80-95% on the real NTXP schedules.

| Scn | Engine (constr WD / total CD / conc.) | My realistic construction WD | My realistic total CD | Result | Reasoning |
|---|---|---|---|---|---|
| A ISD light refresh, 3k SF | 147 / 353 / 5% | 25-38 | 95-130 | FAIL | A paint, ceiling and flooring job is carrying the full backbone. A summer window cannot hold 147 WD. |
| B Standard 10k SF | 237 / 490 / 0% | 60-85 | 150-200 | FAIL | 237 WD equals the plain sum of durations. Real 10k SF work is 3-6 months on site. |
| C Clinic ICRA, 6k SF | 282 / 569 / 5% | 70-95 | 185-240 | FAIL | The benchmark is 75-83 WD, and Parkland did ICRA IV in 83 WD. |
| D ISD RTU swap, 4 units | 158 / 380 / 8% | 25-40 | 150-210 | FAIL | Set curb, crane, start-up and TAB take about 30 WD. Only the lead-time-driven precon (79 WD) is plausible. |
| E Jail holding area, 4k SF | 232 / 498 / 0% | 55-80 | 165-215 | FAIL | Security adds time, but not 3.5x. |

## 2. Root causes (most impactful first)

1. **Every link is FS in one serial chain.** `linkTypes` is ["FS"] in all five runs, and `sumOfDurationsConstruction` equals `constructionWd` in B, C and E. Overlap is 0-8%, against 87-95% in the Parkland, Ralls and TAMU schedules. Real schedules use SS+1 to SS+5 ladders (`drive_benchmarks.md` §1, §2, §4).
2. **No scope tier gating.** A (light refresh) still schedules the underground, trench pourback, structural, NLB framing and wall/overhead MEP rough rows (`backbone.md`). Only module tags drop rows. Tier is a core intake gate in `ntxp_gantt_schedule_SKILL.md` §1.
3. **Durations do not scale with size.** The same 5-10d blocks apply to 3k SF and 10k SF. Parkland (about 2k SF) ran framing 6d, drywall hang 4d and paint 6d. The parametric formula puts 3k SF at about 44 WD and 10k SF at about 70 WD.
4. **Precon is serial, at 72-89 WD.** Real precon is 30-50 WD (Ralls 42 WD, `cpm_schedule_SKILL.md`: 10-50 days). Submittals, badging, MBE/HUB, TDLR and the schedule review can all run from NTP in parallel.
5. **Closeout is serial, at 36 WD, against 8-13 WD actual** (Ralls 13, TAMU 8-11). Closeout docs, pay app and RAS should run beside punch.
6. **95% critical, no float.** DISD 01 32 16 requires 10% float and at least one predecessor and one successor per activity (`drive_benchmarks.md` §6). An all-critical chain is also fragile, because every slip lands on SC.
7. **The 10 WD cap is not the problem.** Only submittal and review rows exceed it. Owners want 14-21 CD for A/E review (Parkland HW comment 1, Ralls UGC). Keep those rows and exempt them.
8. **Modules are spliced FS into the chain** (`jev-tree.md`). Abatement, ICRA and occupied-phasing rows add 40-50 WD to C when they should be gates or parallel.

## 3. Recommended changes

| id | change | value | effort | evidence | adopt? |
|---|---|---|---|---|---|
| R1 | SS+lag / FF+lag overlap model (Section 4 table) | High | M | Parkland SS+1..+5 ladders; TAMU "drywall overlaps paint"; online SS+FF guidance | yes |
| R2 | Scope tiers (below) | High | M | Gantt skill §1; real jobs; engine A | yes |
| R3 | Size scaling by parametric formula, tier, sector and constraints (Section 5) | High | S | Gantt skill §4, fitted within 6% | yes |
| R4 | Parallel precon from NTP, long-lead pull | High | S | Ralls 42 WD; CPM skill 10-50 d | yes |
| R5 | 10 WD cap for construction rows only; exempt submittal, review, procurement, cure | Med | S | DISD 01 32 16; Parkland max 8d; Rocksprings (16d) is a counter-example | yes (scoped) |
| R6 | Procurement pull from need-by date; flag release-at-risk | Med | M | Ralls lead bars up to 81 WD; Gantt skill §4 | yes, as a tracker bar, not a gate on the chain |
| R7 | Area/zone repetition (3 zones, SS+1 staggers) for occupied or phased work | Med | M | Parkland demo zones SS+1; Ralls restrooms | yes, only if phased/occupied is confirmed |
| R8 | Pre-flight sanity gate: construction WD within 0.6-1.5x of the formula, concurrency at least 50%, critical at most 65%, 10% float | High | S | engine audit; DISD float rule | yes |
| R9 | Hard-gate registry: gates stay FS and are never overlapped | High | S | `jev-tree.md` rules 1-11; Parkland gates | yes |
| R10 | Holiday/shutdown calendars and ARU/state inspections as a one-week window | Med | S | Parkland comments 4-5; Ralls Thanksgiving | yes |
| R11 | Crew diminishing returns (2 crews = 1.85x); crews never shorten tests or cures | Low | S | Gantt skill §4 | later |
| R12 | CPM skill budget multipliers | Low | S | $-based, not a fit for the SF-based model | no |

**R2 tier drops (construction rows removed or reduced):**
- **Light refresh:**
  - Drop: Interior Underground Plumbing/Electrical/HVAC, Underground MEP Inspections, Pourback — Interior Trenches, Structural Metals / Masonry / Framing, NLB Framing, Wood Blocking, Wall MEP Rough, Cover-Up Inspections, Overhead MEP Rough, MEP Equipment Installation, Fire Sealing, and the GPR and core-drilling demo rows.
  - Keep: Mobilization, Interior Containment, Make Safe, Prime Coat Walls, T-Bar Inspection (only if ceiling MEP is disturbed), Ceiling Tile, Rough Clean, flooring rows, Wall Base, doors and hardware, Final Clean, Punch.
- **Standard:** drop the underground trio, Underground MEP Inspections, Pourback — Interior Trenches, and Structural Metals / Masonry / Framing unless a module re-adds them. Keep framing through finishes.
- **Heavy MEP:** keep everything except the underground and structural rows. Add MEP Equipment Installation, startup and TAB at full duration.
- **Full gut:** keep all rows.

## 4. Lag table

```
from_task|to_task|type|lag_wd|condition
Notice to Proceed (NTP)|MBE / SBE / HUB Plans Submitted|SS|1|always
Notice to Proceed (NTP)|Badging Meeting & Processing Time|SS|1|always
Notice to Proceed (NTP)|Submittal Register Approval|SS|2|always
Notice to Proceed (NTP)|TDLR TAS Project Registration & RAS Plan Review|SS|5|parallel
Notice to Proceed (NTP)|All Subcontracts Signed — Confirmed|SS|5|always
Notice to Proceed (NTP)|Preconstruction Meeting|SS|5|always
Preconstruction Meeting|Kickoff Meeting|SS|0|always
Submittal Register Approval|Submittal Processing Time|SS|3|long-lead packages first; rest rolling
Submittal Processing Time|Confirm Job Start Approval (Gate)|FS|0|hard gate
Badging Meeting & Processing Time|Confirm Job Start Approval (Gate)|FS|0|hard gate
Mobilization|Interior Containment|SS|1|always
Interior Containment|Make Safe|FS|0|ICRA barriers before demo (hard)
Make Safe|Salvage Owner Items (Retain/Reuse/Turnover)|SS|0|always
Selective & Interior Trench Demo|Selective Demo (Core Drilling Wall & Floor Penetrations)|SS|1|by zone
GPR Scanning — Demo & Core Locations|Selective Demo (Core Drilling Wall & Floor Penetrations)|FS|0|hard gate before coring
Selective Demo (Core Drilling Wall & Floor Penetrations)|Interior Underground Plumbing|SS|2|by zone, heavy/full gut
Interior Underground Plumbing|Interior Underground Electrical|SS|1|heavy/full gut
Interior Underground Plumbing|Interior Underground HVAC|SS|1|heavy/full gut
Underground MEP Inspections|Pourback — Interior Trenches|FS|0|hard gate
Structural Metals / Masonry / Framing|NLB Framing|SS|3|start during cure, by area
NLB Framing|Install Door Frames|SS|3|always
NLB Framing|Wood Blocking (Millwork, Windows, Wall-Mounted Items)|SS|1|always
NLB Framing|Wall MEP Rough|SS|2|release by area
NLB Framing|Wall MEP Rough|FF|2|always
Wall MEP Rough|Overhead MEP Rough|SS|1|always
Wall MEP Rough|Fire Suppression Main Lines & Branch Pipe Rough|SS|1|module:fire_suppression
Wall MEP Rough|Fire Alarm & Low Voltage Prewiring|SS|3|module:fire_alarm/low_voltage
Wall MEP Rough|Cover-Up Inspections|FF|1|inspect by area
Cover-Up Inspections|Drywall & Taping|SS|3|by area; first area is hard FS
Drywall & Taping|Fire Sealing — Wall & Floor Penetrations|SS|2|always
Drywall & Taping|Ceiling Grid or Hard Lid Installation & Prime|SS|3|grid may go ahead of hard lid
Drywall & Taping|Prime Coat Walls|SS|5|tape/float started
Overhead MEP Rough|T-Bar Above-Ceiling MEP Inspection|FS|0|hard gate
T-Bar Above-Ceiling MEP Inspection|Ceiling Tile Installation|FS|0|hard gate
Prime Coat Walls|Prep Floor — Level or Grind|SS|2|by area, after Clear Floors
Slab Moisture / pH Testing (Resilient Flooring)|Install Flooring — All Types|FS|0|hard gate
Prime Coat Walls|Install Millwork / Cabinetry / Casework|SS|4|by area
Prime Coat Walls|Install Doors|SS|5|always
Install Doors|Install Door Hardware & Accessories|SS|1|always
Install Flooring — All Types|Install Wall Base|SS|3|always
Install Millwork / Cabinetry / Casework|Install Restroom Accessories & Partitions|SS|2|always
Install Millwork / Cabinetry / Casework|Install Wall Protection & Corner Guards|SS|3|always
Ceiling Tile Installation|Fire Alarm Trim|SS|0|module:fire_alarm
Ceiling Tile Installation|Fire Suppression Trim|SS|0|module:fire_suppression
Ceiling Tile Installation|Trim Out & Test Low Voltage|SS|1|module:low_voltage
Trim Out & Test Low Voltage|Terminate & Integrate Access Control & Building Controls|SS|2|always
Install Flooring — All Types|GC PM / Super Pre-Punch|SS|2|by area
Final Clean|Owner Punch Walk / Substantial Completion|FS|0|hard gate
GC Generated Punch List Sent to Architect / Owner|Begin Closeout Documentation|SS|0|always
Perform Punch Corrections|Complete Punch Items|SS|5|always
Begin Closeout Documentation|Verify Acceptance of Closeout Docs|FS|0|always
Final Walk|TDLR RAS Inspection (within 1 year of SC)|FS|0|off critical path; use a window
```

Plus a global rule: where a gate task is listed, any successor outside this table stays FS.

## 5. Duration model

`construction WD = 2.13 × SF^0.379 × tier × sector × constraints`, where SF is the affected area, rounded to whole days.
- **Tier:** light 0.65, standard 1.0, heavy MEP 1.2, full gut 1.4.
- **Sector:** ISD/college 0.95, TxDOT/county 1.0, hospital/clinic 1.2, secured/jail 1.25.
- **Constraints:** multiply the factors below, then damp as `product^0.8`, capped at 1.6.
  - Occupied 1.10
  - ICRA 1.15
  - Phased by area 1.10
  - Secure 1.10
  - Night/weekend-only 1.20
- **Distribution:** scale the row durations in each phase block so they sum along the CPM path to the target. Rows keep a minimum of 1 and a maximum of 10, except the exempt rows.
- **Quantity override:** a committed or quantity-based duration wins over the formula.
- **D (RTU swap):** use quantity rates, not SF. About 3 WD per unit for curb/set/connect, plus 6 for start-up/TAB/controls, giving about 30 WD.
- **Precon:** 28-35 WD. Add the A/E review time (14 d), and the lead time for long-lead equipment.
- **Closeout:** 10-12 WD (light), 15-20 WD (other).

| Scn | Calculation | Construction WD |
|---|---|---|
| A | 44 × 0.65 × 0.95 | about 27, rounded up to 30 for mobilization and cure |
| B | 70 × 1.0 | 70 |
| C | 57.5 × 1.0 × 1.2 × damp(1.15 × 1.10 × 1.10 = 1.39 → 1.30) | about 85 (89 if heavy tier) |
| D | quantity-based | 32 |
| E | 49 × 1.0 × 1.25 × damp(1.10) | about 65-70 |

## 6. Expected results after the fix

| Scn | Construction WD | Total CD | % concurrent | Critical % |
|---|---|---|---|---|
| A | 28-34 | 100-125 | at least 60% | at most 65% |
| B | 65-80 | 160-195 | at least 75% | at most 60% |
| C | 78-92 | 195-235 | at least 70% (gates stay FS) | at most 60% |
| D | 28-36 | 150-200 (lead-time driven) | at least 60% | at most 65% |
| E | 60-75 | 170-210 | at least 70% | at most 60% |

Pass rule for each scenario:
- Construction WD within 0.6-1.5x of the formula.
- Total CD inside the Section 1 range.
- Concurrency at or above the target, with 10% float met.
- No construction activity over 10 WD, except submittal, review, procurement and cure rows.
