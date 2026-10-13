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
      { name: 'Contract Execution', duration: 1, trade: 'PM', category: 'deliverable', predOffset: null, critical: true },
      { name: 'Notice to Proceed (NTP)', duration: 1, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'NTXP Precon Agenda & Team Docs Submitted', duration: 3, trade: 'PM', category: 'deliverable' },
      { name: 'Preliminary Schedule Submitted', duration: 5, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'Preliminary Schedule Approved', duration: 5, trade: 'Owner', category: 'deliverable', critical: true },
      { name: 'MBE / SBE / HUB Plans Submitted', duration: 3, trade: 'PM', category: 'deliverable' },
      { name: 'MBE / SBE / HUB Plans Approved', duration: 5, trade: 'Owner', category: 'deliverable' },
      { name: 'Preconstruction Meeting', duration: 1, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'Kickoff Meeting', duration: 1, trade: 'PM', category: 'deliverable' },
      { name: 'Infection Control & Logistics Meeting', duration: 1, trade: 'PM', category: 'deliverable' },
      { name: 'Badging Meeting & Processing Time', duration: 5, trade: 'PM', category: 'deliverable' },
      { name: 'Submittal Register Approval', duration: 5, trade: 'Architect', category: 'deliverable', critical: true },
      { name: 'Submittal Processing Time', duration: 15, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'All Subcontracts Signed — Confirmed', duration: 3, trade: 'PM', category: 'procurement', critical: true },
      { name: 'Substantial Completion Date per Contract', duration: 0, trade: 'PM', category: 'deliverable', predOffset: null },
      { name: 'Dumpster Delivered', duration: 1, trade: 'General', category: 'delivery' },
      { name: 'Temporary Barriers Erected', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Site Containment & Signage Posted', duration: 1, trade: 'General', category: 'activity' },
      { name: 'Contractor Access Control / Construction Core Confirmed', duration: 2, trade: 'PM', category: 'deliverable' },
      { name: 'OAC Schedule Confirmed & Meeting Invites Sent', duration: 2, trade: 'PM', category: 'deliverable' },
      { name: 'Project Directory & Schedule Accepted by All Subs', duration: 3, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'GC Internal Preconstruction (All Subs Required)', duration: 1, trade: 'Super', category: 'deliverable' },
      { name: 'Confirm Job Start Approval (Gate)', duration: 1, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'Ready to Mobilize — Confirmed NTXP PM / Super', duration: 1, trade: 'PM/Super', category: 'deliverable', critical: true },
    ],
  },

  // ─── PHASE 2: CONSTRUCTION ─────────────────────────────────────────
  {
    id: 'construction',
    name: 'Construction',
    defaultTasks: [
      // Mobilization & Site Prep
      { name: 'Mobilization', duration: 3, trade: 'General', category: 'activity', critical: true },
      { name: 'Exterior Containment', duration: 3, trade: 'General', category: 'activity' },
      { name: 'Site Work', duration: 5, trade: 'Earthwork', category: 'activity' },
      { name: 'Underground Inspections', duration: 2, trade: 'General', category: 'deliverable' },
      { name: 'Pourback — Exterior', duration: 3, trade: 'Concrete', category: 'activity' },
      { name: 'Landscape Repairs', duration: 3, trade: 'Landscape', category: 'activity' },
      { name: 'Sod & Commercial Planting', duration: 3, trade: 'Landscape', category: 'activity' },
      { name: 'Permanent Fencing', duration: 3, trade: 'Fencing', category: 'activity' },
      { name: 'Exterior Inspections', duration: 1, trade: 'General', category: 'deliverable' },

      // Interior Demo
      { name: 'Interior Containment', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Make Safe', duration: 1, trade: 'General', category: 'activity' },
      { name: 'Salvage Owner Items (Retain/Reuse/Turnover)', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Selective & Interior Trench Demo', duration: 5, trade: 'Demolition', category: 'activity', critical: true },
      { name: 'GPR Scanning — Demo & Core Locations', duration: 2, trade: 'GPR', category: 'activity' },
      { name: 'Selective Demo (Core Drilling Wall & Floor Penetrations)', duration: 5, trade: 'Demolition', category: 'activity', critical: true },

      // Underground MEP
      { name: 'Interior Underground Plumbing', duration: 5, trade: 'Plumbing', category: 'activity', critical: true },
      { name: 'Interior Underground Electrical', duration: 3, trade: 'Electrical', category: 'activity' },
      { name: 'Interior Underground HVAC', duration: 3, trade: 'HVAC', category: 'activity' },
      { name: 'Underground MEP Inspections', duration: 2, trade: 'General', category: 'deliverable', critical: true },
      { name: 'Pourback — Interior Trenches', duration: 3, trade: 'Concrete', category: 'activity', critical: true },

      // Structural & Framing
      { name: 'Structural Metals / Masonry / Framing', duration: 10, trade: 'Structural', category: 'activity', critical: true },
      { name: 'NLB Framing', duration: 5, trade: 'Framing', category: 'activity', critical: true },
      { name: 'Install Door Frames', duration: 3, trade: 'Carpentry', category: 'activity' },
      { name: 'Wood Blocking (Millwork, Windows, Wall-Mounted Items)', duration: 3, trade: 'Carpentry', category: 'activity' },

      // Wall Rough-In
      { name: 'Wall MEP Rough', duration: 7, trade: 'MEP', category: 'activity', critical: true },
      { name: 'Cover-Up Inspections', duration: 2, trade: 'General', category: 'deliverable', critical: true },
      { name: 'Overhead MEP Rough', duration: 7, trade: 'MEP', category: 'activity' },
      { name: 'MEP Equipment Installation (Panels / HVAC Units)', duration: 5, trade: 'MEP', category: 'delivery' },
      { name: 'Fire Alarm & Low Voltage Prewiring', duration: 5, trade: 'Low Voltage', category: 'activity' },
      { name: 'Fire Suppression Main Lines & Branch Pipe Rough', duration: 5, trade: 'Fire Protection', category: 'activity' },

      // Drywall & Ceiling
      { name: 'Drywall & Taping', duration: 10, trade: 'Drywall', category: 'activity', critical: true },
      { name: 'Fire Sealing — Wall & Floor Penetrations', duration: 3, trade: 'Firestop', category: 'activity' },
      { name: 'Prime Coat Walls', duration: 3, trade: 'Painting', category: 'activity', critical: true },
      { name: 'T-Bar Above-Ceiling MEP Inspection', duration: 2, trade: 'General', category: 'deliverable' },
      { name: 'Ceiling Grid or Hard Lid Installation & Prime', duration: 5, trade: 'Ceilings', category: 'activity', critical: true },
      { name: 'Fire Alarm Trim', duration: 3, trade: 'Fire Alarm', category: 'activity' },
      { name: 'Fire Suppression Trim', duration: 3, trade: 'Fire Protection', category: 'activity' },
      { name: 'Ceiling Tile Installation', duration: 3, trade: 'Ceilings', category: 'activity' },

      // Finishes
      { name: 'Rough Clean', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Clear Floors', duration: 1, trade: 'General', category: 'activity' },
      { name: 'Prep Floor — Level or Grind', duration: 3, trade: 'Flooring', category: 'activity' },
      { name: 'Install Flooring — All Types', duration: 7, trade: 'Flooring', category: 'activity', critical: true },
      { name: 'Install Wall Base', duration: 2, trade: 'Flooring', category: 'activity' },
      { name: 'Install Millwork / Cabinetry / Casework', duration: 5, trade: 'Millwork', category: 'delivery', critical: true },
      { name: 'Install Wall Protection & Corner Guards', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Install Restroom Accessories & Partitions', duration: 3, trade: 'General', category: 'activity' },
      { name: 'Install Life Safety Items (FE Boxes, etc.)', duration: 2, trade: 'General', category: 'activity' },
      { name: 'Install Exterior / Electronic Wall Signage', duration: 2, trade: 'Signage', category: 'activity' },

      // Punch & Turnover Prep
      { name: 'GC PM / Super Pre-Punch', duration: 3, trade: 'PM/Super', category: 'deliverable', critical: true },
      { name: 'Install ADA Room Signage', duration: 2, trade: 'Signage', category: 'activity' },
      { name: 'Furniture, Wall Hangings & Owner Item Installation', duration: 3, trade: 'General', category: 'activity' },
      { name: 'Install Doors', duration: 3, trade: 'Carpentry', category: 'activity' },
      { name: 'Install Door Hardware & Accessories', duration: 2, trade: 'Hardware', category: 'delivery' },

      // Low Voltage & Controls
      { name: 'Trim Out & Test Low Voltage', duration: 3, trade: 'Low Voltage', category: 'activity' },
      { name: 'Terminate & Integrate Access Control & Building Controls', duration: 3, trade: 'Controls', category: 'activity' },
      { name: 'Start Up Control Systems & Test', duration: 3, trade: 'Controls', category: 'deliverable' },

      // Final
      { name: 'Final Clean', duration: 3, trade: 'General', category: 'activity', critical: true },
      { name: 'Owner Punch Walk / Substantial Completion', duration: 3, trade: 'Owner', category: 'deliverable', critical: true },
    ],
  },

  // ─── PHASE 3: CLOSEOUT ─────────────────────────────────────────────
  {
    id: 'closeout',
    name: 'Closeout',
    defaultTasks: [
      { name: 'GC Generated Punch List Sent to Architect / Owner', duration: 2, trade: 'PM', category: 'deliverable', critical: true },
      { name: 'Architect Approved Punch List Received', duration: 5, trade: 'Architect', category: 'deliverable', critical: true },
      { name: 'Perform Punch Corrections', duration: 10, trade: 'General', category: 'activity', critical: true },
      { name: 'Submit 100% Pay App', duration: 2, trade: 'PM', category: 'deliverable' },
      { name: 'Begin Closeout Documentation', duration: 5, trade: 'PM', category: 'deliverable' },
      { name: 'Complete Punch Items', duration: 5, trade: 'General', category: 'activity', critical: true },
      { name: 'Verify Acceptance of Closeout Docs', duration: 3, trade: 'Owner', category: 'deliverable' },
      { name: 'Final Walk', duration: 1, trade: 'Owner', category: 'deliverable', critical: true },
      { name: 'Submit Final Bill', duration: 2, trade: 'PM', category: 'deliverable' },
      { name: 'Turnover (Project Complete)', duration: 1, trade: 'PM', category: 'deliverable', critical: true },
    ],
  },
];
