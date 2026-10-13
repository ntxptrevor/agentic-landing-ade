#!/usr/bin/env node
// Merge independent council seat outputs (pipe-delimited, see references/council-prompt.md)
// into the JEV data files. Consensus = proposed by >= 2 seats. Single-seat rows are kept as
// candidates for the next council round or user decision; they are never auto-included.
//
// usage: node council_merge.mjs <out-dir-for-web-data> <report.md> seat_a.psv seat_b.psv seat_c.psv
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [outDir, reportPath, ...seatFiles] = process.argv.slice(2);
if (!outDir || seatFiles.length < 3) {
  console.error('usage: council_merge.mjs <web/src/data> <report.md> <seat1.psv> <seat2.psv> <seat3.psv>');
  process.exit(1);
}

const COLS = ['module', 'seq', 'task', 'class', 'trade', 'csi', 'submittal_or_lead', 'lead_days', 'phase', 'milestone', 'duration_days', 'insert_after', 'gate_keywords'];
const STOP = new Set('and or the a an of for to with by in on at from per if as is be any all new existing work install installed installation complete completed set up setup required recurring etc'.split(' '));
const SYN = [[/\bhepa\b|negative air|neg air/g, 'negair'], [/\bfacp\b/g, 'fire alarm panel'], [/\bahj\b/g, 'inspector'], [/\bboh\b/g, 'owner'], [/\bo&m\b/g, 'om manual']];

function tokens(s) {
  let t = String(s).toLowerCase();
  for (const [re, rep] of SYN) t = t.replace(re, rep);
  return new Set(t.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map(w => w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1')).filter(w => w.length > 1 && !STOP.has(w)));
}
function sim(a, b) {
  const A = tokens(a); const B = tokens(b);
  let i = 0; for (const x of A) if (B.has(x)) i++;
  if (i < 2 && !(i === 1 && Math.min(A.size, B.size) === 1)) return 0;
  return i / Math.min(A.size, B.size);
}
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const majority = xs => { const c = {}; for (const x of xs) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };

function parseSeat(file, idx) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const rows = []; const notes = []; let inNotes = false;
  for (const line of lines) {
    if (/^###\s*NOTES/i.test(line)) { inNotes = true; continue; }
    if (inNotes) { if (line.trim()) notes.push(line.replace(/^[-*\s]+/, '').trim()); continue; }
    const parts = line.split('|');
    if (parts.length < 12 || parts[0] === 'module') continue;
    const r = Object.fromEntries(COLS.map((c, i) => [c, (parts[i] || '').trim()]));
    r.seat = idx; r.seq = Number(r.seq) || 0; r.duration_days = Number(r.duration_days) || 0; r.lead_days = Number(r.lead_days) || 0;
    rows.push(r);
  }
  return { file: path.basename(file), rows, notes };
}

const seats = seatFiles.map(parseSeat);

// Backbone (NTXP canon) anchors
const { CONSTRUCTION_PHASES } = await import(pathToFileURL(path.resolve(outDir, 'constructionPhases.js')).href);
const backbone = CONSTRUCTION_PHASES.flatMap(p => p.defaultTasks.map(t => ({ name: t.name, phase: p.id })));
backbone.forEach((b, i) => { b.order = i; });
const ALIAS = [
  [/final clean/i, 'Final Clean'], [/^mobiliz/i, 'Mobilization'], [/punch list (complet|correct)/i, 'Complete Punch Items'],
  [/substantial completion/i, 'Owner Punch Walk / Substantial Completion'], [/notice to proceed|\bntp\b/i, 'Notice to Proceed (NTP)'],
  [/contract (execut|award|sign)/i, 'Contract Execution'], [/kickoff/i, 'Kickoff Meeting'], [/precon/i, 'Preconstruction Meeting'],
  [/submittal (log|register)/i, 'Submittal Register Approval'], [/submittal|shop drawing/i, 'Submittal Processing Time'],
  [/subcontract|buyout/i, 'All Subcontracts Signed — Confirmed'], [/temporary (barrier|partition|dust)|dust (barrier|partition)/i, 'Temporary Barriers Erected'],
  [/site logistic|safety plan|phasing plan/i, 'Infection Control & Logistics Meeting'], [/badg/i, 'Badging Meeting & Processing Time'],
  [/demo.*ceiling|ceiling.*demo|selective demo|interior demo/i, 'Selective & Interior Trench Demo'], [/abatement|hazmat/i, 'Make Safe'],
  [/layout|stud|framing/i, 'NLB Framing'], [/door frame|hollow metal frame/i, 'Install Door Frames'], [/blocking|backing/i, 'Wood Blocking (Millwork, Windows, Wall-Mounted Items)'],
  [/in-?wall|wall rough|rough-?in/i, 'Wall MEP Rough'], [/cover|pre-?cover|close-?in insp/i, 'Cover-Up Inspections'],
  [/overhead|above.?ceiling rough/i, 'Overhead MEP Rough'], [/above.?ceiling insp/i, 'T-Bar Above-Ceiling MEP Inspection'],
  [/drywall|hang|tape|finish gyp/i, 'Drywall & Taping'], [/prime|first coat|paint/i, 'Prime Coat Walls'], [/ceiling grid|grid/i, 'Ceiling Grid or Hard Lid Installation & Prime'],
  [/ceiling tile|lay-?in/i, 'Ceiling Tile Installation'], [/floor/i, 'Install Flooring — All Types'], [/millwork|casework|cabinet/i, 'Install Millwork / Cabinetry / Casework'],
  [/door hardware|hardware/i, 'Install Door Hardware & Accessories'], [/\bdoors?\b/i, 'Install Doors'], [/specialt|accessor|toilet partition/i, 'Install Restroom Accessories & Partitions'],
  [/signage/i, 'Install ADA Room Signage'], [/trim|device/i, 'Fire Alarm Trim'], [/start-?up|commission|tab\b|test.*balanc/i, 'Start Up Control Systems & Test'],
  [/fire marshal|final insp|building final|certificate of occupancy/i, 'Owner Punch Walk / Substantial Completion'], [/pre-?punch|gc punch/i, 'GC PM / Super Pre-Punch'],
  [/o&m|om manual|closeout doc|as-?built|warrant/i, 'Begin Closeout Documentation'], [/final (pay|bill)|retainage/i, 'Submit Final Bill'],
  [/turnover|owner occupancy|move-?in/i, 'Turnover (Project Complete)'], [/underground|under-?slab|trench/i, 'Interior Underground Plumbing'],
  [/pourback|patch slab/i, 'Pourback — Interior Trenches'], [/oac|progress meeting|daily report/i, 'Mobilization'], [/drawing.*review|spec.*review/i, 'Submittal Register Approval'],
  [/permit/i, 'Confirm Job Start Approval (Gate)'], [/solicitation|proposal|owner request/i, 'Contract Execution'], [/site work|excavat|grading|earthwork/i, 'Site Work'],
  [/landscap|sod|planting/i, 'Landscape Repairs'], [/fenc/i, 'Permanent Fencing'], [/equipment (set|install)|rtu|ahu|panel/i, 'MEP Equipment Installation (Panels / HVAC Units)'],
  [/low voltage|cabling|data/i, 'Fire Alarm & Low Voltage Prewiring'], [/sprinkler/i, 'Fire Suppression Main Lines & Branch Pipe Rough'],
];
const backboneByName = new Map(backbone.map(b => [b.name, b]));

// Monotonic alignment: a seat's base sequence can only move forward through the
// backbone, and only within a window, so one loose name match cannot teleport an
// anchor to the far end of the job.
function mapToBackbone(name, floor = 0, window = 14) {
  if (!name) return null;
  const exact = backboneByName.get(name); if (exact && exact.order >= floor) return exact;
  const inRange = b => b.order >= floor && b.order <= floor + window;
  let best = null; let bs = 0;
  for (const b of backbone) { if (!inRange(b)) continue; const s = sim(name, b.name); if (s > bs) { bs = s; best = b; } }
  if (bs >= 0.6) return best;
  for (const [re, target] of ALIAS) {
    const b = backboneByName.get(target);
    if (re.test(name) && b && inRange(b)) return b;
  }
  return null;
}

// Per seat: base name -> backbone anchor, walking forward through the seat's own base order.
const anchorMaps = seats.map(seat => {
  const base = seat.rows.filter(r => r.module === 'base').sort((a, b) => a.seq - b.seq);
  const m = new Map(); let last = backbone[0];
  for (const r of base) {
    const recurring = /recurring|monthly|weekly|daily/i.test(r.task);
    const phaseFloor = backbone.find(b => b.phase === r.phase)?.order ?? 0;
    const floor = Math.max(last.order, phaseFloor);
    const hit = recurring ? null : mapToBackbone(r.task, floor);
    if (hit) last = hit;
    else if (phaseFloor > last.order) last = backbone[phaseFloor];
    m.set(r.task, last);
  }
  return m;
});
function anchorFor(row) {
  const raw = row.insert_after.replace(/^(after|before):/i, '').trim();
  const before = /^before:/i.test(row.insert_after);
  let a = anchorMaps[row.seat].get(raw) || mapToBackbone(raw);
  if (a && before && a.order > 0) a = backbone[a.order - 1];
  return a;
}

function cluster(rows) {
  const clusters = [];
  for (const r of rows.sort((a, b) => a.seat - b.seat || a.seq - b.seq)) {
    let best = null; let bs = 0;
    for (const c of clusters) {
      if (c.members.some(m => m.seat === r.seat)) continue;
      const s = Math.max(...c.members.map(m => sim(m.task, r.task)));
      if (s > bs) { bs = s; best = c; }
    }
    if (best && bs >= 0.5) best.members.push(r); else clusters.push({ members: [r] });
  }
  return clusters;
}

const PARALLEL_RE = /recurring|daily|monitor|log\b|training|submittal|shop drawing|procure|order|fabricat|lead time|permit|registration|notif|coordinat|plan approv|meeting/i;
const preferred = c => [...c.members].sort((a, b) => b.seat - a.seat)[0];

const modules = [...new Set(seats.flatMap(s => s.rows.map(r => r.module)))].filter(m => m !== 'base');
const MODULE_TASKS = {}; const candidates = {}; const moduleSeatCount = {};
for (const mod of modules) {
  const rows = seats.flatMap(s => s.rows.filter(r => r.module === mod));
  moduleSeatCount[mod] = new Set(rows.map(r => r.seat)).size;
  const cs = cluster(rows);
  const consensus = cs.filter(c => new Set(c.members.map(m => m.seat)).size >= 2);
  MODULE_TASKS[mod] = consensus.map(c => {
    const p = preferred(c);
    const anchors = c.members.map(anchorFor).filter(Boolean).sort((a, b) => a.order - b.order);
    const anchor = anchors[Math.floor((anchors.length - 1) / 2)];
    return {
      name: p.task,
      duration: median(c.members.map(m => m.duration_days)),
      trade: majority(c.members.map(m => m.trade)),
      cls: majority(c.members.map(m => m.class)),
      csi: majority(c.members.map(m => m.csi)),
      hasSubmittal: majority(c.members.map(m => m.submittal_or_lead)) === 'Y',
      leadDays: median(c.members.map(m => m.lead_days)),
      phase: anchor?.phase || majority(c.members.map(m => m.phase)),
      milestone: majority(c.members.map(m => m.milestone)) === 'Y',
      after: anchor?.name || null,
      parallel: PARALLEL_RE.test(p.task),
      _order: anchor?.order ?? 999, _seq: median(c.members.map(m => m.seq)),
      council: { seats: new Set(c.members.map(m => m.seat)).size, names: c.members.map(m => m.task) },
    };
  }).sort((a, b) => a._order - b._order || a._seq - b._seq).map(({ _order, _seq, ...r }) => r);
  candidates[mod] = cs.filter(c => new Set(c.members.map(m => m.seat)).size < 2).map(c => c.members[0].task);
}

// Versioned, individually removable anchor overrides (knowledge/council/anchor-overrides.json).
const overridePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../knowledge/council/anchor-overrides.json');
const overrideLog = [];
if (fs.existsSync(overridePath)) {
  const { overrides = [] } = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
  for (const o of overrides) {
    const row = (MODULE_TASKS[o.module] || []).find(r => r.name.toLowerCase().includes(o.match.toLowerCase()));
    if (!row) { overrideLog.push(`UNMATCHED ${o.module}: ${o.match}`); continue; }
    if (!backboneByName.has(o.after)) { overrideLog.push(`BAD ANCHOR ${o.module}: ${o.after}`); continue; }
    overrideLog.push(`${o.module}: "${row.name}" after ${row.after} -> ${o.after}`);
    row.after = o.after;
    if (o.parallel !== undefined) row.parallel = o.parallel;
    row.phase = o.phase || backboneByName.get(o.after).phase;
    row.override = true;
    row._ord = o.order ?? 0;
  }
  for (const mod of Object.keys(MODULE_TASKS)) {
    MODULE_TASKS[mod] = MODULE_TASKS[mod]
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (backboneByName.get(a.r.after)?.order ?? 999) - (backboneByName.get(b.r.after)?.order ?? 999) || (a.r._ord ?? 0) - (b.r._ord ?? 0) || a.i - b.i)
      .map(({ r }) => { const { _ord, ...rest } = r; return rest; });
  }
}

// Base library: consensus line items used to classify any input line item.
const baseClusters = cluster(seats.flatMap(s => s.rows.filter(r => r.module === 'base')));
const LIBRARY = baseClusters.filter(c => new Set(c.members.map(m => m.seat)).size >= 2).map(c => {
  const p = preferred(c);
  return {
    name: p.task, cls: majority(c.members.map(m => m.class)), trade: majority(c.members.map(m => m.trade)),
    csi: majority(c.members.map(m => m.csi)), hasSubmittal: majority(c.members.map(m => m.submittal_or_lead)) === 'Y',
    leadDays: median(c.members.map(m => m.lead_days)), phase: majority(c.members.map(m => m.phase)),
    milestone: majority(c.members.map(m => m.milestone)) === 'Y', duration: median(c.members.map(m => m.duration_days)),
    seats: new Set(c.members.map(m => m.seat)).size, aliases: [...new Set(c.members.map(m => m.task))],
  };
}).sort((a, b) => ['preconstruction', 'construction', 'closeout'].indexOf(a.phase) - ['preconstruction', 'construction', 'closeout'].indexOf(b.phase));
const baseCandidates = baseClusters.filter(c => c.members.length < 2).map(c => c.members[0].task);

const gateKeywords = {};
for (const mod of modules) {
  const kws = seats.flatMap(s => s.rows.filter(r => r.module === mod).flatMap(r => r.gate_keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)));
  const c = {}; for (const k of kws) c[k] = (c[k] || 0) + 1;
  gateKeywords[mod] = Object.entries(c).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 25);
}

const stamp = new Date().toISOString().slice(0, 10);
const header = `// GENERATED by skills/bidforge-schedules/scripts/council_merge.mjs on ${stamp}.\n// Three-seat council consensus (>= 2 of 3 seats). Do not hand-edit; re-run the merge.\n`;
const consensusModules = modules.filter(m => moduleSeatCount[m] >= 2);
const mt = Object.fromEntries(consensusModules.map(m => [m, MODULE_TASKS[m]]));
fs.writeFileSync(path.join(outDir, 'jevModuleTasks.js'), `${header}export const MODULE_TASKS = ${JSON.stringify(mt, null, 2)};\n\nexport const COUNCIL_GATE_KEYWORDS = ${JSON.stringify(Object.fromEntries(consensusModules.map(m => [m, gateKeywords[m]])), null, 2)};\n`);
fs.writeFileSync(path.join(outDir, 'jevLibrary.js'), `${header}export const JEV_LIBRARY = ${JSON.stringify(LIBRARY, null, 2)};\n`);

const lines = [`# Council merge report — ${stamp}`, '', `Seats: ${seats.map((s, i) => `${i + 1}=${s.file} (${s.rows.length} rows)`).join(', ')}`, '',
  `Base library: ${LIBRARY.length} consensus line items; ${baseCandidates.length} single-seat candidates.`, '', '## Modules', '',
  '| Module | Seats proposing module | Consensus tasks | Single-seat candidates | Unanchored |', '|---|---|---|---|---|',
  ...modules.map(m => `| ${m} | ${moduleSeatCount[m]}/3 | ${moduleSeatCount[m] >= 2 ? MODULE_TASKS[m].length : '— (not adopted)'} | ${candidates[m].length} | ${MODULE_TASKS[m].filter(r => !r.after).length} |`),
  '', '## Anchor overrides applied', '', ...(overrideLog.length ? overrideLog.map(l => `- ${l}`) : ['- none']),
  '', '## Single-seat candidates (surface to council / user; not in the tree)', '',
  ...modules.filter(m => candidates[m].length).map(m => `- **${m}**: ${candidates[m].join('; ')}`),
  `- **base**: ${baseCandidates.join('; ')}`,
  '', '## Seat notes (verbatim)', '', ...seats.flatMap((s, i) => [`### Seat ${i + 1}`, ...s.notes.map(n => `- ${n}`), ''])];
fs.writeFileSync(reportPath, lines.join('\n'));
console.log(`modules adopted: ${consensusModules.length}/${modules.length}; module tasks: ${Object.values(mt).flat().length}; library: ${LIBRARY.length}`);
