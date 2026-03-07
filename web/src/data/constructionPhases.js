export const CONSTRUCTION_PHASES = [
  {
    id: 'pre-construction',
    name: 'Pre-Construction',
    defaultTasks: [
      { name: 'Permit Acquisition', duration: 20, trade: 'General' },
      { name: 'Submittal Review', duration: 10, trade: 'General' },
      { name: 'Material Procurement', duration: 30, trade: 'General' },
      { name: 'Shop Drawings', duration: 15, trade: 'General' },
      { name: 'Site Survey', duration: 3, trade: 'Surveyor' },
    ],
  },
  {
    id: 'site-work',
    name: 'Site Work',
    defaultTasks: [
      { name: 'Mobilization', duration: 3, trade: 'General' },
      { name: 'Demolition', duration: 8, trade: 'Demolition' },
      { name: 'Clearing & Grubbing', duration: 3, trade: 'Earthwork' },
      { name: 'Grading', duration: 10, trade: 'Earthwork' },
      { name: 'Erosion Control', duration: 2, trade: 'Earthwork' },
      { name: 'Temporary Utilities', duration: 3, trade: 'General' },
    ],
  },
  {
    id: 'foundation',
    name: 'Foundation',
    defaultTasks: [
      { name: 'Excavation', duration: 5, trade: 'Earthwork' },
      { name: 'Formwork', duration: 7, trade: 'Concrete' },
      { name: 'Rebar Placement', duration: 5, trade: 'Concrete' },
      { name: 'Concrete Pour', duration: 2, trade: 'Concrete' },
      { name: 'Concrete Cure', duration: 14, trade: 'Concrete' },
      { name: 'Backfill', duration: 3, trade: 'Earthwork' },
      { name: 'Waterproofing', duration: 4, trade: 'Waterproofing' },
    ],
  },
  {
    id: 'structural',
    name: 'Structural',
    defaultTasks: [
      { name: 'Steel/Wood Framing', duration: 20, trade: 'Structural' },
      { name: 'Roof Decking', duration: 7, trade: 'Structural' },
      { name: 'Roofing', duration: 10, trade: 'Roofing' },
      { name: 'Structural Inspections', duration: 2, trade: 'General' },
    ],
  },
  {
    id: 'mep-rough',
    name: 'MEP Rough-In',
    defaultTasks: [
      { name: 'Plumbing Rough', duration: 15, trade: 'Plumbing' },
      { name: 'Electrical Rough', duration: 15, trade: 'Electrical' },
      { name: 'HVAC Rough', duration: 15, trade: 'HVAC' },
      { name: 'Fire Protection', duration: 10, trade: 'Fire Protection' },
      { name: 'MEP Inspections', duration: 2, trade: 'General' },
    ],
  },
  {
    id: 'exterior',
    name: 'Exterior Envelope',
    defaultTasks: [
      { name: 'Sheathing', duration: 7, trade: 'Carpentry' },
      { name: 'Windows & Doors', duration: 7, trade: 'Glazing' },
      { name: 'Siding/Masonry', duration: 15, trade: 'Masonry' },
      { name: 'Flashing & Waterproofing', duration: 5, trade: 'Waterproofing' },
    ],
  },
  {
    id: 'interior-rough',
    name: 'Interior Rough',
    defaultTasks: [
      { name: 'Insulation', duration: 5, trade: 'Insulation' },
      { name: 'Drywall Hang', duration: 8, trade: 'Drywall' },
      { name: 'Drywall Finish', duration: 7, trade: 'Drywall' },
      { name: 'Rough Carpentry', duration: 5, trade: 'Carpentry' },
    ],
  },
  {
    id: 'interior-finish',
    name: 'Interior Finish',
    defaultTasks: [
      { name: 'Prime & Paint', duration: 10, trade: 'Painting' },
      { name: 'Flooring', duration: 8, trade: 'Flooring' },
      { name: 'Trim & Millwork', duration: 7, trade: 'Carpentry' },
      { name: 'Cabinets & Countertops', duration: 5, trade: 'Cabinets' },
      { name: 'Fixtures & Hardware', duration: 4, trade: 'General' },
    ],
  },
  {
    id: 'mep-finish',
    name: 'MEP Finish',
    defaultTasks: [
      { name: 'Plumbing Fixtures', duration: 5, trade: 'Plumbing' },
      { name: 'Electrical Fixtures & Panels', duration: 5, trade: 'Electrical' },
      { name: 'HVAC Equipment', duration: 5, trade: 'HVAC' },
      { name: 'Controls & Testing', duration: 4, trade: 'General' },
    ],
  },
  {
    id: 'commissioning',
    name: 'Commissioning & Testing',
    defaultTasks: [
      { name: 'System Startup', duration: 4, trade: 'General' },
      { name: 'Balancing', duration: 4, trade: 'HVAC' },
      { name: 'Commissioning', duration: 7, trade: 'General' },
      { name: 'Punch List', duration: 7, trade: 'General' },
    ],
  },
  {
    id: 'closeout',
    name: 'Closeout',
    defaultTasks: [
      { name: 'Final Inspections', duration: 3, trade: 'General' },
      { name: 'Certificate of Occupancy', duration: 3, trade: 'General' },
      { name: 'Owner Training', duration: 2, trade: 'General' },
      { name: 'Project Turnover', duration: 1, trade: 'General' },
      { name: 'Warranty Documentation', duration: 2, trade: 'General' },
    ],
  },
];
