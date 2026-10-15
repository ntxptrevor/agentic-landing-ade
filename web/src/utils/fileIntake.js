// Instant-schedule intake: classify uploaded files, extract their text in the browser
// and read the scheduling signals the skill needs (modules, size, value, sector, owner,
// dates, lead times). Deterministic — no model calls; the agent refines later.

import { detectModules } from '../data/jevTaxonomy.js';
import { OWNER_DETECT } from '../data/jevCalibration.js';
import { parseMSPDI, parseScheduleCSV } from './scheduleImport.js';

export const KINDS = {
  spec: 'Project manual / specifications / UGC',
  schedule: 'Existing schedule (MS Project XML, CSV)',
  quote: 'Quote / proposal / estimate',
  plan: 'Plans / drawings',
  photo: 'Site photo',
  input: 'Other input (email, minutes, notes)',
};

const ext = n => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

export function classifyFile(file, text = '') {
  const e = ext(file.name);
  const n = file.name.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'heic', 'webp', 'gif', 'tif', 'tiff'].includes(e)) return /plan|sheet|drawing|dwg|floor/.test(n) ? 'plan' : 'photo';
  if (['dwg'].includes(e) || /\b(plans?|drawings?|sheet [a-z]?\d|a\d{3}|cd set)\b/.test(n)) return 'plan';
  if (e === 'mpp' || (e === 'xml' && /<Project[\s>]/.test(text)) || /schedule|gantt|cpm|baseline/.test(n)) return 'schedule';
  if (/quote|proposal|estimate|bid form|pricing/.test(n) || /\b(quote|proposal)\b.*\$[\d,]+/i.test(text.slice(0, 4000))) return 'quote';
  if (/spec|manual|division|section 0|ugc|01 32 16|general conditions|supplementary/.test(n) || /SECTION\s+\d{2}\s?\d{2}\s?\d{2}/.test(text.slice(0, 8000))) return 'spec';
  return 'input';
}

async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  const pages = Math.min(doc.numPages, 150);
  for (let i = 1; i <= pages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map(it => it.str).join(' '));
  }
  return { text: out.join('\n'), pages: doc.numPages, truncated: doc.numPages > pages };
}

async function docxText(file) {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const r = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: r.value };
}

export async function extractText(file) {
  const e = ext(file.name);
  try {
    if (e === 'pdf') return await pdfText(file);
    if (e === 'docx') return await docxText(file);
    if (['txt', 'md', 'eml', 'csv', 'xml', 'json', 'html', 'htm'].includes(e)) return { text: await file.text() };
  } catch (err) {
    return { text: '', error: err.message };
  }
  return { text: '', note: e === 'mpp' ? 'Binary .mpp — save as XML from MS Project to import' : 'No text extracted (image / drawing) — kept as an attachment for the agent' };
}

export const MIN_SPEC_CHARS = 200;
export const isReadSpec = i => i.kind === 'spec' && String(i.text || '').trim().length >= MIN_SPEC_CHARS;

const num = s => Number(String(s).replace(/[,$\s]/g, ''));

// Signals from all extracted text.
export function analyzeIntake(items, projectName = '') {
  const all = items.map(i => i.text || '').join('\n\n');
  const modules = detectModules(all);
  const sfHits = [...all.matchAll(/(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:sq\.?\s*ft\.?|square\s+feet|s\.?f\.?)\b/gi)].map(m => num(m[1])).filter(v => v >= 100 && v <= 500000);
  const valHits = [...all.matchAll(/(?:total|contract\s+(?:sum|amount|value)|grand\s+total|base\s+bid|proposal\s+amount)[^$\d]{0,40}\$\s?([\d,]+(?:\.\d{2})?)/gi)].map(m => num(m[1])).filter(v => v >= 5000);
  const leadHits = [...all.matchAll(/([A-Za-z][\w &/-]{3,60}?)\s*[-–:]?\s*(?:lead\s*time|delivery|ships?)\s*(?:of|is|:|-)?\s*(\d{1,3})\s*(?:-\s*\d{1,3}\s*)?(weeks?|wks?|days?|business days)/gi)]
    .map(m => ({ item: m[1].trim().replace(/\s+/g, ' '), days: Number(m[2]) * (/w/i.test(m[3]) ? 7 : 1) }))
    .filter(l => l.days >= 5 && l.days <= 400).slice(0, 25);
  const ntp = all.match(/(?:notice to proceed|NTP|start date|commencement)[^0-9]{0,30}(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})/i);
  const days = all.match(/(\d{2,3})\s+(?:consecutive\s+)?calendar\s+days/i);
  const lower = all.toLowerCase();
  const sector = /hospital|clinic|patient|icra|medical center|healthcare/.test(lower) ? 'healthcare'
    : /jail|detention|courthouse|sally port/.test(lower) ? 'secured'
      : /university|college|campus|student union|residence hall/.test(lower) ? 'college'
        : /isd|independent school district|elementary|middle school|high school/.test(lower) ? 'isd'
          : /city of|county|txdot|municipal/.test(lower) ? 'municipal' : '';
  const owner = OWNER_DETECT.find(o => o.re.test(`${projectName} ${all.slice(0, 20000)}`))?.profile || 'default';
  const schedules = items.filter(i => i.kind === 'schedule' && i.text).map(i => {
    try { return { file: i.name, ...(/<Project[\s>]/.test(i.text) ? parseMSPDI(i.text) : parseScheduleCSV(i.text)) }; } catch (e) { return { file: i.name, error: e.message }; }
  });
  const ids = new Set(modules.map(m => m.id));
  const exteriorOnly = ids.size > 0 && [...ids].every(id => ['site_work', 'exterior_improvements', 'roofing', 'below_grade_structural', 'structural_exterior_rebuild', 'isd_college', 'joc_csp_admin', 'occupied_phasing'].includes(id));
  return {
    modules,
    sf: sfHits.length ? Math.max(...sfHits) : null,
    sfCandidates: [...new Set(sfHits)].slice(0, 6),
    contractValue: valHits.length ? Math.max(...valHits) : null,
    sector, ownerProfile: owner,
    tier: ids.has('hvac_replacement') && ids.size <= 2 ? 'equipment' : exteriorOnly ? 'exterior' : 'standard',
    constraints: [/occupied|remain in operation/.test(lower) && 'occupied', ids.has('icra') && 'icra', /phas(e|ed|ing) plan|in phases/.test(lower) && 'phased', /night work|after hours|weekend work/.test(lower) && 'night'].filter(Boolean),
    ntpText: ntp ? ntp[1] : null,
    contractDays: days ? Number(days[1]) : null,
    leadItems: leadHits,
    schedules,
    // A spec counts as read requirements only when text was actually extracted (a scanned PDF
    // without OCR does not); unread specs need a readable copy or the acknowledgement.
    requirementsDocs: items.filter(isReadSpec).map(i => i.name),
    unreadSpecs: items.filter(i => i.kind === 'spec' && !isReadSpec(i)).map(i => i.name),
    specText: items.filter(isReadSpec).map(i => i.text).join('\n').slice(0, 200000),
  };
}
