// Calibration from council audit #2 (2026-10-14): UT System / UNT executed and proposal
// schedules (UNT Starbucks Ph2, UTSW Memorial Garden Ash Vault, UTSW C1 Mech Vault,
// UTSW NB10.208, UTD University Village Balcony Rebuild, UTD WSTC). Every parameter is
// provisional (n <= 3 per family) — review at n >= 8. Evidence and seat votes:
// skills/bidforge-schedules/knowledge/council/2026-10-14-ut-system-audit/.

// Size bands. Micro = small interior jobs whose overrun came from fixed-time rows, not sizing
// (SF envelope 23–26 WD vs 25–31 WD real). Value thresholds apply only when SF is unknown.
export const SIZE_BANDS = {
  microEnvelopeWd: 30,
  microValue: 250000,
  largeEnvelopeWd: 90,
  largeValue: 1000000,
};

// Rows that change with the size band (council medians).
export const BAND_DURATIONS = {
  'Submittal Processing Time': { micro: 8, standard: 15, large: 20 },
  'Perform Punch Corrections': { micro: 4, standard: 6, large: 10 },
  'GC Generated Punch List Sent to Architect / Owner': { micro: 1, standard: 2, large: 2 },
};
// AHJ inspection base duration in the micro band (UNT: every hold was 1 day). The notice and
// re-inspection contingency stay at the owner profile (user canon LL-22: 5 WD / 2 WD).
export const MICRO_INSPECTION_WD = 1;

// Owner notice profiles. Default is user canon (LL-22). Presets are offered, never applied
// silently; selecting one is a user decision logged in the changelog.
export const OWNER_PROFILES = {
  default: { label: 'Default (AHJ 5 WD notice, 2 WD re-inspection)', inspectionNoticeWd: 5, contingencyWd: 2, operationalImpactNoticeWd: 10 },
  unt: { label: 'UNT System (72 h inspection notice) — user decision', inspectionNoticeWd: 3, contingencyWd: 2, operationalImpactNoticeWd: 10, evidence: 'UNT Starbucks Ph2: "UNT inspections 72-hr notice"' },
};

// Phase-only rows: meaningful only when the job has more than one phase.
export const MULTI_PHASE_ONLY = ['Next Phase Re-Mobilization & Protection', 'Phase Turnover & Owner Relocation (Per Phase)'];

// Backbone site / exterior rows. They run as their own flow from Mobilization beside the
// interior backbone and join it at Final Clean (Ash Vault: 17 WD of site work; the engine had
// them in series ahead of Make Safe).
export const EXTERIOR_FLOW = ['Exterior Containment', 'Site Work', 'Underground Inspections', 'Pourback — Exterior',
  'Landscape Repairs', 'Sod & Commercial Planting', 'Permanent Fencing', 'Exterior Inspections'];
export const EXTERIOR_MODULES = ['site_work', 'exterior_improvements', 'roofing', 'below_grade_structural', 'structural_exterior_rebuild'];

// Exposed-work weather allowance: one visible row, ceil(exposed WD × monthly rate), capped.
// DFW rain: Apr–Jun is as wet as winter (C1 Vault rain days Apr–Jun 2025; Ash Vault lost 3 WD in March).
export const WEATHER = {
  rateByMonth: [0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.05, 0.05, 0.05, 0.10, 0.10, 0.10],
  defaultRate: 0.10,
  capWd: 20,
  rowName: 'Weather Contingency — Exposed Work',
};

// Precon module reviews that need only the design documents start at NTP and feed the job-start
// gate (Health Dept plan review, structural review, finish selections). Rows that need sub shop
// drawings (FA NICET drawings → fire-marshal permit) stay after subcontracts.
export const NTP_REVIEW_RE = /plan review|structural engineer review|finish selections|abatement plan|dshs|hhsc.*review|owner user group/i;
export const SHOP_DRAWING_RE = /shop drawing|nicet|battery calc|permit submittal|permit approved|^submittals?:/i;

// Contract-value envelope (interior tiers only): construction WD ≈ 27.3·(V / $100k)^0.511
// (UNT, NB10, WSTC; residuals 0.86–1.11). Warn-only, never a hard fail.
export const VALUE_ENVELOPE = { coef: 27.3, exp: 0.511, per: 100000, band: [0.6, 1.6], mismatch: 1.6, escalationPct: 4, ownerEquipmentCapPct: 25 };

// New modules (seats A + C; durations are the council medians for a ~200 SF vault / one building).
export const CALIBRATION_MODULES = [
  { id: 'below_grade_structural', label: 'Below-Grade Structure (Vault / Pit / Foundation)', cls: 'standard_renovation', keywords: ['vault', 'drilled pier', 'shoring', 'cast-in-place', 'retaining wall', 'below grade', 'waterproofing membrane', 'drainage mat', 'pit'], confirm: 'Is there below-grade structural work (vault, pit, piers, CIP walls, waterproofing)?' },
  { id: 'structural_exterior_rebuild', label: 'Exterior Structural Rebuild (Balcony / Deck)', cls: 'standard_renovation', keywords: ['balcony', 'deck rebuild', 'traffic coating', 'wrb', 'sheathing', 'siding', 'engineered shoring'], confirm: 'Is there an exterior structural rebuild (balconies, decks, breezeways)?' },
];

// The council's exterior_improvements rows are building-envelope work (storefront, cladding,
// sealants); the module itself is landscaping / fencing / signage. Envelope rows belong to
// Roofing / Envelope, whose keywords already cover storefront and curtain wall.
export const ENVELOPE_ROWS = ['Exterior Scaffolding / Lift Setup', 'Exterior Demolition (Windows, Cladding, Canopies)',
  'Air/Water Barrier & Opening Flashing', 'Exterior Storefront & Window Installation (Dry-In)', 'Window Field Water Test (AAMA 501.2)',
  'Exterior Cladding, Masonry & EIFS Repairs', 'Canopy & Exterior Lighting Installation', 'Exterior Sealants & Joint Replacement',
  'Exterior Painting & Coatings', 'Submittals: Exterior Storefront, Windows & Sealants'];

const row = (name, duration, trade, after, extra = {}) => ({ name, duration, trade, cls: 'standard_renovation', csi: extra.csi || '03', hasSubmittal: false, leadDays: 0, phase: 'construction', milestone: duration === 0, after, parallel: false, ...extra });

export const CALIBRATION_MODULE_TASKS = {
  // Durations are for a ~200 SF footprint (sizeBase); labor rows scale by (SF / 200)^0.379.
  below_grade_structural: [
    row('Utility Locates, Hydro-Excavation & Soil Testing', 3, 'Earthwork', 'Ready to Mobilize — Confirmed NTXP PM / Super', { phase: 'preconstruction', parallel: true, csi: '31' }),
    row('Excavation & Haul-Off', 8, 'Earthwork', 'Exterior Containment', { csi: '31', exposed: true, sizeBase: 200 }),
    row('Shoring / Trench Box', 3, 'Earthwork', 'Exterior Containment', { csi: '31', exposed: true, sizeBase: 200 }),
    row('Drilled Piers + Pier Special Inspection', 5, 'Concrete', 'Exterior Containment', { exposed: true, sizeBase: 200 }),
    row('Mud Slab & Subgrade', 3, 'Concrete', 'Exterior Containment', { exposed: true, sizeBase: 200 }),
    row('Base Slab — Form, Rebar, Pre-Pour SI & Pour', 4, 'Concrete', 'Exterior Containment', { exposed: true, sizeBase: 200 }),
    ...[1, 2, 3].map(n => row(`CIP Walls — Lift ${n} (Form, Rebar, SI, Pour)`, 5, 'Concrete', 'Exterior Containment', { exposed: true, sizeBase: 200, lift: n })),
    row('Lid / Roof Slab — Deck, Rebar, SI, Pour', 6, 'Concrete', 'Exterior Containment', { exposed: true, sizeBase: 200 }),
    row('Vault MEP (Sump Pump, Exhaust Fan, Lighting, Controls)', 6, 'MEP', 'Exterior Containment', { csi: '26', sizeBase: 200 }),
    row('Waterproofing & Drainage Mat', 4, 'Waterproofing', 'Exterior Containment', { csi: '07', exposed: true, sizeBase: 200 }),
    row('Waterproofing QC / Photo Hold & Inspection', 1, 'Owner', 'Exterior Containment', { csi: '07', cls: 'inspection', sizeBase: 200 }),
    row('Sump, Slot Drains & Storm Tie-In', 3, 'Plumbing', 'Exterior Containment', { csi: '33', exposed: true, sizeBase: 200 }),
    row('Backfill in Lifts with Compaction Testing', 3, 'Earthwork', 'Exterior Containment', { csi: '31', exposed: true, sizeBase: 200 }),
    row('Misc. Metals — Ladder, Handrail, Hatch (after field measure + fab lead)', 2, 'Metals', 'Exterior Containment', { csi: '05', hasSubmittal: true, leadDays: 14, sizeBase: 200 }),
    row('Final Grade & Surface Restoration', 3, 'Earthwork', 'Exterior Containment', { csi: '32', exposed: true, sizeBase: 200 }),
  ],
  // One building cycle (~25 WD); not SF-scaled — repeat per building via phases / zones.
  structural_exterior_rebuild: [
    row('Engineered Temporary Shoring', 4, 'Structural', 'Exterior Containment', { csi: '31', exposed: true, noScale: true }),
    row('Demolition — Balcony / Deck Structure', 6, 'Demolition', 'Exterior Containment', { csi: '02', exposed: true, noScale: true }),
    row('Structural Framing Rebuild', 8, 'Framing', 'Exterior Containment', { csi: '06', exposed: true, noScale: true }),
    row('Sheathing, WRB & Self-Adhered Membrane', 5, 'Waterproofing', 'Exterior Containment', { csi: '07', exposed: true, noScale: true }),
    row('WRB QC / Water-Test Hold', 1, 'Owner', 'Exterior Containment', { csi: '07', cls: 'inspection' }),
    row('Siding, Trim & Paint', 5, 'Siding', 'Exterior Containment', { csi: '07', exposed: true, noScale: true }),
    row('Decking, Rails & Traffic Coating', 5, 'Carpentry', 'Exterior Containment', { csi: '06', exposed: true, noScale: true }),
  ],
};
// Overlap inside the new flows (council: excavation/shoring SS, cure lags before the next lift,
// waterproofing gated by its QC hold, SS overlaps in the rebuild cycle).
export const CALIBRATION_LINKS = [
  { from: 'Excavation & Haul-Off', to: 'Shoring / Trench Box', type: 'SS', lag: 2 },
  { from: 'Shoring / Trench Box', to: 'Drilled Piers + Pier Special Inspection', type: 'FS', lag: 0 },
  { from: 'Excavation & Haul-Off', to: 'Mud Slab & Subgrade', type: 'FS', lag: 0 },
  { from: 'Drilled Piers + Pier Special Inspection', to: 'Mud Slab & Subgrade', type: 'FS', lag: 0 },
  { from: 'Base Slab — Form, Rebar, Pre-Pour SI & Pour', to: 'CIP Walls — Lift 1 (Form, Rebar, SI, Pour)', type: 'FS', lag: 3 },
  { from: 'CIP Walls — Lift 1 (Form, Rebar, SI, Pour)', to: 'CIP Walls — Lift 2 (Form, Rebar, SI, Pour)', type: 'FS', lag: 3 },
  { from: 'CIP Walls — Lift 2 (Form, Rebar, SI, Pour)', to: 'CIP Walls — Lift 3 (Form, Rebar, SI, Pour)', type: 'FS', lag: 3 },
  { from: 'CIP Walls — Lift 2 (Form, Rebar, SI, Pour)', to: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', type: 'FS', lag: 3 },
  { from: 'CIP Walls — Lift 3 (Form, Rebar, SI, Pour)', to: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', type: 'FS', lag: 3 },
  { from: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', to: 'Vault MEP (Sump Pump, Exhaust Fan, Lighting, Controls)', type: 'SS', lag: 2 },
  { from: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', to: 'Waterproofing & Drainage Mat', type: 'FS', lag: 3 },
  { from: 'Waterproofing & Drainage Mat', to: 'Sump, Slot Drains & Storm Tie-In', type: 'SS', lag: 0 },
  { from: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', to: 'Backfill in Lifts with Compaction Testing', type: 'FS', lag: 5 },
  { from: 'Waterproofing QC / Photo Hold & Inspection', to: 'Backfill in Lifts with Compaction Testing', type: 'FS', lag: 0 },
  { from: 'Set Prefabricated Vault / Tank (Crane)', to: 'Backfill in Lifts with Compaction Testing', type: 'FS', lag: 0 },
  { from: 'Lid / Roof Slab — Deck, Rebar, SI, Pour', to: 'Misc. Metals — Ladder, Handrail, Hatch (after field measure + fab lead)', type: 'FS', lag: 0 },
  { from: 'Leveling Pad / Footing — SI & Pour', to: 'Set Prefabricated Vault / Tank (Crane)', type: 'FS', lag: 3 },
  { from: 'Excavation & Haul-Off', to: 'Leveling Pad / Footing — SI & Pour', type: 'FS', lag: 0 },
  { from: 'Final Grade & Surface Restoration', to: 'Landscape Repairs', type: 'SS', lag: 1 },
  { from: 'Backfill in Lifts with Compaction Testing', to: 'Final Grade & Surface Restoration', type: 'SS', lag: 1 },
  { from: 'Engineered Temporary Shoring', to: 'Demolition — Balcony / Deck Structure', type: 'FS', lag: 0 },
  { from: 'Demolition — Balcony / Deck Structure', to: 'Structural Framing Rebuild', type: 'SS', lag: 3 },
  { from: 'Structural Framing Rebuild', to: 'Sheathing, WRB & Self-Adhered Membrane', type: 'SS', lag: 5 },
  { from: 'Siding, Trim & Paint', to: 'Decking, Rails & Traffic Coating', type: 'SS', lag: 3 },
  // Site flow overlaps (Ash Vault: landscaping ran beside backfill).
  { from: 'Landscape Repairs', to: 'Sod & Commercial Planting', type: 'SS', lag: 1 },
  { from: 'Sod & Commercial Planting', to: 'Permanent Fencing', type: 'SS', lag: 0 },
];

// Precast / prefabricated variant (Ash Vault): the walls and lid become a crane set, gated by
// delivery (owner/fabricator lead), not by excavation.
export const PRECAST_REPLACES = ['Drilled Piers + Pier Special Inspection', 'Mud Slab & Subgrade', 'Base Slab — Form, Rebar, Pre-Pour SI & Pour',
  'CIP Walls — Lift 1 (Form, Rebar, SI, Pour)', 'CIP Walls — Lift 2 (Form, Rebar, SI, Pour)', 'CIP Walls — Lift 3 (Form, Rebar, SI, Pour)',
  'Lid / Roof Slab — Deck, Rebar, SI, Pour', 'Vault MEP (Sump Pump, Exhaust Fan, Lighting, Controls)', 'Waterproofing & Drainage Mat',
  'Waterproofing QC / Photo Hold & Inspection', 'Sump, Slot Drains & Storm Tie-In'];
export const PRECAST_ROWS = [
  row('Leveling Pad / Footing — SI & Pour', 2, 'Concrete', 'Exterior Containment', { csi: '03', exposed: true, sizeBase: 200 }),
  row('Set Prefabricated Vault / Tank (Crane)', 2, 'Structural', 'Exterior Containment', { csi: '03', exposed: true, noScale: true, hasSubmittal: true, leadDays: 28 }),
];

// Food-service / lab under-slab sequence (UNT Starbucks; NB10).
export const KITCHEN_ROWS = [
  row('GPR Scan & Core / Sawcut Slab for Under-Slab Plumbing', 1, 'GPR', 'Selective & Interior Trench Demo', { csi: '02' }),
  row('All MEP Below Slab Complete', 0, 'GC', 'Cover-Up Inspections', { category: 'deliverable', cls: 'project_management' }),
  row('MEP Through Millwork (Electrical Rerun & Plumbing Top-Out)', 4, 'MEP', 'Install Millwork / Cabinetry / Casework', { csi: '22' }),
];
export const KITCHEN_LINKS = [
  { from: 'All MEP Below Slab Complete', to: 'Install Millwork / Cabinetry / Casework', type: 'FS', lag: 0 },
  { from: 'Install Millwork / Cabinetry / Casework', to: 'MEP Through Millwork (Electrical Rerun & Plumbing Top-Out)', type: 'SS', lag: 1 },
];

// Optional rows switched on from the scope profile.
export const OPTIONAL_ROWS = {
  ownerStoredItems: row('Transport Owner-Stored FF&E / Equipment to Site', 2, 'General', 'Selective & Interior Trench Demo', { csi: '01', parallel: true }),
};
