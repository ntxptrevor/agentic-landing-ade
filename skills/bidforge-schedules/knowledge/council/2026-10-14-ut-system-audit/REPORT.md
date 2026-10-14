# Council audit #2: UT System and UNT schedules (2026-10-14)

**Request (user):** "Audit the skill by integrating schedules from utd, utsw, and unt last project files in Drive. Ignore format; learn sequence and duration relative to sub-module complexity and contract value."

**Method:**
1. Three read-only research agents extracted the latest schedule revision, contract value, SF, scope modules, sequence and overlaps for each owner from Google Drive.
2. The engine was run on matching scenarios.
3. A three-seat council voted on eight proposals: A (Sonnet), B (Fable), C (Opus).
4. Changes were adopted where at least 2 of 3 seats agreed. Numeric ties were settled by the median seat.

This file is a sanitized summary. Raw extractions and seat reports are kept outside this public repository: no personnel names, bid-protest details or sub quotes.

## Benchmarks (construction = mobilization → substantial completion, WD Mon–Fri)

| ID | Kind | Value | SF | Scope (complexity 1–5) | Precon | Construction | Closeout |
|---|---|---|---|---|---|---|---|
| UNT-01 Starbucks Ph2 | executed, TIPS JOC | ~$99k | ~400 (est.) | food service, demo, FA, LV (2) | 0 (early release) | 30 (25 net of holidays) | 9 |
| UTSW-02 Memorial Garden Ash Vault | executed, JOC | ~$174k | 2,030 site | prefab vault, landscape (2) | 22 (tank lead) | 17 | 7 |
| UTSW-03 NB10.208 tissue lab | NTXP proposal | ~$172k | ~300 (est.) | lab MEP, ICRA, FA/FS/LV (3) | 6 | 31 | 3 |
| UTSW-01 C1 Mech Vault | executed, JOC | ~$518k | ~200 footprint | below-grade CIP vault, abatement, HVAC (3) | 47 | 96 baseline / 189 actual | 20 |
| UTD-1 University Village balconies | proposal, not awarded | ~$684k | ~3,860 deck | structural rebuild ×4 buildings (3) | 1 | 53 | 10 |
| UTD-2 WSTC suite | proposal duration only | ~$560k | ~3,500 (est.) | demo, HVAC, lab MEP, LV, access (3) | – | ~69 (from 120 CD) | – |

**Excluded:** two other UTSW schedules were AI-generated reference schedules and carry about zero weight. No executed UTD construction schedule exists in Drive.

**Duration relationships found:**
- **SF envelope:** 2.13·SF^0.379·tier·sector·K matches small interior jobs (23–26 WD envelope vs 25–31 WD real).
- **Contract value:** interior jobs fit construction WD ≈ 27.3·(V/$100k)^0.511, with residuals of 0.86–1.11 on UNT, NB10 and WSTC.
- **Exterior and below-grade jobs fall outside both fits.** They are driven by structure flow, cure and weather, not by floor area.

## Root causes (all confirmed by the three seats)

| # | Finding | Effect on the engine |
|---|---|---|
| R1 | On small jobs, fixed-time rows drove the overrun: AHJ inspections at 2 base + 2 contingency with a 5 WD notice; module tail gates chained one after another; post-SC rows counted inside construction. | 1.6–2.2× too long |
| R2 | Site, exterior and roofing flows dead-ended into **Make Safe**, the next hard gate (`feedDeadEnds`). The exterior work therefore ran in series ahead of the interior backbone. Site-only jobs also kept the interior backbone. | Ash Vault 83 WD vs 17 real |
| R3 | No module existed for below-grade structure (piers, CIP lifts, cure, waterproofing hold) and there was no weather allowance. | C1 Vault: 69 WD, mostly interior rows that don't exist on the job |
| R4 | Precon module reviews ran in series after the job-start gate. Submittal processing was 15 WD regardless of job size. | Precon 30–47 WD vs 0–22 WD real |
| R5 | UNT inspections use a 72 h (3 WD) notice. UTSW's 48 h and 2-week notices are owner operational notices, not AHJ inspection notices. | Profile needed; the canon default (LL-22) is unchanged |
| R6 | Closeout ran serially through billing rows after Final Walk. | Closeout 13–20 WD vs 3–20 WD real |

## Adopted changes (≥ 2 of 3 seats)

**Size bands**
- Micro = SF envelope ≤ 30 WD, or contract value ≤ $250k when SF is unknown. Large = > 90 WD or > $1M.
- Micro jobs: AHJ inspection base is 1 WD; notice and contingency follow the owner profile (default 5/2).
- Submittal processing: 8 / 15 / 20 WD by band. Punch corrections: 4 / 6 / 10 WD. Punch list: 1 WD for micro.

**Sequence changes**
- Module AHJ tests (FA 100% acceptance, hood trip test) run as their own branches into Final Clean.
- Rows after SC move to closeout.
- Phase turnover and next-phase re-mobilization appear only when there is more than one phase.

**Exterior work (R2)**
- New `exterior` tier (keep list, envelope factor 0.5).
- Site and exterior backbone rows form one flow from Mobilization and join at **Final Clean**.
- `feedDeadEnds` sends module and exterior flows that would end at Make Safe or Ready-to-Mobilize to Final Clean instead.
- SS overlaps inside the site flow.

**New modules (R3)**
- `below_grade_structural`:
  - Rows: locates, excavation, shoring SS+2, piers, mud slab, base slab, CIP walls in 1–3 lifts with 3 WD cure lags, lid, waterproofing with QC hold, sump, backfill after the hold and lid cure, misc metals, final grade.
  - Scales with structure footprint, not site area.
  - Precast variant: leveling pad, then crane set at FS+3.
- `structural_exterior_rebuild`: one ~25 WD cycle per building.
- **Weather row:** a visible weather-contingency row, sized as exposed WD × the average monthly rate over the exposed span (0.10 Oct–Jun, 0.05 Jul–Sep), capped at 20 and user-overridable.

**Precon (R4)**
- Design-document reviews (Health Dept plan review, structural review, finish selections) start at NTP and feed the job-start gate.
- Sub shop drawings, permits and `Submittals:` rows start when subcontracts are signed and chain within their trade.

**Contract-value envelope**
- Warn-only sanity check for interior tiers, 0.6–1.6×, shown next to the SF envelope with their geometric mean. It flags when the SF and value envelopes disagree by more than 1.6×.
- The value is escalated 4%/yr, and owner-furnished equipment over 25% of value is subtracted.

**Owner notice profiles**
- Default 5/2, which is canon.
- A UNT 72 h preset and a per-project contingency override are available but never auto-applied. Choosing either is logged as a user decision.

**Closeout**
- Measured SC → Final Walk. Pay app and final-bill rows run beside the chain.

**Sequence rules from the jobs**
- Food service:
  - "GPR scan & core" before under-slab plumbing.
  - An "All MEP Below Slab Complete" milestone releases millwork.
  - MEP through millwork runs SS+1.
- Owner-stored FF&E transport row (scope option).
- Renderings never hold site work; micro jobs drop the renderings and mockup-room rows.

**Data fix**
- `exterior_improvements` had picked up building-envelope rows (storefront, cladding, sealants) in the round-1 merge. They now belong to `roofing` (Roofing / Envelope). The module description is landscaping, fencing and signage.

## Engine results (after)

| Scenario | Band | Real | Before | After | Pass |
|---|---|---|---|---|---|
| UNT-01 | 22–34 | 30 | 47 | **38** (34 with the UNT preset + 1 WD contingency) | no — awaits user decisions |
| UTSW-02 Ash Vault | 14–26 | 17 | 83 | **36** | no — fixed backbone tail (see below) |
| UTSW-03 NB10 | 26–40 | 31 | 68 | **37** | yes |
| UTSW-01 C1 Vault | 80–130 | 96 baseline | 69 | **77** | no — 3 WD short |
| UTD-1 Balconies | 45–65 | 53 | 102 | **33** for one building | user decision (stagger vs LL-21) |
| UTD-2 WSTC | 50–75 | ~69 | 80 | **56** | yes |

**Reference scenarios after:**
- B 65, C 98 and E 61 pass.
- A (light, 3,000 SF) is 33 WD, inside its band, but 58% of its activities are critical against a 50% maximum. With 8 WD of micro submittal processing, the serial precon set-up chain (dumpster → barriers → signage → access → OAC → directory → GC internal) becomes the critical path.
- D (RTU) has 91 CD total against a 95 CD floor, because precon is shorter now that submittals start at subcontract signing.

**Before → after on the Drive benchmarks:** the mean miss against real, max(engine/real, real/engine), fell from 2.2× to 1.45×.

## Open items and user decisions (not applied)

1. **Re-inspection contingency of 1 WD on micro jobs.** Seat B proposed it; seats A and C offered it only as a user decision. Canon LL-22 is 2 WD.
2. **UNT 72 h notice preset as the default for UNT jobs.** Today it is opt-in.
3. **Balcony/building stagger (leapfrog, SS+5) vs LL-21** (each zone finishes before the next starts). The proposal ran 53 WD; LL-21 gives about 105–120 WD.
4. **Site-only fixed tail.** Mobilization 3, Final Clean 3 and the SC walk 3, plus the AHJ exterior inspection (5 + 1 + 2), add about 14 WD of fixed time to a 17-WD job. Seat C proposed a 1 WD SC walk for all tiers; it got only one seat, so it was not adopted.
5. **Scenario A critical share and scenario D calendar floor** after the precon change (above).
6. **Healthcare mockup gates (LL-23) on research labs** at academic medical centers: NB10 had none.
