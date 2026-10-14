import { JEV_LIBRARY } from './jevLibrary.js';
import { CALIBRATION_MODULES } from './jevCalibration.js';
import { COUNCIL_GATE_KEYWORDS } from './jevModuleTasks.js';

// JEV taxonomy — the deterministic classification spine.
// Level 1 class -> Level 2 trade -> Level 3 submittal/lead -> Phase -> Milestone.

export const JEV_CLASSES = [
  { id: 'standard_renovation', label: 'Standard Renovation', color: '#46567D' },
  { id: 'security', label: 'Security', color: '#5B3A8E' },
  { id: 'hospital', label: 'Hospital / Medical', color: '#0F7C7A' },
  { id: 'low_voltage', label: 'Low Voltage', color: '#2F529B' },
  { id: 'life_safety', label: 'Life Safety', color: '#B45309' },
  { id: 'inspection', label: 'Inspection', color: '#D0353C' },
  { id: 'oac', label: 'OAC', color: '#1B2A4E' },
  { id: 'project_management', label: 'Project Management', color: '#16224A' },
  { id: 'design', label: 'Design', color: '#6B5B95' },
  { id: 'permit', label: 'Permit', color: '#8A5A00' },
];

export const PHASES = [
  { id: 'preconstruction', label: 'Preconstruction' },
  { id: 'construction', label: 'Construction' },
  { id: 'closeout', label: 'Closeout' },
];

// Gated modules. A module is only added once documents or the user confirm it.
// `keywords` drive deterministic detection; `confirm` is the question asked when
// evidence is weak or missing.
export const JEV_MODULES = [
  { id: 'selective_demo', label: 'Selective Demolition', cls: 'standard_renovation', keywords: ['selective demolition', 'selective demo', '02 41 19', 'remove existing', 'demolish'], confirm: 'Does the scope include selective demolition of existing construction?' },
  { id: 'abatement', label: 'Abatement (Asbestos / Lead)', cls: 'life_safety', keywords: ['asbestos', 'acm', 'lead-based paint', 'lead paint', 'abatement', 'hazardous material', '02 82', '02 83', 'mold remediation'], confirm: 'Is any asbestos, lead or other hazardous-material abatement required?' },
  { id: 'icra', label: 'ICRA Containment / Infection Control', cls: 'hospital', keywords: ['icra', 'infection control', 'negative air', 'anteroom', 'class iii', 'class iv', 'pcra', 'hepa'], confirm: 'Is the work in an occupied healthcare area that requires ICRA containment?' },
  { id: 'occupied_phasing', label: 'Occupied Building / Phasing', cls: 'project_management', keywords: ['occupied', 'phasing plan', 'phased', 'after hours', 'night work', 'weekend work', 'swing space', 'remain in operation'], confirm: 'Will the building stay occupied or does the work need to be phased?' },
  { id: 'low_voltage', label: 'Low Voltage / Structured Cabling', cls: 'low_voltage', keywords: ['structured cabling', 'low voltage', 'cat6', 'cat 6', 'data drop', 'division 27', '27 10', 'wireless access point', 'av system', 'audio visual', 'paging', 'intercom'], confirm: 'Does the scope include data, AV or other low-voltage cabling?' },
  { id: 'access_control', label: 'Access Control / Electronic Security', cls: 'security', keywords: ['access control', 'card reader', 'electrified hardware', 'electric strike', 'cctv', 'video surveillance', 'division 28', '28 10', '28 20', 'intrusion'], confirm: 'Is there access control, CCTV or intrusion-detection work?' },
  { id: 'fire_alarm', label: 'Fire Alarm', cls: 'life_safety', keywords: ['fire alarm', '28 31', '28 46', 'facp', 'notification appliance', 'smoke detector', 'horn strobe'], confirm: 'Does the scope modify or add fire alarm devices or panels?' },
  { id: 'fire_suppression', label: 'Fire Suppression', cls: 'life_safety', keywords: ['fire sprinkler', 'sprinkler', 'fire suppression', 'division 21', '21 13', 'standpipe', 'fire pump', 'clean agent'], confirm: 'Does the scope modify or add fire sprinkler / suppression?' },
  { id: 'medical_specialties', label: 'Medical Specialties (Headwalls, Curtain Track)', cls: 'hospital', keywords: ['cubicle curtain', 'curtain track', 'headwall', 'medical gas', 'nurse call', 'patient lift', 'ceiling lift', 'wall equipment'], confirm: 'Are there medical specialties such as curtain track, headwalls, medical gas or nurse call?' },
  { id: 'medical_specific', label: 'Medical-Specific Construction', cls: 'hospital', keywords: ['exam room', 'patient room', 'clinic', 'outpatient', 'hospital bed', 'stainless steel duct', 'glass drain', 'acid waste', 'chemical resistant', 'reinforced framing', 'equipment backing', 'pharmacy', 'usp 797', 'usp 800'], confirm: 'Is this a patient-care, clinic or other medical space?' },
  { id: 'imaging', label: 'Imaging (X-Ray / CT / MRI)', cls: 'hospital', keywords: ['x-ray', 'xray', 'radiology', 'ct scanner', 'mri', 'lead lined', 'lead-lined', 'radiation shielding', 'physicist', 'rf shielding', 'imaging'], confirm: 'Is there any X-ray, CT, MRI or radiation-shielded room?' },
  { id: 'mep_lab', label: 'MEP / Laboratory', cls: 'hospital', keywords: ['laboratory', 'lab casework', 'fume hood', 'biosafety', 'eyewash', 'emergency shower', 'lab gas', 'ro/di', 'acid neutralization'], confirm: 'Does the project include laboratory spaces or lab MEP systems?' },
  { id: 'opci', label: 'Owner Provided / Contractor Installed', cls: 'project_management', keywords: ['owner furnished', 'owner provided', 'ofci', 'opci', 'n.i.c.', 'nic', 'owner supplied', 'furnished by owner'], confirm: 'Are any items owner-furnished for NTXP to install (OFCI / OPCI)?' },
  { id: 'complex_owner', label: 'Complex Owner Processes (Mockups / Staging)', cls: 'design', keywords: ['mockup', 'mock-up', 'sample panel', 'field verify location', 'cutout', 'rendering', 'owner approval of location', 'staging area', 'move management'], confirm: 'Does the owner require mockups, cut-outs, renderings or staged approvals?' },
  { id: 'site_work', label: 'Exterior Site Work', cls: 'standard_renovation', keywords: ['excavation', 'grading', 'earthwork', 'division 31', 'division 32', 'paving', 'asphalt', 'site concrete', 'storm drain', 'utility trench', 'division 33'], confirm: 'Is there excavation, grading, paving or site-utility work?' },
  { id: 'exterior_improvements', label: 'Exterior Improvements', cls: 'standard_renovation', keywords: ['landscaping', 'irrigation', 'fencing', 'monument sign', 'statue', 'electronic sign', 'marquee', 'building signage', 'swppp', 'site furnishings', 'flagpole'], confirm: 'Are there exterior improvements such as landscaping, fencing, signage or SWPPP?' },
  { id: 'roofing', label: 'Roofing / Envelope', cls: 'standard_renovation', keywords: ['roofing', 'roof replacement', 'membrane', 'tpo', 'modified bitumen', 'flashing', 'division 07 50', 'curtain wall', 'storefront'], confirm: 'Is any roofing or building-envelope work included?' },
  { id: 'elevator', label: 'Elevator / Conveying', cls: 'life_safety', keywords: ['elevator', 'division 14', 'wheelchair lift', 'conveying', 'tdlr elevator'], confirm: 'Is elevator or other conveying-equipment work included?' },
  { id: 'kitchen_foodservice', label: 'Kitchen / Food Service', cls: 'standard_renovation', keywords: ['kitchen equipment', 'food service', 'walk-in cooler', 'grease interceptor', 'kitchen hood', 'type i hood', 'health department'], confirm: 'Is there commercial kitchen or food-service work?' },
  { id: 'isd_college', label: 'ISD / College Campus', cls: 'project_management', keywords: ['isd', 'independent school district', 'campus', 'college', 'university', 'summer break', 'student', 'classroom', 'badging', 'fingerprint'], confirm: 'Is the owner an ISD, college or university campus?' },
  { id: 'secured_building', label: 'Secured Building (Jail / Court / Holding)', cls: 'security', keywords: ['detention', 'jail', 'holding cell', 'sally port', 'courtroom', 'court', 'security hollow metal', 'detention hardware', 'security glazing', 'escort'], confirm: 'Is the building a jail, court, holding area or other secured facility?' },
  { id: 'hvac_replacement', label: 'HVAC Equipment Replacement (Council-added)', cls: 'standard_renovation', keywords: ['rtu replacement', 'ahu replacement', 'chiller', 'crane pick', 'temporary cooling', 'rooftop unit', 'refrigerant recovery'], confirm: 'Is major HVAC equipment (RTU / AHU / chiller) being replaced?' },
  { id: 'emergency_power', label: 'Emergency Power / Generator (Council-added)', cls: 'life_safety', keywords: ['generator', 'automatic transfer switch', 'ats', 'nfpa 110', 'load bank', 'emergency power', 'life safety branch'], confirm: 'Does the scope include a generator, ATS or emergency power distribution?' },
  { id: 'joc_csp_admin', label: 'JOC / CSP Administration', cls: 'project_management', keywords: ['job order contract', 'joc', 'gordian', 'egordian', 'csp', 'competitive sealed proposal', 'rsmeans', 'adjustment factor', 'purchase order'], confirm: 'Is this a JOC or CSP procurement with its own admin steps?' },
  ...CALIBRATION_MODULES,
];

// Council gate keywords (>= 2 seats) extend each module's detection vocabulary.
const GENERIC = new Set(['survey', 'containment', 'by owner', 'owner', 'existing', 'renovation', 'building', 'interior', 'exterior', 'new', 'install', 'equipment', 'testing', 'inspection', 'permit', 'phase']);
for (const m of JEV_MODULES) {
  m.keywords = [...new Set([...m.keywords, ...(COUNCIL_GATE_KEYWORDS[m.id] || []).filter(k => k.length > 3 && !GENERIC.has(k))])];
}

export const MODULE_BY_ID = Object.fromEntries(JEV_MODULES.map(m => [m.id, m]));

// Deterministic module detection. Returns evidence per module; never confirms.
export function detectModules(text) {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const results = [];
  for (const mod of JEV_MODULES) {
    const hits = [];
    for (const kw of mod.keywords) {
      const re = new RegExp(`[^a-z0-9]${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`, 'g');
      const count = (lower.match(re) || []).length;
      if (count) hits.push({ keyword: kw, count });
    }
    if (hits.length) {
      const score = hits.reduce((s, h) => s + Math.min(h.count, 3), 0);
      results.push({
        id: mod.id,
        hits,
        score,
        strength: score >= 4 || hits.length >= 3 ? 'strong' : 'weak',
      });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

const CLASS_RULES = [
  ['inspection', /inspect|walkthrough|walk-through|fire marshal|ahj|tdlr|tas|re-?inspection|cover-?up|above.?ceiling/i],
  ['permit', /permit|plan review|certificate of occupancy|\bco\b(?! #)|swppp noi|noi\b|not\b/i],
  ['oac', /\boac\b|owner.?architect|progress meeting|precon(struction)? meeting|kickoff|punch walk|final walk/i],
  ['design', /submittal|shop drawing|rfi|asi|mockup|mock-up|rendering|design|architect review|substitution/i],
  ['life_safety', /fire alarm|sprinkler|fire suppress|firestop|fire seal|fire extinguisher|life safety|egress|emergency light/i],
  ['low_voltage', /low voltage|cabling|data|telecom|av\b|audio.?visual|paging|intercom|wap\b/i],
  ['security', /access control|card reader|cctv|camera|detention|security|badg/i],
  ['hospital', /icra|medical|headwall|curtain track|nurse call|med gas|patient|exam|imaging|x-?ray|lab\b|laboratory/i],
  ['project_management', /contract|ntp|notice to proceed|schedule|pay app|invoice|closeout|turnover|warranty|o&m|as-?built|mobiliz|subcontract|purchase order|buyout|badge|directory|mbe|hub\b|sbe/i],
];

const TRADE_RULES = [
  ['Demolition', /demo|salvage|remove/i], ['Abatement', /abat|asbestos|lead/i],
  ['Concrete', /concrete|pour|slab|trench|pourback/i], ['Masonry', /masonry|cmu|brick/i],
  ['Structural Steel', /structural|steel|metals|lintel/i], ['Framing/Drywall', /fram|drywall|stud|tape|gyp|ceiling grid|hard lid|blocking/i],
  ['Doors/Hardware', /door|hardware|frame/i], ['Glazing', /glaz|storefront|window|glass/i],
  ['Roofing', /roof|flashing|membrane/i], ['Painting', /paint|prime|coating/i],
  ['Flooring', /floor|carpet|lvt|vct|tile|base\b|wall base/i], ['Millwork', /millwork|casework|cabinet|countertop/i],
  ['Acoustical Ceilings', /ceiling tile|act\b|acoustic/i], ['Specialties', /accessor|partition|signage|corner guard|wall protection|extinguisher|lockers/i],
  ['Fire Sprinkler', /sprinkler|suppression|standpipe/i], ['Fire Alarm', /fire alarm|facp|strobe/i],
  ['Plumbing', /plumb|sanitary|domestic water|fixture|drain|med gas/i], ['HVAC', /hvac|duct|rtu|ahu|vav|mechanical|air balance|tab\b/i],
  ['Electrical', /electric|panel|lighting|power|conduit|switchgear/i], ['Low Voltage', /low voltage|cabling|data|av\b|paging/i],
  ['Security/Access Control', /access control|card reader|cctv|camera/i], ['Detention Equipment', /detention|cell|sally/i],
  ['Earthwork', /excavat|grading|earthwork|site work|trench/i], ['Paving', /paving|asphalt/i],
  ['Landscape', /landscap|sod|irrigation|planting/i], ['Fencing', /fenc/i],
  ['Owner', /owner/i], ['Architect', /architect/i], ['AHJ', /inspect|fire marshal|permit/i],
];

const SUBMITTAL_RE = /install|deliver|material|equipment|fixture|hardware|door|frame|flooring|tile|millwork|casework|cabinet|panel|rtu|ahu|unit|lighting|glazing|ceiling|accessor|signage|curtain|headwall|partition/i;
const MILESTONE_RE = /ntp|notice to proceed|substantial completion|final completion|turnover|contract execution|mobiliz|start of construction|certificate of occupancy|final walk|gate|ready to/i;

const STOP = new Set('and or the a an of for to with by in on at from per all new existing install installed complete'.split(' '));
const toks = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map(w => w.replace(/([^s])s$/, '$1')).filter(w => w.length > 1 && !STOP.has(w)));
const LIB = JEV_LIBRARY.map(l => ({ ...l, keys: l.aliases.map(toks) }));

// Council-consensus library match (overlap coefficient over content words).
export function matchLibrary(name, min = 0.6) {
  const A = toks(name);
  if (!A.size) return null;
  let best = null; let bs = 0;
  for (const l of LIB) {
    for (const B of l.keys) {
      let i = 0; for (const x of A) if (B.has(x)) i++;
      const s = i >= 2 || (i === 1 && Math.min(A.size, B.size) === 1) ? i / Math.min(A.size, B.size) : 0;
      if (s > bs) { bs = s; best = l; }
    }
  }
  return bs >= min ? { ...best, score: bs } : null;
}

// Five-level classification of any line item: explicit values win, then the council
// library, then deterministic rules.
export function classifyLineItem(item) {
  const name = item.name || '';
  const lib = matchLibrary(name);
  const cls = item.cls || lib?.cls || (CLASS_RULES.find(([, re]) => re.test(name))?.[0] ?? 'standard_renovation');
  const trade = item.trade && item.trade !== 'General' ? item.trade : (lib?.trade || TRADE_RULES.find(([, re]) => re.test(name))?.[0] || 'GC');
  const hasSubmittal = item.hasSubmittal ?? lib?.hasSubmittal ?? (SUBMITTAL_RE.test(name) && !/inspect|meeting|walk/i.test(name));
  const phase = item.phase || lib?.phase || 'construction';
  const milestone = item.milestone ?? (MILESTONE_RE.test(name) || item.duration === 0);
  return { cls, trade, hasSubmittal, phase, milestone, csi: item.csi || lib?.csi || '', leadDays: item.leadDays || lib?.leadDays || 0, libraryMatch: lib?.name || null };
}
