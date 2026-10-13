// NTXP BidForge — 3-Phase Construction Sequence
// Phase structure follows NTXP standard: Preconstruction → Construction → Closeout
// Each task has: name, duration (working days), trade, category, and optional predOffset
// predOffset: null = no auto-predecessor, undefined = sequential (i-1), negative = relative offset

export const CONSTRUCTION_PHASES = [
  // ─── PHASE 1: PRECONSTRUCTION ──────────────────────────────────────
  {
    id: 'preconstruction',
    name: 'Preconstruction',
    defaultTasks: [
      { name: 'Contract Execution', duration: 1, trade: 'PM', category: 'deliverable', predOffset: null, critical: true, sub: 'Contract & NTP' },
      { name: 'Notice to Proceed (NTP)', duration: 1, trade: 'PM', category: 'deliverable', critical: true, sub: 'Contract & NTP' },
      { name: 'NTXP Precon Agenda & Team Docs Submitted', duration: 3, trade: 'PM', category: 'deliverable', sub: 'Schedule & Compliance Submittals' },
      { name: 'Preliminary Schedule Submitted', duration: 5, trade: 'PM', category: 'deliverable', critical: true, sub: 'Schedule & Compliance Submittals' },
      { name: 'Preliminary Schedule Approved', duration: 5, trade: 'Owner', category: 'deliverable', critical: true, sub: 'Schedule & Compliance Submittals' },
      { name: 'MBE / SBE / HUB Plans Submitted', duration: 3, trade: 'PM', category: 'deliverable', sub: 'Schedule & Compliance Submittals' },
      { name: 'MBE / SBE / HUB Plans Approved', duration: 5, trade: 'Owner', category: 'deliverable', sub: 'Schedule & Compliance Submittals' },
      { name: 'Preconstruction Meeting', duration: 1, trade: 'PM', category: 'deliverable', critical: true, sub: 'Meetings & Badging' },
      { name: 'Kickoff Meeting', duration: 1, trade: 'PM', category: 'deliverable', sub: 'Meetings & Badging' },
      { name: 'Infection Control & Logistics Meeting', duration: 1, trade: 'PM', category: 'deliverable', sub: 'Meetings & Badging', module: ['icra'] },
      { name: 'Badging Meeting & Processing Time', duration: 5, trade: 'PM', category: 'deliverable', sub: 'Meetings & Badging' },
      { name: 'Submittal Register Approval', duration: 5, trade: 'Architect', category: 'deliverable', critical: true, sub: 'Submittals & Buyout' },
      { name: 'TDLR TAS Project Registration & RAS Plan Review', duration: 5, trade: 'PM', category: 'deliverable', cls: 'permit', parallel: true, lesson: 'LL-2026-10-13-03', sub: 'Submittals & Buyout' },
      { name: 'Submittal Processing Time', duration: 15, trade: 'PM', category: 'deliverable', critical: true, sub: 'Submittals & Buyout' },
      { name: 'All Subcontracts Signed — Confirmed', duration: 3, trade: 'PM', category: 'procurement', critical: true, sub: 'Submittals & Buyout' },
      { name: 'Substantial Completion Date per Contract', duration: 0, trade: 'PM', category: 'deliverable', predOffset: null, sub: 'Submittals & Buyout' },
      { name: 'Dumpster Delivered', duration: 1, trade: 'General', category: 'delivery', sub: 'Site Readiness' },
      { name: 'Temporary Barriers Erected', duration: 2, trade: 'General', category: 'activity', sub: 'Site Readiness' },
      { name: 'Site Containment & Signage Posted', duration: 1, trade: 'General', category: 'activity', sub: 'Site Readiness' },
      { name: 'Contractor Access Control / Construction Core Confirmed', duration: 2, trade: 'PM', category: 'deliverable', sub: 'Site Readiness' },
      { name: 'OAC Schedule Confirmed & Meeting Invites Sent', duration: 2, trade: 'PM', category: 'deliverable', sub: 'Team Coordination' },
      { name: 'Project Directory & Schedule Accepted by All Subs', duration: 3, trade: 'PM', category: 'deliverable', critical: true, sub: 'Team Coordination' },
      { name: 'GC Internal Preconstruction (All Subs Required)', duration: 1, trade: 'Super', category: 'deliverable', sub: 'Team Coordination' },
      { name: 'Confirm Job Start Approval (Gate)', duration: 1, trade: 'PM', category: 'deliverable', critical: true, sub: 'Mobilization Gate' },
      { name: 'Ready to Mobilize — Confirmed NTXP PM / Super', duration: 1, trade: 'PM/Super', category: 'deliverable', critical: true, sub: 'Mobilization Gate' },
    ],
  },

  // ─── PHASE 2: CONSTRUCTION ─────────────────────────────────────────
  {
    id: 'construction',
    name: 'Construction',
    defaultTasks: [
      // Mobilization & Site Prep
      { name: 'Mobilization', duration: 3, trade: 'General', category: 'activity', critical: true, sub: 'Mobilization & Site Prep' },
      { name: 'Exterior Containment', duration: 3, trade: 'General', category: 'activity', sub: 'Mobilization & Site Prep', module: ['site_work','exterior_improvements'] },
      { name: 'Site Work', duration: 5, trade: 'Earthwork', category: 'activity', sub: 'Mobilization & Site Prep', module: ['site_work'] },
      { name: 'Underground Inspections', duration: 2, trade: 'General', category: 'deliverable', sub: 'Mobilization & Site Prep', module: ['site_work'] },
      { name: 'Pourback — Exterior', duration: 3, trade: 'Concrete', category: 'activity', sub: 'Mobilization & Site Prep', module: ['site_work'] },
      { name: 'Landscape Repairs', duration: 3, trade: 'Landscape', category: 'activity', sub: 'Mobilization & Site Prep', module: ['exterior_improvements','site_work'] },
      { name: 'Sod & Commercial Planting', duration: 3, trade: 'Landscape', category: 'activity', sub: 'Mobilization & Site Prep', module: ['exterior_improvements','site_work'] },
      { name: 'Permanent Fencing', duration: 3, trade: 'Fencing', category: 'activity', sub: 'Mobilization & Site Prep', module: ['exterior_improvements'] },
      { name: 'Exterior Inspections', duration: 1, trade: 'General', category: 'deliverable', sub: 'Mobilization & Site Prep', module: ['site_work','exterior_improvements'] },

      // Interior Demo
      { name: 'Interior Containment', duration: 2, trade: 'General', category: 'activity', sub: 'Interior Demo' },
      { name: 'Make Safe', duration: 1, trade: 'General', category: 'activity', sub: 'Interior Demo' },
      { name: 'Salvage Owner Items (Retain/Reuse/Turnover)', duration: 2, trade: 'General', category: 'activity', sub: 'Interior Demo' },
      { name: 'Selective & Interior Trench Demo', duration: 5, trade: 'Demolition', category: 'activity', critical: true, sub: 'Interior Demo', module: ['selective_demo'] },
      { name: 'GPR Scanning — Demo & Core Locations', duration: 2, trade: 'GPR', category: 'activity', sub: 'Interior Demo', module: ['selective_demo'] },
      { name: 'Selective Demo (Core Drilling Wall & Floor Penetrations)', duration: 5, trade: 'Demolition', category: 'activity', critical: true, sub: 'Interior Demo', module: ['selective_demo'] },

      // Underground MEP
      { name: 'Interior Underground Plumbing', duration: 5, trade: 'Plumbing', category: 'activity', critical: true, sub: 'Underground MEP' },
      { name: 'Interior Underground Electrical', duration: 3, trade: 'Electrical', category: 'activity', sub: 'Underground MEP' },
      { name: 'Interior Underground HVAC', duration: 3, trade: 'HVAC', category: 'activity', sub: 'Underground MEP' },
      { name: 'Underground MEP Inspections', duration: 2, trade: 'General', category: 'deliverable', critical: true, sub: 'Underground MEP' },
      { name: 'Pourback — Interior Trenches', duration: 3, trade: 'Concrete', category: 'activity', critical: true, sub: 'Underground MEP' },

      // Structural & Framing
      { name: 'Structural Metals / Masonry / Framing', duration: 10, trade: 'Structural', category: 'activity', critical: true, sub: 'Structural & Framing' },
      { name: 'NLB Framing', duration: 5, trade: 'Framing', category: 'activity', critical: true, sub: 'Structural & Framing' },
      { name: 'Install Door Frames', duration: 3, trade: 'Carpentry', category: 'activity', sub: 'Structural & Framing' },
      { name: 'Wood Blocking (Millwork, Windows, Wall-Mounted Items)', duration: 3, trade: 'Carpentry', category: 'activity', sub: 'Structural & Framing' },

      // Wall Rough-In
      { name: 'Wall MEP Rough', duration: 7, trade: 'MEP', category: 'activity', critical: true, sub: 'Wall Rough-In' },
      { name: 'Cover-Up Inspections', duration: 2, trade: 'General', category: 'deliverable', critical: true, sub: 'Wall Rough-In' },
      { name: 'Overhead MEP Rough', duration: 7, trade: 'MEP', category: 'activity', sub: 'Wall Rough-In' },
      { name: 'MEP Equipment Installation (Panels / HVAC Units)', duration: 5, trade: 'MEP', category: 'delivery', sub: 'Wall Rough-In' },
      { name: 'Fire Alarm & Low Voltage Prewiring', duration: 5, trade: 'Low Voltage', category: 'activity', sub: 'Wall Rough-In', module: ['fire_alarm','low_voltage'] },
      { name: 'Fire Suppression Main Lines & Branch Pipe Rough', duration: 5, trade: 'Fire Protection', category: 'activity', sub: 'Wall Rough-In', module: ['fire_suppression'] },

      // Drywall & Ceiling
      { name: 'Drywall & Taping', duration: 10, trade: 'Drywall', category: 'activity', critical: true, sub: 'Drywall & Ceiling' },
      { name: 'Fire Sealing — Wall & Floor Penetrations', duration: 3, trade: 'Firestop', category: 'activity', sub: 'Drywall & Ceiling' },
      { name: 'Prime Coat Walls', duration: 3, trade: 'Painting', category: 'activity', critical: true, sub: 'Drywall & Ceiling' },
      { name: 'T-Bar Above-Ceiling MEP Inspection', duration: 2, trade: 'General', category: 'deliverable', sub: 'Drywall & Ceiling' },
      { name: 'Ceiling Grid or Hard Lid Installation & Prime', duration: 5, trade: 'Ceilings', category: 'activity', critical: true, sub: 'Drywall & Ceiling' },
      { name: 'Fire Alarm Trim', duration: 3, trade: 'Fire Alarm', category: 'activity', sub: 'Drywall & Ceiling', module: ['fire_alarm'] },
      { name: 'Fire Suppression Trim', duration: 3, trade: 'Fire Protection', category: 'activity', sub: 'Drywall & Ceiling', module: ['fire_suppression'] },
      { name: 'Ceiling Tile Installation', duration: 3, trade: 'Ceilings', category: 'activity', sub: 'Drywall & Ceiling' },

      // Finishes
      { name: 'Rough Clean', duration: 2, trade: 'General', category: 'activity', sub: 'Finishes' },
      { name: 'Clear Floors', duration: 1, trade: 'General', category: 'activity', sub: 'Finishes' },
      { name: 'Prep Floor — Level or Grind', duration: 3, trade: 'Flooring', category: 'activity', sub: 'Finishes' },
      { name: 'Slab Moisture / pH Testing (Resilient Flooring)', duration: 2, trade: 'Flooring', category: 'deliverable', cls: 'inspection', lesson: 'LL-2026-10-13-04', sub: 'Finishes' },
      { name: 'Install Flooring — All Types', duration: 7, trade: 'Flooring', category: 'activity', critical: true, sub: 'Finishes' },
      { name: 'Install Wall Base', duration: 2, trade: 'Flooring', category: 'activity', sub: 'Finishes' },
      { name: 'Install Millwork / Cabinetry / Casework', duration: 5, trade: 'Millwork', category: 'delivery', critical: true, sub: 'Finishes' },
      { name: 'Install Wall Protection & Corner Guards', duration: 2, trade: 'General', category: 'activity', sub: 'Finishes' },
      { name: 'Install Restroom Accessories & Partitions', duration: 3, trade: 'General', category: 'activity', sub: 'Finishes' },
      { name: 'Install Life Safety Items (FE Boxes, etc.)', duration: 2, trade: 'General', category: 'activity', sub: 'Finishes' },
      { name: 'Install Exterior / Electronic Wall Signage', duration: 2, trade: 'Signage', category: 'activity', sub: 'Finishes', module: ['exterior_improvements'] },

      // Punch & Turnover Prep
      { name: 'GC PM / Super Pre-Punch', duration: 3, trade: 'PM/Super', category: 'deliverable', critical: true, sub: 'Punch & Turnover Prep' },
      { name: 'Install ADA Room Signage', duration: 2, trade: 'Signage', category: 'activity', sub: 'Punch & Turnover Prep' },
      { name: 'Furniture, Wall Hangings & Owner Item Installation', duration: 3, trade: 'General', category: 'activity', sub: 'Punch & Turnover Prep' },
      { name: 'Install Doors', duration: 3, trade: 'Carpentry', category: 'activity', sub: 'Punch & Turnover Prep' },
      { name: 'Install Door Hardware & Accessories', duration: 2, trade: 'Hardware', category: 'delivery', sub: 'Punch & Turnover Prep' },

      // Low Voltage & Controls
      { name: 'Trim Out & Test Low Voltage', duration: 3, trade: 'Low Voltage', category: 'activity', sub: 'Low Voltage & Controls', module: ['low_voltage'] },
      { name: 'Terminate & Integrate Access Control & Building Controls', duration: 3, trade: 'Controls', category: 'activity', sub: 'Low Voltage & Controls' },
      { name: 'Start Up Control Systems & Test', duration: 3, trade: 'Controls', category: 'deliverable', sub: 'Low Voltage & Controls' },

      // Final
      { name: 'Test, Adjust & Balance (TAB)', duration: 3, trade: 'HVAC', category: 'deliverable', cls: 'inspection', tiers: ['heavy', 'gut', 'equipment'], lesson: 'LL-2026-10-13-17', sub: 'Low Voltage & Controls' },
      { name: 'Final Clean', duration: 3, trade: 'General', category: 'activity', critical: true, sub: 'Final Clean & Substantial Completion' },
      { name: 'Owner Punch Walk / Substantial Completion', duration: 3, trade: 'Owner', category: 'deliverable', critical: true, sub: 'Final Clean & Substantial Completion' },
    ],
  },

  // ─── PHASE 3: CLOSEOUT ─────────────────────────────────────────────
  {
    id: 'closeout',
    name: 'Closeout',
    defaultTasks: [
      { name: 'GC Generated Punch List Sent to Architect / Owner', duration: 2, trade: 'PM', category: 'deliverable', critical: true, sub: 'Punch List' },
      { name: 'Architect Approved Punch List Received', duration: 5, trade: 'Architect', category: 'deliverable', critical: true, sub: 'Punch List' },
      { name: 'Perform Punch Corrections', duration: 10, trade: 'General', category: 'activity', critical: true, sub: 'Punch List' },
      { name: 'Submit 100% Pay App', duration: 2, trade: 'PM', category: 'deliverable', sub: 'Pay Application & Documentation' },
      { name: 'Begin Closeout Documentation', duration: 5, trade: 'PM', category: 'deliverable', sub: 'Pay Application & Documentation' },
      { name: 'Complete Punch Items', duration: 5, trade: 'General', category: 'activity', critical: true, sub: 'Pay Application & Documentation' },
      { name: 'Verify Acceptance of Closeout Docs', duration: 3, trade: 'Owner', category: 'deliverable', sub: 'Pay Application & Documentation' },
      { name: 'Final Walk', duration: 1, trade: 'Owner', category: 'deliverable', critical: true, sub: 'Final Acceptance' },
      { name: 'TDLR RAS Inspection (within 1 year of SC)', duration: 1, trade: 'AHJ', category: 'deliverable', cls: 'inspection', parallel: true, noGate: true, lesson: 'LL-2026-10-13-03', sub: 'Final Acceptance' },
      { name: 'Submit Final Bill', duration: 2, trade: 'PM', category: 'deliverable', sub: 'Final Acceptance' },
      { name: 'Turnover (Project Complete)', duration: 1, trade: 'PM', category: 'deliverable', critical: true, sub: 'Final Acceptance' },
    ],
  },
];
