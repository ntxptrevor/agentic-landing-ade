# NTXP Real-Schedule Benchmarks (Google Drive extract, 2026-10-13)

Read-only research. WD = Mon–Fri working days, weekends only (holidays NOT removed). CD = calendar days, inclusive.
"% concurrent" = share of construction-phase work activities (summaries/zero-day milestones excluded) whose date span overlaps at least one other activity. Short inspections and walks are included, which pushes the % up slightly.

Sources read: 1aN8Lrz1... (003 Progress Schedule Rev 09-21-26), 1WMiWemR... (same content, TH copy), 1uxbopWx... (Rev 09-04 + HW markups), 1afkXBIo... (email thread), 1bez4En-... (Rev 09-14), 1dHpOddu... (017-01 submittal, Rev 09-09), 1Ex1jA7n... (Ralls Rev0), 1HNvAyem... (Ralls 01 32 16 submittal + TxDOT spec text), 1lD48gH5... (Rocksprings), 1-M0_uMG... + 1qFpTGYv... (TAMU HTML). Search added: 1ZKCvEqV... (TxDOT Strafford Salt Shed MSP XML) and 1NiaEIIF... (Dallas ISD 01 32 16 spec, CSP 207926).

---

## 1. Parkland Emergency Triage, Phase 2 (Area E): Rev 09-04 → 09-09 (017-01) → 09-14 → 09-21 (003)

- **Project:** Triage Facility, Exam Rooms & Pharmacy Workroom, Pod L Improvements, 5200 Harry Hines Blvd, Dallas
- **Owner type:** Hospital (Parkland Health / Dallas County Hospital District). A/E: Hoefer Welker (HW). PM: Paul Woodard (PD&C)
- **Procurement:** IFB #1838659 (hard-bid). NTXP is GC, listed as "GC Legacy Construction" on the 09-21 stamp
- **Scope:** Interior healthcare renovation in an occupied ED. Phase 2 covers Triage 06/07/08, Exam 03/04, Phlebotomy, and a corridor extension
- **Size:** Floor SF not stated. Proxies: ~700 LF framing, ~6,200 SF drywall (4,900 L4 / 1,290 L5), ~5,900 SF paint, ~1,700 SF sheet vinyl + ~430 LF base, 1,250 SF ACT demo, 420 LF partition demo, 6 door assemblies, ~240 LF millwork. Estimated **~1,800–2,500 SF floor area**
- **Dates (Rev 09-14):**
  - Ph2 precon subphase: 8/31/26 → ready-to-mobilize 9/22/26
  - Construction: field mob 9/23/26 → ARU 100% 1/15/27 → closeout 1/27/27
  - 8/31→1/15 = **138 CD / 100 WD**
  - Construction (mob→ARU100) = **115 CD / 83 WD**
  - Mob→closeout end 1/27 = 127 CD / 91 WD
- **Rev 09-21 (003):** shifted about 3 weeks later. Mob/demo ~10/12/26, ARU 100% ~1/18/27, Final Turnover/SC **1/28/27**, owner activation 2/8–2/9/27. 8/31→1/28 = 151 CD / 109 WD; construction 10/12→1/28 = 109 CD / 79 WD
- **Header summaries:**
  - "CONSTRUCTION 271 days". HW flagged this: "271 days from 09.21.26 is 06.19.27". The rollup spans 1/3/26→1/28/27, so it is a bad summary roll-up
  - Rev 09-14 changed it to 270d
- **Activity count:** ~250 rows overall. Phase 2 is ~175 (IDs 57–233); the construction phase has ~95 including milestones and ~71 real work activities
- **Max single activity (construction detail):** 8 d (electrical rough-in, tape & float)
  - Next longest: 7 d (HVAC rough, LV devices) and 6 d (framing, med gas rough, paint)
  - Summaries run 10–35 d (Sub-phase M Punch/IP = 35 d)
  - **No construction activity > 10 WD.** Precon has 14 d items: badge check, and in Rev 09-14 every submittal review was reset to 14 d per HW
- **Overlap evidence (SS/FS± logic in the file):**
  - Demo zones staggered: Zone 2 SS+1 after Zone 1; Zone 3 SS+1 after Zone 2. Salvage SS with Zone 1; MEP demo in parallel. All demo finishes in ~7 WD
  - Blocking SS+1 after framing start. Door frames FS−2 (start 2 days before framing ends)
  - MEP rough is a ladder off fire-protection start (FP 5d, 10/30):
    - Plumbing SS+1 (5d); med gas SS+1 off plumbing (6d)
    - HVAC SS+2 (7d)
    - Electrical SS+3 (8d) → LV SS+3 off elec (6d); FA SS+4 off elec (4d); tube SS+4 off elec
    - BAS SS+4 off HVAC; CCTV raceway SS+2 off LV
    - Result: 10 rough trades in one **12 WD window** (10/30–11/16), with ~6–8 trades active at once at peak
  - Drywall: tape/float SS+2 after hang. Paint SS+4 after tape/float start. Millwork SS+4 after paint start. Lighting SS+2 after paint start. Doors/HW SS+5 after paint start. Specialties SS+3 off millwork. Flooring SS+3 off paint (also after terrazzo)
  - Ceiling grid **concurrent with drywall hang** (both start 12/3, right after ARU 80%)
  - Close-out: MEP trim SS with ceiling tile; TAB SS with lighting; FA test SS with final connections; Cx SS; City final SS+2
  - Hang→tape/float→paint→flooring overlap: hang 12/3–12/8, T&F 12/7–12/16 (~33% overlap with hang), paint 12/11–12/18 (~60% overlap with T&F)
  - **% concurrent: 62/71 = 87%**
- **Hard sequence gates (things the work cannot overlap):**
  - Written IP sign-off on ICRA containment before demo
  - Rough-in mockup accepted before rough-in is released in Zones 1 & 3 (mockup in Exam 03, built out of sequence)
  - NFPA 99 med-gas certification (24-h standing test → cross-connection → ASSE 6030 independent verifier) before above-ceiling
  - City green tags → Parkland above-ceiling walk → 2 d re-inspection contingency ("Phase 1 spot-check FAILED") → above-ceiling release
  - ARU 80% state inspection with containment up and ceiling open, before ceiling grid/drywall close-in
  - Complete-stage mockup accepted before general finishes
  - Epoxy terrazzo patch "CANNOT be pipelined"
  - Ceiling tile only AFTER light fixtures
  - TAB before casework (06 41 00 humidity)
  - Solid-surface countertops: template after cabinets set, then fabricate and return
  - Terminal clean → 12-h ICRA air-exchange hold → written IP clearance → ARU 100%
- **Typical durations (Area E, ~2k SF):**

| Activity | Duration |
|---|---|
| Mobilization | 2 d |
| Demo (all zones) | 5 d (zones 4–5 d each), MEP demo 3 d |
| Metal stud framing (700 LF) | 6 d |
| Blocking | 4 d |
| HM door frames (6) | 3 d |
| FP rough | 5 d |
| Plumbing rough | 5 d |
| Med gas rough | 6 d |
| HVAC rough | 7 d |
| Electrical rough | 8 d |
| LV rough | 6 d |
| FA rough | 4 d |
| BAS | 4 d |
| Med-gas testing | 3 × 1 d + cert |
| Firestopping | 3 d |
| City rough-in inspections | 4 d |
| Above-ceiling walk | 1 d, plus 2 d re-inspection contingency |
| Ceiling grid | 3 d |
| Drywall hang (6,200 SF) | 4 d |
| Tape & float (L4/L5) | 8 d |
| Prime & paint (5,900 SF) | 6 d |
| Terrazzo patch | 3 d |
| Sheet vinyl (1,700 SF) | 4 d |
| Millwork (240 LF) | 2 d |
| Solid-surface countertops | 2 d install |
| Lighting | 4 d |
| ACT tile | 2 d |
| Doors/hardware | 4 d |
| Specialties / cubicle track | 3 d |
| MEP trim | 2 d |
| LV devices | 7 d |
| Final connections | 3 d |
| FA acceptance test | 3 d |
| Cx | 3 d |
| City finals | 3 d |
| Punch walk | 1 d |
| Punch corrections | 4 d |
| Architect verification | 2 d |
| Closeout | 6 d (10 d? in 09-21) |
| Owner training | 40 h ops / 32 h maintenance |

- **Phasing:**
  - Phase 1A (Pod L core/nurse station, 34 d, 5/22–7/8) and 1B (annex/pharmacy, 75 d, 6/29–10/12) are as-built and overlapped each other
  - Phase 2 demo/rough/finish ran in 3 zones staggered by 1 day (rolling)
  - Rev 09-21 adds sub-phase B-II, which returns the lobby to ER staff: wall tile, terrazzo re-cove, grid repair, FP/FA in the lobby side
- **Constraints:**
  - Occupied ED
  - **ICRA Class IV** containment: full height to deck, negative air/HEPA, anteroom, daily pressure logs
  - FM limits: "ONE WEEK LIMIT FOR INTRUSION TO HALLWAY"; "30 DAY LIMIT FOR INTRUSION TO LOBBY"
  - 5-working-day written utility-interruption notice to PHHS
  - Badge checks for all subs (14 d)
  - One-week notice before mockup walkthroughs
  - Fire extinguisher accessible from the waiting room; 60 in. clear circulation
  - No night or weekend shifts are scheduled, but the CPM has weekend dates (Sat/Sun starts) and holiday-week activities
- **Reviewer/owner comments (HW markup 09-08 + Woodard/Devlin emails):**
  1. **Submittal reviews shown at 3–7 d.** The contract gives HW **14 days per submittal**. Rev 09-14 reset every review/resubmit row to 14 d, which pushed "all submittals approved" from 9/21 to 10/8
  2. **Phase 1 punch (17 open) overlaps Phase 2 start.** HW asked for the approach to Phase 1 and a firm punch-completion date, and "concern of scheduling while work remains for Phase 01"
  3. "271 days… explain" (bad roll-up)
  4. **ARU inspections shown as fixed dates.** HW wants a **requested week window**: the exact day is unknown until the week before, and the week is not guaranteed until the State confirms. Rev 09-14 added "1 Week Review Window Per Arch" and moved ARU 100% to 1/15
  5. **Holiday period:** punch walk was on the Sunday after Christmas, and punch, closeout, and readiness activities sat in the Christmas–New Year weeks. Woodard: 80% ARU in early December is possible, but **100% should not be planned before ~10 days into the new year**
  6. **Mockups early:** "do not set utility rough-in until mock-ups are reviewed", so rough-in waits for the mockup gate
  7. "Confirm enough time with PHHS process"; "Revise/update"

---

## 2. TxDOT Ralls Maintenance Facility Renovation: Baseline CPM Rev 0 (issued 09-10-26)

- **Project / owner type:** TxDOT Lubbock District, Ralls TX (Crosby Co.), Project ID 05-1859-26-02, "2-Bay Renovation" (TxDOT)
- **Procurement:** TxDOT facilities contract (PO + UGC terms), with an HSP/HUB plan. Not JOC. Fixed 180-CD contract time, LD $590/day
- **Scope:** Maintenance-facility renovation:
  - Make-safe/demo, overhead door demo, CMU infill at vehicle bays
  - Window board-up, restrooms (2 sets), metal-stud infill, lighting, plumbing, HVAC split systems
  - 400A service upgrade, ACT, resilient flooring, casework (allowances)
- **SF:** not stated
- **Dates:**
  - NTP 7/17/26; precon 7/16→9/11 (**42 WD**, as the schedule shows)
  - Construction 9/14→12/22 (schedule shows **67 WD**, with the Thanksgiving week off; 9/14→SC 12/18 = 96 CD / 70 WD weekends-only)
  - SC 12/18/26; closeout 12/23→1/8/27 (13 WD); final acceptance 1/8/27
  - Contract time 7/17/26→1/13/27 = 180 CD (124 WD)
  - NTP→final = **177 CD / 127 WD**
- **Activity count:** 95 lines (≈72 work activities; 43 construction-phase work activities)
- **Max single activity:**
  - Construction: 8 WD (overhead lighting & branch wiring)
  - Procurement lead-time bars: up to **81 WD** (panels/400A gear, 18-wk lead), HVAC 71, doors 56, lighting 51, casework 46, plumbing fixtures and flooring 36, CMU 16
  - Admin: SOV/submittal register 15 WD; submittal review 16 WD (21 CD); resubmittal 9 WD (15 CD)
  - **No construction activity > 10 WD**
- **Overlap evidence:**
  - Overhead door demo and MEP demo run concurrently (9/21)
  - Arch demo || main restroom demo (9/28)
  - Restroom rough-in || trench/saw-cut; restroom finishes || trench backfill/pour
  - CMU infill (10/14–21) overlaps restroom fixtures
  - **Framing starts during CMU cure** (10/22)
  - Lighting/branch wiring starts as framing finishes (10/30). Plumbing SS ~+1 WD, HVAC duct ~+3 WD after lighting starts: all three overlap ~70–80% over 10/30–11/11
  - Firestopping overlaps the tail of MEP
  - Prime paint || ceiling grid/ACT || flooring (all start 11/30–12/1). HVAC units, panels, doors, casework, final paint stacked 12/3–12/14
  - Plan-right restroom phase (12/1–12/15) runs fully parallel to C4 finishes
  - Testing (NETA, grounding, TAB, startup, device verification, punch walk) all inside 12/10–12/16
  - **% concurrent: 39/43 = 91%**
- **Typical durations:**

| Activity | Duration |
|---|---|
| Temp barriers | 2 d |
| MEP make-safe | 3 d |
| OH door demo | 3 d |
| MEP demo | 5 d |
| Arch demo | 5 d |
| Restroom demo | 2 d |
| Restroom rough | 3–4 d |
| Restroom board/tile/finish | 4–5 d |
| Restroom fixtures/TAS | 2–3 d |
| CMU infill | 6 d + 2 d cure |
| Metal stud framing | 6 d |
| Lighting/branch | 8 d |
| Plumbing | 6 d |
| HVAC duct | 6 d |
| Firestop | 2 d |
| **Above-ceiling inspection** | 0-d hold point, 5-WD written notice first |
| Insulation + GWB hang/tape/float | **6 d** combined |
| Prime | 3 d |
| ACT grid + tile | 3 d |
| Resilient flooring + base | 4 d |
| HVAC units set/start | 3 d |
| Panels/service | 4 d |
| Doors/frames/hardware | 3 d |
| Casework | 4 d |
| Final paint | 3 d |
| NETA test | 3 d |
| TAB | 4 d |
| Startup/Cx | 3 d |
| Punch walk | 2 d |
| Final clean | 2 d |
| SC punch | 10 WD (30 CD allowed) |
| Final punch | 2 d (7 days allowed) |

- **Phasing / constraints:**
  - Occupied facility, and the facility "keeps a restroom throughout": main restrooms first (back in service 10/15), plan-right restroom last (C5)
  - Continuous-opening security; dust partitions
  - **Non-work week at Thanksgiving**
  - Deliveries gate the installs (panels deliver 12/4, so they install 12/3–12/8)
  - 5-WD written notice for tests and above-ceiling inspection
- **Reviewer comments:** The 01 32 16 submittal (04-001, submitted 8/28/26, reviewed by Cole Furqueron 09-20-26) came back marked **"req info"** (code 4). No narrative comments are in the file

### 2a. Ralls spec section ("04 - 01 32 16 - Construction Schedule.pdf")
- Submittal cover + the Rev 0 schedule + TxDOT Support Services Division **Administrative Requirements** section. The spec text is font-shifted (+29); decoded:
  - Coordinate scheduling, submittals, and work for an orderly installation sequence
  - Submit the progress schedule **updated monthly**
  - Prepare a submittal schedule coordinated with the progress schedule
  - Submit a schedule of required tests and inspections
  - Monthly progress meetings, with minutes distributed **within 3 days**
  - Preinstallation meetings: notify Owner/A-E **14 days in advance**; "Do not proceed if the conference cannot be successfully concluded"
  - After owner occupancy, access to complete work must be coordinated with the owner's rep to minimize disruption
- The schedule itself cites UGC rules:
  - Baseline CPM + submittal register due **NTP + 21 days** (UGC 11.2 / 10.6.1.1)
  - A/E review **21 CD**, resubmittal review **15 CD**
  - SC punch **30 CD**; final punch **7 days**; LD at NTP + 180 CD

---

## 3. TxDOT Rocksprings (OAC project schedule, FY2024–25)

- **Owner type:** TxDOT
- **Scope:** Phase 1 garage conversion (demo OH doors/man doors/windows/breakroom, CMU infill and new walls, concrete infill at the vehicle lift, storage slab), then Phase 2 existing-office refresh
- **SF:** not stated
- **Procurement:** not stated (120-CD contract, KHR as superintendent/sub)
- **Dates:** official contract start 9/20/24 → turnover 1/18/25 (120 CD; "adjust for submittals?")
  - Total **121 CD / 86 WD**
  - Construction 10/14/24 → 1/17/25 = 96 CD / 70 WD
  - Phase 1 = 10/14–12/5 (39 WD)
  - Phase 2 = 12/23–1/15
  - Closeout 1/13–1/20
- **Activity count:** 51 lines (~35 work activities)
- **Max single activity:** **16 d** (every Phase 1 demo/concrete line) and **15.3 d** (every finish line). **Activities > 10 WD: YES** (almost all)
- **Overlap evidence:**
  - Block scheduling, not CPM. All 8 demo/concrete lines share identical dates (10/14–11/8), and all 13 framing/finish lines (elec rough, HVAC, doors, ceiling grid, lighting, plumbing top-out, millwork, flooring, paint) share 11/11–12/5
  - Phase 2 is also one block: 6 tasks at 2.4 d each, 12/24–12/26, which overlaps a "Christmas Holiday – NO WORK" row
  - **% concurrent: ~100%** (every activity overlaps its whole group). This is a coarse template and a poor duration benchmark
- **Phasing:** Two sequential phases with an owner move/change-over between them (12/6–12/20). Punch walk after each phase
- **Comments:** Notes column shows submittal dependencies (HVAC, door, ACT, lighting, plumbing; PLAM, countertop, VCT/stain, and paint colors TBD)

---

## 4. TAMU HSC Dallas, 2nd Floor Student Study Library (HSCD-23-0007)

- **Owner type:** University (Texas A&M Health Science Center). CM: SSC Service Solutions. Architect: BRW
- **Procurement:** Contract/PO 1125133-2, **$768,708** (cooperative/PO; JOC/CSP not stated)
- **Scope:** Interior renovation of an occupied academic floor: demo, framing, MEP rough, drywall, ACT, flooring (self-level + tile, $27K), fire-rated storefront/doors, WonDoor accordion fire door, AV/LV
- **SF:** not stated
- **Dates:**
  - **Rev 06-09:** NTP 4/10/26, construction 5/8 → target SC 7/15 (49 WD), closeout to 7/24. NTP→closeout = 106 CD / 76 WD
  - Prior baseline Rev 05-26 finished construction 7/25 (walk 7/27)
  - **07-28 update (actuals):** construction 5/12 → SC 8/8/26 (64 WD; NTP→SC 120 CD / 86 WD). Final completion 10/30/26 after the 16-wk storefront (NTP→final 204 CD / 146 WD)
- **Activity count:** Rev 06-09 has 42 rows; 07-28 has 64 activities (85 in JobTread)
- **Max single activity:**
  - Rev 06-09: framing 16 WD (5/27–6/12), demo 15 d, drywall 13 d
  - 07-28 actuals: ceiling grid 39 d (dragged at 85%), demo 17 d, framing + in-wall rough 13 d, drywall/tape/L4 13 d, FS rough 10 d, paint (2 coats) 9 d, flooring 7 d
  - **Activities > 10 WD: YES**
- **Overlap evidence:**
  - Rev 06-09: plumbing/HVAC/electrical rough all start **the same day** (5/28) as framing is underway (framing 5/27–6/12). FS rough +2 WD, LV +7 WD. Blocking concurrent with rough
  - Rev 06-09 recovery logic, verbatim: "**drywall finish overlaps paint start, ceiling grid runs concurrent with flooring prep, MEP trim collapses to a 4-day window**". This compressed finishes ~10 days
  - Storefront || finishes; millwork || MEP trim
  - Actuals: framing and in-wall rough as one combined activity overlapping demo by 6 d. Drywall started 1 d after J-hooks. Ceiling grid overlapped drywall, FS rough, paint, and flooring for 39 d. Punch ran concurrent with the above-ceiling inspection
  - **% concurrent: Rev 06-09 17/19 = 89%; 07-28 actuals 20/21 = 95%**
- **Typical durations (actuals unless noted):**

| Activity | Duration |
|---|---|
| Mobilization | 1 d |
| Selective demo (all trades) | 17 d |
| Framing + in-wall rough | 13 d |
| Rough inspections | 1–2 d each |
| J-hooks/tray | 3 d |
| Drywall to L4 | 13 d |
| FS rough | 10 d |
| Paint 2 coats | 9 d |
| Flooring | 7 d |
| Ceiling grid | planned ~5–10 d, actual 39 d |
| Trim week (FS heads 4 d, FA connect/test 6 d, electrical trim 4 d) | ~7 d |
| **Above-ceiling & fire/smoke inspection** | **4 d** (planned 3 d in 06-09) |
| ACT drop after inspection | 2 d |
| Punch | 4 d (planned 7 d) |
| Closeout docs | 8–11 d |
| Rev 06-09 planned MEP rough | 9–15 d per trade |
| Rev 06-09 planned drywall | 13 d |
| Rev 06-09 planned finishes block | 10 d |
| Rev 06-09 planned millwork | 5 d |
| Rev 06-09 planned trim | 5 d ("4-day window") |
| Rev 06-09 planned testing | 2 d |

- **Phasing / constraints:**
  - ICRA barriers + hazmat abatement up front (5/8–5/14)
  - Fire watch during the sprinkler outage
  - Above-ceiling inspection needs TAMU **written approval to close walls**
  - Temporary fire-rated wall/doors need AHJ approval, which gates the August student-use target
  - SC is "less doors & storefront" (trailing 16-wk long-lead scope)
- **Comments:** Critical path is Div 08 (Dallas Door storefront + WonDoor, 5–6 wk submittal lead). Hydronic relocation voided by BRW (cap in chase). RFI on sprinkler penetrations gates the inspection

---

## 5. TxDOT Strafford Salt Shed (MS Project XML, saved 01-09-25), added from search

- **Owner type:** TxDOT
- **Scope:** New pre-engineered metal salt shed: 7" slab ~900 SF, 12" concrete low wall, bollards, metal framing/panels/gutters, bird netting
- **Procurement:** not stated (KHR/ACT subs)
- **Dates:** contract begins 9/16/24; superintendent mob 9/26
  - Construction 9/26–11/20 = 56 CD / **40 WD**
  - Turnover 11/22/24 (68 CD / 50 WD)
  - Punch tail and drop-dead 1/15/25 (122 CD / 88 WD)
- **Activity count:** 74 rows
- **Max single activity:** framing package 15 d (11/6–11/26); metal fabrication 10 d; slab summary 29 d. **> 10 WD: YES** (framing)
- **Overlap:**
  - Roof panels (11/4–11/8) scheduled before and during framing (logic error)
  - Walls and gutters concurrent; fabrication overlaps erection; punch and demob overlap
  - Concrete sequence is strictly serial: fill → sand → vapor barrier → footing/slab → forms → rebar → pour → 5-d cure → low wall
  - **~80% concurrent (16/20)**
- **Durations:**

| Activity | Duration |
|---|---|
| Sitework/grading | 2 d |
| Select fill | 2 d |
| Sand | 1 d |
| Vapor barrier | 1 d |
| Footing/slab forms | 2 d each |
| Rebar | 2 d |
| Pour/finish | 2 d |
| Cure | 5 d |
| Low-wall forms | 1 d |
| Low-wall pour | 1 d |
| Metal fabrication | 10 d |
| Framing | 15 d |
| Roof panels | 5 d |
| Walls | 5 d |
| Gutters | 2 d |
| Punch | 2 d |
| Demob | 2 d |
| Closeout docs | 5 d |

- **Constraints/comments:** TxDOT inspector and Terracon present for the pour; compaction re-test; "TxDOT out of pocket" week. Several rows are 2024-dated typos (pre-punch 1/3/24). Not an interior renovation, so it is weak for the interior-trade audit

## 6. Dallas ISD Spec 01 32 16 Construction Progress Schedule (CSP 207926, Feb 2025), schedule rules (added from search)
- **Owner type:** ISD. **Procurement: CSP**
- **Rules:**
  - Preliminary CPM due **14 CD after NTP** (before any construction); detailed CPM due **30 CD**
  - Monthly updates with pay app; data date ≤ 5 days old; narrative required
  - **Activity durations in whole WD, max 10 WD each** unless PM approves (mobilization, procurement, and curing exempt)
  - **Every activity needs ≥1 predecessor and ≥1 successor**; **no constraints** without owner approval
  - Activity IDs and names frozen after baseline
  - **10% minimum project float** milestone
  - Multiple calendars for school-operations non-work periods, holidays, weather, and curing; rain days logged monthly
  - Responsible-party column required
  - Required milestones include periodic inspections (rough-in, overhead), abatement time, phase start/finish, dry-in, permanent power, conditioned air, life-safety testing, ADA restrooms, Cx, SC, final, and earliest owner occupancy
  - Recovery schedule within 7 CD when ≥ 7 CD behind or ≥ 10% behind
  - 3-week look-ahead including lifts and shutdowns
  - Float is shared (not exclusively the contractor's)
  - Time-impact analysis within 7 CD
  - Critical path shown in red

---

## Cross-project summary

| Project | Type | SF | Total WD (start→final/SC) | Construction WD | % concurrent | Notable rule |
|---|---|---|---|---|---|---|
| Parkland Triage Ph2 (Rev 09-14) | Hospital (IFB) | ~2k est. (6,200 SF GWB) | 100 (8/31→ARU100 1/15/27) | 83 (mob→ARU100) | 87% | 14-d A/E review per submittal; ICRA IV + IP sign-off gate; mockup gates before rough and finishes; ARU as week window; no 100% ARU in holidays |
| Parkland Triage Ph2 (Rev 09-21) | Hospital | same | 109 (→SC 1/28/27) | 79 | ~87% (same logic) | Lobby returned to ER ≤30 d; hallway intrusion ≤1 wk |
| TxDOT Ralls MNT (Rev 0) | TxDOT | n/s | 127 (NTP→final) | 67 sched. (70 wkdy) | 91% | Baseline due NTP+21; 21-CD review; Thanksgiving week off; keep one restroom in service |
| TxDOT Rocksprings | TxDOT | n/s | 86 | 70 | ~100% (block) | Activities 15–16 d each, all in parallel (template, not CPM) |
| TAMU HSC Library (Rev 06-09 plan) | University | n/s ($769k) | 76 (NTP→closeout) | 49 | 89% | Recovery = drywall/paint overlap, grid with flooring, 4-d trim |
| TAMU HSC Library (07-28 actual) | University | n/s | 86 to SC / 146 to final | 64 | 95% | Written above-ceiling approval to close; SC less long-lead storefront |
| TxDOT Strafford Salt Shed | TxDOT (new bldg) | ~900 SF slab | 50 to turnover (88 to drop-dead) | 40 | ~80% | 5-d cure; inspector at pour |
| DISD 01 32 16 spec | ISD (CSP) | n/a | n/a | n/a | n/a | Max 10 WD per activity; ≥1 pred/succ; 10% float; no constraints |

**Key takeaways for the generator audit:**
- Real interior-renovation construction phases (~1–3k SF) run **49–83 WD**
- Individual trade activities run **2–8 WD** (CPM-grade schedules), and **85–95% of activities overlap at least one other**
- Overlap is mostly SS+1 to SS+5 lags (MEP rough ladder; hang→tape SS+2; tape→paint SS+4; paint→millwork/doors/flooring SS+3 to SS+5)
- Strict FS gates around inspections, mockups, med-gas certification, above-ceiling release, and ICRA clearance
- Owners penalized: unrealistically short A/E reviews (they want 14–21 CD), fixed-date state inspections, and critical work in holiday weeks
