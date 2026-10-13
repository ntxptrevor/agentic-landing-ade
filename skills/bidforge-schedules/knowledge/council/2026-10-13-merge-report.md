# Council merge report — 2026-10-13

Seats: 1=seat_a.psv (310 rows), 2=seat_b.psv (382 rows), 3=seat_c.psv (419 rows)

Base library: 128 consensus line items; 90 single-seat candidates.

## Modules

| Module | Seats proposing module | Consensus tasks | Single-seat candidates | Unanchored |
|---|---|---|---|---|
| low_voltage | 3/3 | 9 | 7 | 0 |
| access_control | 3/3 | 8 | 4 | 0 |
| fire_alarm | 3/3 | 9 | 6 | 0 |
| fire_suppression | 3/3 | 10 | 5 | 0 |
| selective_demo | 3/3 | 6 | 9 | 0 |
| icra | 3/3 | 7 | 9 | 0 |
| medical_specialties | 3/3 | 6 | 17 | 0 |
| opci | 3/3 | 7 | 5 | 0 |
| site_work | 3/3 | 9 | 9 | 0 |
| exterior_improvements | 3/3 | 10 | 2 | 0 |
| abatement | 3/3 | 6 | 6 | 0 |
| medical_specific | 3/3 | 6 | 16 | 0 |
| imaging | 3/3 | 11 | 6 | 0 |
| isd_college | 3/3 | 3 | 19 | 0 |
| mep_lab | 3/3 | 11 | 3 | 0 |
| complex_owner | 3/3 | 7 | 8 | 0 |
| secured_building | 3/3 | 14 | 6 | 0 |
| occupied_phasing | 3/3 | 7 | 7 | 0 |
| roofing | 3/3 | 12 | 1 | 0 |
| elevator | 3/3 | 7 | 6 | 0 |
| kitchen_foodservice | 3/3 | 12 | 2 | 0 |
| joc_csp_admin | 3/3 | 7 | 15 | 0 |
| ada_tas_upgrades | 1/3 | — (not adopted) | 6 | 0 |
| hvac_replacement | 3/3 | 9 | 6 | 0 |
| electrical_gear_upgrade | 1/3 | — (not adopted) | 6 | 0 |
| emergency_power | 2/3 | 4 | 7 | 0 |
| storm_shelter | 1/3 | — (not adopted) | 7 | 0 |

## Anchor overrides applied

- icra: "Negative Air Machines & HEPA Exhaust Setup" after Mobilization -> Interior Containment
- icra: "Hard-Wall ICRA Barriers & Anteroom Construction" after Site Work -> Interior Containment
- icra: "ICRA Barrier Inspection by Infection Prevention" after Site Work -> Interior Containment
- icra: "HEPA Terminal Clean & ICRA Barrier Removal" after Owner Punch Walk / Substantial Completion -> Final Clean
- abatement: "Abatement Containment & Negative Air Setup" after Site Work -> Salvage Owner Items (Retain/Reuse/Turnover)
- abatement: "Asbestos / Lead / Mold Removal" after Site Work -> Salvage Owner Items (Retain/Reuse/Turnover)
- abatement: "Visual Inspection & Final Air Clearance (Third-Party)" after Make Safe -> Salvage Owner Items (Retain/Reuse/Turnover)
- abatement: "Waste Manifests & Abatement Closeout Report" after Make Safe -> Begin Closeout Documentation
- fire_alarm: "Fire Alarm Permit Approved" after Ceiling Grid or Hard Lid Installation & Prime -> Confirm Job Start Approval (Gate)
- fire_suppression: "Sprinkler Main & Branch Line Relocation" after Ceiling Grid or Hard Lid Installation & Prime -> Overhead MEP Rough
- fire_suppression: "Sprinkler Hydrostatic Test (200 psi / 2 hr)" after Drywall Hang -> Overhead MEP Rough
- access_control: "Access Control Conduit & Back Box Rough-In" after Ceiling Grid or Hard Lid Installation & Prime -> Wall MEP Rough
- access_control: "Reader, REX, Door Contact & Camera Cabling" after Install Doors -> Overhead MEP Rough
- opci: "OPCI equipment and furnishings installed" after Submittal Register Approval -> Furniture, Wall Hangings & Owner Item Installation
- opci: "OPCI Delivery Schedule Confirmed with Owner" after Install Millwork / Cabinetry / Casework -> All Subcontracts Signed — Confirmed
- site_work: "Site Utilities Install (Water, Sewer, Storm)" after Wall MEP Rough -> Site Work
- site_work: "Utility Tie-In & City Inspection" after Wall MEP Rough -> Site Work
- site_work: "Concrete Paving, Curbs, Sidewalks & ADA Ramps" after Install Doors -> Pourback — Exterior
- site_work: "Landscape, Irrigation & Sod" after Install Doors -> Landscape Repairs
- exterior_improvements: "Exterior Scaffolding / Lift Setup" after Site Work -> Exterior Containment
- exterior_improvements: "Exterior Demolition (Windows, Cladding, Canopies)" after Selective & Interior Trench Demo -> Exterior Containment
- exterior_improvements: "Air/Water Barrier & Opening Flashing" after Wall MEP Rough -> Exterior Containment
- exterior_improvements: "Exterior Storefront & Window Installation (Dry-In)" after Confirm Job Start Approval (Gate) -> Exterior Containment
- exterior_improvements: "Window Field Water Test (AAMA 501.2)" after Wall MEP Rough -> Exterior Containment
- exterior_improvements: "Exterior Cladding, Masonry & EIFS Repairs" after Drywall Hang -> Exterior Containment
- exterior_improvements: "Canopy & Exterior Lighting Installation" after Ceiling Grid or Hard Lid Installation & Prime -> Exterior Containment
- exterior_improvements: "Exterior Sealants & Joint Replacement" after Install Doors -> Exterior Containment
- exterior_improvements: "Exterior Painting & Coatings" after Install Doors -> Exterior Containment
- medical_specific: "Medical gas piping rough-in by ASSE 6010 certified installer" after Confirm Job Start Approval (Gate) -> Wall MEP Rough
- secured_building: "Security Electronics (Intercom, PLC) Rough-In" after Install Doors -> Wall MEP Rough
- roofing: "Roof Tear-Off with Daily Dry-In" after Site Work -> Exterior Containment
- roofing: "Deck Repair & Fastening Inspection" after Site Work -> Exterior Containment
- roofing: "Roof Insulation, Tapered System & Cover Board" after Interior Underground Plumbing -> Exterior Containment
- roofing: "Roof Membrane Installation" after Site Work -> Exterior Containment
- roofing: "Curbs, Penetrations & RTU Flashing" after Drywall Hang -> Exterior Containment
- roofing: "Sheet Metal Copings, Edge Metal & Gutters" after Drywall Hang -> Exterior Containment
- roofing: "Roof drains, gutters and downspouts" after Install Millwork / Cabinetry / Casework -> Exterior Containment
- low_voltage: "Paging/Intercom & Clock Speaker Rough-In" after Drywall Hang -> Wall MEP Rough
- low_voltage: "Cable Tray & J-Hook Pathway Installation" after T-Bar Above-Ceiling MEP Inspection -> Overhead MEP Rough
- low_voltage: "Telecom Room Backboard, Grounding & Racks" after Ceiling Grid or Hard Lid Installation & Prime -> Prime Coat Walls
- imaging: "Submittals: Lead-Lined Drywall, Doors & Leaded Glass" after Confirm Job Start Approval (Gate) -> Cover-Up Inspections
- imaging: "Physicist Lead Shielding Inspection (Pre-Cover)" after Wood Blocking (Millwork, Windows, Wall-Mounted Items) -> Cover-Up Inspections

## Single-seat candidates (surface to council / user; not in the tree)

- **low_voltage**: Low voltage rough-in submittals and shop drawings; Cable tray and J-hook pathway installation; As-built cable records and test reports to Owner; AV Display Mounts & Projector Rough-In; Fiber Backbone Install & Splicing; WAP & Speaker Mounting in Ceiling; AV Equipment Install & Programming
- **access_control**: Head-end programming and badge database load; Access control as-builts and Owner training; CCTV Cameras & Intrusion Devices Install; Electrified Locksets, Mag Locks & Readers Install
- **fire_alarm**: Fire watch during FA outage; Fire alarm as-builts and Owner training; Fire Alarm Cabling Pull (Overhead); Fire Alarm Back Boxes & In-Wall Rough-In; Fire Alarm Device Trim (Detectors, Horn/Strobes); Duct Detector & HVAC Shutdown Interlock Test
- **fire_suppression**: Sprinkler hydrostatic test and pipe inspection; New fire service entry, backflow preventer and riser; Sprinkler Permit Approved; Sprinkler Rough-In Inspection (Fire Marshal); Sprinkler Drops Cut to Ceiling Grid
- **selective_demo**: Demolition sequence plan and engineer review; Submittal: demolition plan, shoring and haul-off; Hazardous materials survey confirmed clear before demolition; New lintels and steel at openings installed; Core drilling and saw cutting for MEP penetrations; Selective Demo Plan & Owner Salvage/Retain List; Protection of Existing-to-Remain Finishes; Selective Removal at Masonry / Load-Bearing Openings; Reinstall Salvaged Items
- **icra**: Barrier removal and IP final clearance; Interim life safety measures (ILSM) plan approved; Negative pressure verified and logged daily (manometer); Fire watch and egress maintenance under ILSM (recurring); Infection Prevention inspection before barrier removal; ICRA Risk Matrix & Construction Class Determination; ICRA Worker Training & Certification; Return Air & Duct Isolation/Sealing; Particle Count / Air Quality Test Before Occupancy
- **medical_specialties**: Blocking and backing for wall-mounted medical equipment; Headwall and service column install; Exam light, boom and track install; Sterile and seamless flooring and wall systems; Handwash sinks and sensor fixtures install; Medical equipment rough-in coordinated into MEP drawings; Headwalls and bed locators installed; Cubicle curtain tracks and privacy curtains installed; Medical equipment acceptance and biomed inspection; Submittals: Headwalls & Patient Lift Systems; Medical Gas Shutdown Coordination & Tie-In; Medical Gas Piping Rough-In (Brazed, N2 Purge); Med Gas Rough-In Pressure & Cross-Connection Test; Headwall / Wall Unit Installation; Medical Gas Outlets & Zone Valve Box Trim; Essential Electrical System Branch Testing; ASSE 6030 Medical Gas Verification & Certification
- **opci**: OPCI operational testing and owner acceptance; Damage and shortage reporting to Owner vendor; OPCI Item Matrix & Responsibility Schedule; Owner Equipment Cut Sheets & Rough-In Data Received; OPCI Item Installation
- **site_work**: Clearing, grubbing and demolition of site elements; Paving and striping; Final grade, landscaping and irrigation; Earthwork: cut, fill and subgrade preparation; Paving: base, concrete and asphalt; Site lighting, bollards and site electrical; Striping, site signage and final site cleanup; Compaction & Concrete Testing (Third Party); Pavement Striping, Signage & Wheel Stops
- **exterior_improvements**: Exterior ADA ramps, railings and doors; Canopies and metal panel systems installed
- **abatement**: Containment, negative air and decon setup; ACM removal (floor tile, mastic, pipe insulation, joint compound); Lead-based paint stabilization or removal; Clearance letter issued and demolition released; Waste manifests and disposal records submitted; Texas DSHS 10-Working-Day Asbestos Notification
- **medical_specific**: Medical gas pressure and cross-connection tests; Isolation/emergency power and essential electrical branch; Nurse call and staff station install; Pressure-controlled HVAC and HEPA filtration; HFAP/Joint Commission and DSHS/HHSC life safety walk; Hospital-grade receptacles, emergency branches and isolated power; Water management plan: flush and disinfection of new piping; Sealed, cleanable finishes and hand hygiene sinks verified; Biomed and facilities acceptance of medical systems; Pre-Construction Risk Assessment (PCRA); Interim Life Safety Measures (ILSM) Plan; Owner Equipment Planner OFCI/OFOI Matrix; Hospital Utility Shutdown Request Approvals; Contractor Badging, Escort & Hospital Orientation; Owner Medical Equipment Install & Biomed Checkout; Life Safety Drawing (LSD) Updates for TJC
- **imaging**: Physicist shielding report and vendor rough-in drawings received; Structural supports for gantry, tube and ceiling-mounted equipment; Equipment chiller, cooling and ventilation connections; Equipment Floor Reinforcement & Ceiling Unistrut; MRI RF Shield Room Installation; RF Shield Integrity / Attenuation Test
- **isd_college**: Campus access, school calendar and security badging; Summer/holiday work window schedule lock; Bond program/district standards and spec compliance review; Student-safe site logistics, delivery hours and fencing; Classroom/lab turnover and teacher move-in coordination; Campus logistics: school hours, bus loops and summer window confirmed; Submittal: intercom/PA, clock/bell and classroom AV; Submittal: lockers, visual display boards and teacher casework; Intercom, PA, clock and bell device rough-in; Classroom AV: displays, projectors and cabling; Campus turnover before first day of school (hard date); District technology department network acceptance; Board Approval & District Purchase Order; Schedule Aligned to Academic Calendar (Summer/Breaks); Contractor Badging & Campus Sign-In Procedures; Markerboards, Tackboards & Display Cases Install; Lockers & Cubbies Install; Campus Ready for Teacher Move-In / Students; AHERA Asbestos Management Plan Update
- **mep_lab**: Lab HVAC, exhaust and make-up air rough-in; Lab utility final connections and sensors; Lab Airflow Controls (Venturi Valves) Rough-In
- **complex_owner**: Owner and user group walk-throughs at milestones; Owner witnessed testing of critical systems; Finish sample boards and color mockup approved; Owner CM platform submittal routing (e-Builder/Procore/Kahua); Owner-mandated pre-installation conferences per spec section; Owner Value Engineering & Scope Reconciliation; Staging Area & Swing Space Setup; Owner Executive Pre-Turnover Walkthrough
- **secured_building**: Security fixtures (stainless, anti-ligature) rough-in; Security systems acceptance with sheriff/court admin; Detention doors, hardware and security glazing installed; Security control system programming and functional test with staff; Submittals: Detention Hollow Metal & Hardware; PLC / Touchscreen Door Control Commissioning
- **occupied_phasing**: Swing space setup and department relocation; Phase substantial completion walk and turnover (per phase); Phase-by-phase AHJ inspections and TCO; Owner relocation between phases (coordinated moves); Temporary Egress Paths & Exit Signage; Temporary MEP Feeds to Occupied Areas; Daily Cleanup at Occupied Interfaces (Recurring)
- **roofing**: Curbs, flashings and penetrations coordinated with HVAC
- **elevator**: Cab, door and fixture install; Elevator adjust, test and TDLR inspection; Hoistway dimensional inspection by elevator contractor; Elevator maintenance agreement and O&M turnover; Elevator Removed from Service & Barricaded; Elevator Cab Interior Finishes
- **kitchen_foodservice**: Submittal: foodservice equipment shop drawings and rough-in schedule; Quarry tile / epoxy flooring and cove base
- **joc_csp_admin**: JOC task order proposal and unit price book pricing; CSP/RFP proposal, interview and award; Task order change/modification and CO approval; Monthly percent-complete pay application with SOV (G702/G703); Texas Govt Code ch. 2253 bond, retainage and statutory notices; Contract closeout documentation, final affidavit and release; Owner scope walk and job order request received; Owner CM platform setup (e-Builder/Procore/Kahua) and document routing; Owner-form pay application with retainage and sales tax exemption; Cooperative vendor fee reporting (TIPS/BuyBoard/Choice Partners); JOC Joint Scope Meeting & Site Walk; Detailed Scope of Work (DSOW) Prepared; CSP Evaluation, Interview & Best-and-Final Offer; Co-op (TIPS/BuyBoard) PO Logged & Fee Setup; Change Order Pricing per UPB & Coefficient
- **ada_tas_upgrades**: TAS/ADA scoping survey and RAS registration; Accessible restroom and path-of-travel demolition; Accessible fixtures, grab bars and clearances install; Door hardware, thresholds and automatic operators; Accessible signage, tactile and Braille; TAS RAS final inspection and TDLR closeout
- **hvac_replacement**: Hydronic piping, flush and chemical treatment; BAS integration and sequence-of-operations commissioning; Submittal: RTU/AHU/split systems and controls (long lead); Ductwork, piping and electrical connections to new units; Controls integration with building automation system; Crane Day: Remove Old & Set New Units
- **electrical_gear_upgrade**: Switchgear, transformer and utility coordination submittals; Utility coordination, outage scheduling and TNMP/Oncor release; Planned power outage and gear removal; Gear set, feeders and bus connections; Arc flash study, coordination study and labeling; Utility energization and generator load test
- **emergency_power**: Submittal: generator, ATS and emergency distribution; Emergency lighting and exit sign 90-minute test; Fire marshal witness of generator and ATS test; Generator O&M, fuel and maintenance contract turnover; Generator & ATS Setting; Fuel Fill & TCEQ Tank Registration (if req); ATS Transfer Test Witnessed by AHJ
- **storm_shelter**: ICC 500 Shelter Design & Peer Review; Submittals: Storm-Rated Doors, Hardware & Louvers; Reinforced CMU/Concrete Shelter Walls & Roof; ICC 500 Special Inspections (Rebar, Grout, Concrete); Storm-Rated Door & Hardware Installation; Shelter Ventilation & Emergency Lighting; Shelter Signage & Quality Assurance Report
- **base**: Sales tax exemption and owner forms; Precon kickoff meeting; Finish and casework submittals; Material procurement and release; Owner access badging and background checks; Protection of existing finishes; Pre-demo hazmat survey verification; Demo electrical; Rough carpentry and blocking; Partition layout; Wire pull and branch circuits; Pre-drywall OAC walk; Drywall level-of-finish review; Waterproofing and tile substrate; Controls commissioning; Construction cleaning; Contractor pre-punch walk; Utility locates and existing MEP tracing; Submittal: paint colors and draw-downs; Submittal: fire sprinkler modifications; Submittal: ductwork, diffusers and insulation; Finish selections confirmed by Owner; Floor and path-of-travel protection installed; Submittal processing and log (recurring); Weekly toolbox safety meetings (recurring); Demo: remove partitions and walls in scope; Backfill, vapor barrier and slab infill pour; Telecom/data boxes and conduit stubs rough-in; Fire alarm devices relocated for new layout (existing system); Plumbing rough-in inspection; Insulation inspection; Light fixtures set in ceiling grid; Fire sprinkler heads dropped and centered; Casework and millwork installation; Flooring: carpet installation; Visual display boards and specialties installation; Fire alarm final test (existing system devices); Final clean; Mechanical final inspection; Electrical final inspection; Plumbing final inspection; Final OAC closeout meeting; Owner Request / Solicitation Received; Proposal Preparation & Submission; Certificates of Insurance Submitted; Hazardous Materials Survey Review; Submittals: Masonry Units & Grout; Long-Lead Materials Released for Fabrication; Pre-Installation Meetings (Key Trades); Temporary Power & Lighting; Safety Orientation & Site Signage; Interior Demolition - Ceilings & Finishes; Interior Demolition - Walls & Doors; MEP Demolition (Abandoned Duct, Conduit, Piping); Debris Removal & Recycling Documentation; RFIs for Concealed Conditions; Floor Slab Saw-Cutting & Trenching; Concrete Slab Patch/Infill at Trenches; Misc Metals (Equipment Supports, Embeds); Plumbing Tie-In to Existing Mains; Panelboard & Distribution Equipment Set; Electrical Service Shutdown & Tie-In; Low Voltage Sleeves & J-Box Rough (Pathways); HVAC Terminal Units & VAV Boxes Set; Duct Insulation & Leakage Test; Pre-Cover (Close-In) Inspection; Emergency/Exit Lighting Installation & Test; Finish Paint - Walls (First Finish Coat); Floor Prep & Self-Leveler; Carpet Tile Install; Resilient Base Install; Door Installation (Leafs); Lighting Controls Programming; Panel Schedules & Circuit Labeling; Window Treatments & Blinds; Equipment Install (Appliances, Owner-Furnished); Controls Programming & Point-to-Point Checkout; Electrical Testing (Megger/Torque); Water System Flush & Disinfection; Commissioning Functional Testing; Rough Clean; Punch List Back-Check; Substantial Completion Certificate (G704); Owner Training Sessions; Final TAB & Commissioning Reports Submitted; TDLR RAS Inspection; RAS Deficiency Corrections; Final Retainage Pay Application; Final Payment Released; Project Closeout File Archive

## Seat notes (verbatim)

### Seat 1
- Fire/life safety rule: above-ceiling and in-wall inspections (MEP, fire alarm, sprinkler, firestopping) must pass before drywall closes and before ceiling grid/tile close the plenum.
- Demo cannot begin until hazmat verification is complete and any abatement clearance (abatement module) is in hand; fire alarm/sprinkler impairments and utility shutdowns are scheduled before demo.
- Order of rough-in: framing, then MEP rough-in (plumbing/duct/electrical/low voltage/fire), then firestopping, insulation, inspections, then drywall; door frames set with framing so hardware/electrified prep is complete before close-in.
- Wet trades/tile and drywall finish precede paint; ceilings and overhead work (grid, lights, diffusers, sprinkler trim) precede flooring; flooring precedes base, final paint, and final trim-out.
- Slab moisture testing before flooring and adhesive; flooring must not start until the space is closed, conditioned, and paint overhead is complete.
- Long-lead procurement (switchgear, rooftop units, electrified/security hardware, detention equipment, elevators, imaging) is released immediately at submittal approval; ordering drives the baseline critical path, so submittals precede mobilization.
- Permits, TDLR/TAS registration, DSHS abatement notice (10 working days), and fire marshal plan reviews are precon gates; no demo or rough-in until permit issued and notifications period elapsed.
- Final sequence: trim-out, startup, TAB, commissioning, final inspections (electrical/mechanical/fire/health), TAS RAS, pre-punch, architect punch, CO, substantial completion, closeout docs, final pay app.
- ICRA (hospital) barriers and negative air are installed before any demo and not removed until terminal cleaning and IP clearance; medical gas ASSE 6030 verification precedes occupancy.
- Secured_building: security electronics, hardware, and detention equipment acceptance with sheriff/court admin precede turnover; tool control and escort rules apply for all work.
- Occupied_phasing repeats demo-to-closeout per area; each phase needs egress maintained, turnover walk and TCO before the next phase starts.
- joc_csp_admin inserts before NTP (rows with before:) and runs pay-app/prevailing wage/HUB reporting monthly; JOC task orders compress precon, CSP adds proposal/interview before award.
- Added module ada_tas_upgrades: TDLR Texas Accessibility Standards work with RAS registration and final inspection, common on ISD/municipal renovations.
- Added module hvac_replacement: central plant, chiller, boiler, or RTU replacement with crane, shutdown, hydronics, BAS and a long lead time.
- Added module electrical_gear_upgrade: switchgear/service upgrade with utility outage, arc flash study, and 26-week-plus gear lead times.

### Seat 2
- Above-ceiling inspection (and the MEP rough-in inspections it depends on) must pass before ceiling tile is dropped; grid may go in but tile stays off until the AHJ signs.
- No drywall closes a wall until framing, rough-in (mech/elec/plumb), top-out test, and insulation inspections are all passed; firestopping is inspected with or before drywall.
- Underslab plumbing and electrical are inspected before backfill and slab pour; slab infill precedes any framing on that footprint.
- Slab moisture/pH testing precedes any resilient flooring; finish paint precedes flooring; flooring precedes wall base, doors and trim-out so finishes are not damaged.
- Equipment submittals for HVAC gear, electrical gear, generators, elevators and detention equipment are the schedule drivers; release them in preconstruction or the construction phase stalls at rough-in.
- Fire sprinkler hydro and fire alarm 100% test precede the fire marshal final; fire marshal final precedes the building final / CO; TCO is the only path for partial turnover under occupied phasing.
- HVAC startup precedes TAB; TAB precedes medical pressure verification and fume hood ASHRAE 110 testing; all precede the mechanical final.
- Abatement clearance letter is a hard gate: no demolition in a surveyed area until the consultant releases it.
- ICRA barriers and negative pressure go up before any demo in a hospital and come down only with Infection Prevention sign-off after terminal clean.
- Texas public work over $50k requires TDLR TAS registration, RAS plan review in precon and a RAS inspection in closeout; this sits in base, not a gated module.
- Access control and fire alarm must be tested together: electrified egress hardware fails safe on alarm before Owner acceptance.
- Added module hvac_replacement: rooftop/air-handler unit swap with crane picks, curb adapters, BAS integration and manufacturer startup; very common in ISD/municipal JOC work.
- Added module emergency_power: generator, ATS and emergency/critical branch distribution plus NFPA 110 load bank and fire marshal witness test; typical for jails, hospitals, 911/EOC and municipal facilities.
- medical_specific (as distinguished from medical_specialties) covers regulatory and MEP requirements of licensed healthcare facilities (HHSC, NFPA 99 med gas certification, FGI pressure relationships, NEC 517 power); medical_specialties covers Division 11/12/27 clinical equipment and nurse call.
- Recurring PM rows (OAC, RFIs, submittals, daily reports, pay apps, change orders, certified payroll) run the full construction duration; their duration_days is a placeholder equal to the construction phase length.

### Seat 3
- No demolition or ceiling removal until abatement final air clearance passes and impairment/fire-watch notices for fire alarm and sprinkler are filed.
- Building permit, plus fire alarm and sprinkler permits where those modules apply, must be in hand before any rough-in that the permit covers.
- Underground plumbing inspection must pass before trench infill; MEP in-wall rough-in, firestopping and insulation must pass the pre-cover inspection before the second side of drywall is hung.
- Above-ceiling AHJ inspection, plus sprinkler hydrostatic, fire alarm cabling and LV pulls where they apply, must pass before ceiling tile goes in. Grid can go up first; tile cannot.
- Long-lead releases (switchgear, RTUs, hollow-metal and detention doors, generators, elevators) are on the critical path: track the date of submittal approval plus lead_days against the install date.
- Finish paint goes on before flooring, and flooring before base, toilet partitions and fixture trim. Floor moisture and pH testing must pass before resilient flooring.
- Life-safety acceptance (fire alarm 100% test, sprinkler final, egress/access release, elevator recall) must be done before the fire marshal and building finals. The final inspections come before the CO, and the CO comes before occupancy.
- TAB and controls checkout must be finished before commissioning functional testing. In hospitals, pressure relationships are verified before ICRA barriers come down.
- For ISD work, background checks must be cleared before any worker goes on campus, and the work must fit the academic calendar. For jail/court work, TCJS rules, tool control and escort rules apply every day.
- The TDLR RAS inspection is required within 1 year of substantial completion for TAS-registered projects. Track it as a closeout item that blocks final retainage when the contract says so.
- hvac_replacement: RTU, chiller, boiler or AHU replacement with crane picks, temporary conditioning and refrigerant recovery. Common for ISD summer jobs and county buildings.
- emergency_power: generator, ATS and emergency-branch work under NFPA 110 with load bank and transfer testing. Common for hospitals, jails, EOCs and shelters.
- storm_shelter: ICC 500 / FEMA 361 storm shelters and safe rooms, with special inspections. Often triggered in Texas school additions and renovations.
