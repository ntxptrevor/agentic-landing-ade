export const CONSTRUCTION_PHASES = [
  {
    id: 'pre-construction',
    name: 'Pre-Construction',
    defaultTasks: [
      { name: 'Permit Acquisition', duration: 20, trade: 'General', category: 'deliverable' },
      { name: 'Submittal Review', duration: 10, trade: 'General', category: 'deliverable' },
      { name: 'Material Procurement', duration: 30, trade: 'General', category: 'delivery' },
      { name: 'Shop Drawings', duration: 15, trade: 'General', category: 'deliverable' },
      { name: 'Site Survey', duration: 3, trade: 'Surveyor', category: 'activity' },
    ],
  },
  {
    id: 'site-work',
    name: 'Site Work',
    defaultTasks: [
      { name: 'Mobilization', duration: 3, trade: 'General', category: 'activity' },
      { name: 'Demolition', duration: 8, trade: 'Demolition', category: 'activity' },
      { name: 'Clearing & Grubbing', duration: 3, trade: 'Earthwork', category: 'activity' },
      { name: 'Grading', duration: 10, trade: 'Earthwork', category: 'activity' },
      { name: 'Erosion Control', duration: 2, trade: 'Earthwork', category: 'activity' },
      { name: 'Temporary Utilities', duration: 3, trade: 'General', category: 'delivery' },
    ],
  },
  {
    id: 'foundation',
    name: 'Foundation',
    defaultTasks: [
      { name: 'Excavation', duration: 5, trade: 'Earthwork', category: 'activity' },
      { name: 'Formwork', duration: 7, trade: 'Concrete', category: 'activity' },
      { name: 'Rebar Placement', duration: 5, trade: 'Concrete', category: 'activity' },
      { name: 'Concrete Pour', duration: 2, trade: 'Concrete', category: 'activity' },
      { name: 'Concrete Cure', duration: 14, trade: 'Concrete', category: 'activity' },
      { name: 'Backfill', duration: 3, trade: 'Earthwork', category: 'activity' },
      { name: 'Waterproofing', duration: 4, trade: 'Waterproofing', category: 'activity' },
    ],
  },
  {
    id: 'structural',
    name: 'Structural',
    defaultTasks: [
      { name: 'Steel/Wood Framing', duration: 20, trade: 'Structural', category: 'activity' },
      { name: 'Roof Decking', duration: 7, trade: 'Structural', category: 'activity' },
      { name: 'Roofing', duration: 10, trade: 'Roofing', category: 'activity' },
      { name: 'Structural Inspections', duration: 2, trade: 'General', category: 'deliverable' },
    ],
  },
  {
    id: 'mep-rough',
    name: 'MEP Rough-In',
    defaultTasks: [
      { name: 'Plumbing Rough', duration: 15, trade: 'Plumbing', category: 'activity' },
      { name: 'Electrical Rough', duration: 15, trade: 'Electrical', category: 'activity' },
      { name: 'HVAC Rough', duration: 15, trade: 'HVAC', category: 'activity' },
      { name: 'Fire Protection', duration: 10, trade: 'Fire Protection', category: 'activity' },
      { name: 'MEP Inspections', duration: 2, trade: 'General', category: 'deliverable' },
    ],
  },
  {
    id: 'exterior',
    name: 'Exterior Envelope',
    defaultTasks: [
      { name: 'Sheathing', duration: 7, trade: 'Carpentry', category: 'activity' },
      { name: 'Windows & Doors', duration: 7, trade: 'Glazing', category: 'delivery' },
      { name: 'Siding/Masonry', duration: 15, trade: 'Masonry', category: 'activity' },
      { name: 'Flashing & Waterproofing', duration: 5, trade: 'Waterproofing', category: 'activity' },
    ],
  },
  {
    id: 'interior-rough',
    name: 'Interior Rough',
    defaultTasks: [
      { name: 'Insulation', duration: 5, trade: 'Insulation', category: 'activity' },
      { name: 'Drywall Hang', duration: 8, trade: 'Drywall', category: 'activity' },
      { name: 'Drywall Finish', duration: 7, trade: 'Drywall', category: 'activity' },
      { name: 'Rough Carpentry', duration: 5, trade: 'Carpentry', category: 'activity' },
    ],
  },
  {
    id: 'interior-finish',
    name: 'Interior Finish',
    defaultTasks: [
      { name: 'Prime & Paint', duration: 10, trade: 'Painting', category: 'activity' },
      { name: 'Flooring', duration: 8, trade: 'Flooring', category: 'activity' },
      { name: 'Trim & Millwork', duration: 7, trade: 'Carpentry', category: 'activity' },
      { name: 'Cabinets & Countertops', duration: 5, trade: 'Cabinets', category: 'delivery' },
      { name: 'Fixtures & Hardware', duration: 4, trade: 'General', category: 'delivery' },
    ],
  },
  {
    id: 'mep-finish',
    name: 'MEP Finish',
    defaultTasks: [
      { name: 'Plumbing Fixtures', duration: 5, trade: 'Plumbing', category: 'delivery' },
      { name: 'Electrical Fixtures & Panels', duration: 5, trade: 'Electrical', category: 'delivery' },
      { name: 'HVAC Equipment', duration: 5, trade: 'HVAC', category: 'delivery' },
      { name: 'Controls & Testing', duration: 4, trade: 'General', category: 'deliverable' },
    ],
  },
  {
    id: 'commissioning',
    name: 'Commissioning & Testing',
    defaultTasks: [
      { name: 'System Startup', duration: 4, trade: 'General', category: 'deliverable' },
      { name: 'Balancing', duration: 4, trade: 'HVAC', category: 'activity' },
      { name: 'Commissioning', duration: 7, trade: 'General', category: 'deliverable' },
      { name: 'Punch List', duration: 7, trade: 'General', category: 'deliverable' },
    ],
  },
  {
    id: 'closeout',
    name: 'Closeout',
    defaultTasks: [
      { name: 'Final Inspections', duration: 3, trade: 'General', category: 'deliverable' },
      { name: 'Certificate of Occupancy', duration: 3, trade: 'General', category: 'deliverable' },
      { name: 'Owner Training', duration: 2, trade: 'General', category: 'deliverable' },
      { name: 'Project Turnover', duration: 1, trade: 'General', category: 'deliverable' },
      { name: 'Warranty Documentation', duration: 2, trade: 'General', category: 'deliverable' },
    ],
  },
];
