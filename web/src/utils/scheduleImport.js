// Import an existing schedule (MS Project MSPDI XML or CSV) into canonical WBS form,
// so an uploaded schedule becomes the starting canonical instead of a fresh build.
//
// Council audit #3 (A-25): actual dates (MSPDI ActualStart/ActualFinish, CSV "Actual Start" /
// "Actual Finish" / "% Complete"), start-no-earlier-than constraints (MSPDI ConstraintType 4 +
// ConstraintDate) and links on summary tasks (re-pointed: summary as successor → its first
// child, summary as predecessor → its last child) are kept instead of dropped.

import { toISODate } from './dateUtils.js';
import { findDependencyCycles } from './scheduler.js';

const TYPE = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' };
const PHASE_KEY = name => (/precon|pre-con|procure|submittal|design|permit/i.test(name) ? 'preconstruction'
  : /close|punch|turnover|warranty/i.test(name) ? 'closeout' : 'construction');
const hoursOf = d => { const m = String(d || '').match(/PT(\d+)H(\d+)M/); return m ? Number(m[1]) + Number(m[2]) / 60 : 0; };
const dateOf = s => (s ? toISODate(String(s)) : null);
const SNET = '4'; // MSPDI ConstraintType 4 = Start No Earlier Than

// Minimal element reader: DOMParser in the browser, a tag scanner elsewhere (node scripts/tests).
function readTasks(xml) {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Not a readable MS Project XML file');
    const txt = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent ?? '';
    return {
      project: tag => txt(doc.documentElement, tag),
      tasks: [...doc.getElementsByTagName('Task')].map(t => ({
        get: tag => txt(t, tag),
        links: [...t.getElementsByTagName('PredecessorLink')].map(l => tag => txt(l, tag)),
      })),
    };
  }
  if (!/<Project[\s>]/.test(xml)) throw new Error('Not a readable MS Project XML file');
  const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const first = (block, tag) => { const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? decode(m[1].trim()) : ''; };
  const strip = (block, tag) => block.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), '');
  const tasksBlock = (xml.match(/<Tasks>([\s\S]*?)<\/Tasks>/) || [])[1] || '';
  const head = strip(xml, 'Tasks').replace(/<Resources>[\s\S]*?<\/Resources>|<Assignments>[\s\S]*?<\/Assignments>|<Calendars>[\s\S]*?<\/Calendars>/g, '');
  return {
    project: tag => first(head, tag),
    tasks: (tasksBlock.match(/<Task>[\s\S]*?<\/Task>/g) || []).map(block => {
      const links = (block.match(/<PredecessorLink>[\s\S]*?<\/PredecessorLink>/g) || []).map(l => tag => first(l, tag));
      const own = ['PredecessorLink', 'Baseline', 'ExtendedAttribute', 'TimephasedData'].reduce(strip, block);
      return { get: tag => first(own, tag), links };
    }),
  };
}

export function parseMSPDI(xml) {
  const { project, tasks } = readTasks(xml);
  const hpd = Number(project('MinutesPerDay')) / 60 || 8;
  const name = project('Title') || project('Name').replace(/\.xml$|\.mpp$/i, '');
  const rows = tasks.map(t => {
    const pct = Number(t.get('PercentComplete')) || 0;
    const start = dateOf(t.get('Start'));
    const finish = dateOf(t.get('Finish'));
    const ctype = t.get('ConstraintType');
    return {
      uid: t.get('UID'), name: t.get('Name'), level: Number(t.get('OutlineLevel')) || 1,
      summary: t.get('Summary') === '1', milestone: t.get('Milestone') === '1',
      start, finish, hours: hoursOf(t.get('Duration')), pct,
      actualStart: dateOf(t.get('ActualStart')) || (pct > 0 ? start : null),
      actualFinish: dateOf(t.get('ActualFinish')) || (pct >= 100 ? finish : null),
      constraintStart: ctype === SNET ? dateOf(t.get('ConstraintDate')) : null,
      preds: t.links.map(l => ({ uid: l('PredecessorUID'), type: TYPE[l('Type')] || 'FS', lag: Math.round((Number(l('LinkLag')) || 0) / (hpd * 600)) })),
    };
  }).filter(r => r.name && r.uid !== '0');
  return toWbs(name, rows, hpd);
}

// CSV with a header row: Name, Duration (days), Start, Finish, Predecessors (row numbers), Phase,
// and optionally Actual Start, Actual Finish, % Complete.
export function parseScheduleCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const split = l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  const head = split(lines.shift() || '').map(h => h.toLowerCase());
  const col = (re, not) => head.findIndex(h => re.test(h) && !(not && not.test(h)));
  const c = {
    name: col(/name|task|activity/), dur: col(/dur/),
    start: col(/start/, /actual|baseline/), finish: col(/finish|end/, /actual|baseline/),
    aStart: col(/actual.*start/), aFinish: col(/actual.*(finish|end)/), pct: col(/%|percent|complete/),
    pred: col(/pred/), phase: col(/phase|wbs|group/),
  };
  if (c.name < 0) throw new Error('CSV needs a Name / Task column');
  const rows = [];
  let phase = null;
  lines.forEach((l, i) => {
    const v = split(l);
    if (!v[c.name]) return;
    const ph = c.phase >= 0 ? v[c.phase] : null;
    if (ph && ph !== phase) { phase = ph; rows.push({ uid: `p${i}`, name: ph, level: 1, summary: true }); }
    const pct = c.pct >= 0 ? parseFloat(String(v[c.pct] || '').replace('%', '')) || 0 : 0;
    const start = c.start >= 0 ? normDate(v[c.start]) : null;
    const finish = c.finish >= 0 ? normDate(v[c.finish]) : null;
    rows.push({
      uid: String(i + 1), name: v[c.name], level: ph ? 2 : 1, summary: false,
      start, finish, pct,
      actualStart: (c.aStart >= 0 ? normDate(v[c.aStart]) : null) || (pct > 0 && c.aStart < 0 ? start : null),
      actualFinish: (c.aFinish >= 0 ? normDate(v[c.aFinish]) : null) || (pct >= 100 && c.aFinish < 0 ? finish : null),
      hours: (c.dur >= 0 ? parseFloat(v[c.dur]) || 1 : 1) * 8, milestone: c.dur >= 0 && parseFloat(v[c.dur]) === 0,
      preds: c.pred >= 0 ? String(v[c.pred] || '').split(/[;,\s]+/).filter(Boolean).map(p => ({ uid: p.replace(/\D.*$/, ''), type: (p.match(/FS|SS|FF|SF/i) || ['FS'])[0].toUpperCase(), lag: Number((p.match(/[+-]\s*\d+/) || ['0'])[0].replace(/\s/g, '')) || 0 })) : [],
    });
  });
  return toWbs('', rows, 8);
}

function normDate(s) {
  if (!s) return null;
  const direct = toISODate(String(s).trim());
  if (direct) return direct;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return toISODate(`${m[1]}/${m[2]}/${m[3]}`);
  const iso = String(s).match(/\d{4}-\d{2}-\d{2}/);
  return iso ? toISODate(iso[0]) : null;
}

// For every summary row: the first and last leaf rows beneath it (outline order).
function summarySpans(rows) {
  const spans = new Map();
  rows.forEach((r, i) => {
    if (!r.summary) return;
    let firstLeaf = null;
    let lastLeaf = null;
    for (let j = i + 1; j < rows.length && (rows[j].level || 1) > (r.level || 1); j++) {
      if (rows[j].summary) continue;
      if (!firstLeaf) firstLeaf = rows[j].uid;
      lastLeaf = rows[j].uid;
    }
    spans.set(r.uid, { first: firstLeaf, last: lastLeaf });
  });
  return spans;
}

function toWbs(name, rows, hpd) {
  const wbs = [];
  let phase = null;
  let sub = '';
  const idOf = new Map();
  const spans = summarySpans(rows);
  // Links on a summary row: as successor → its first child takes the predecessors.
  const extraPreds = new Map();
  for (const r of rows) {
    if (!r.summary || !(r.preds || []).length) continue;
    const first = spans.get(r.uid)?.first;
    if (!first) continue;
    if (!extraPreds.has(first)) extraPreds.set(first, []);
    extraPreds.get(first).push(...r.preds);
  }
  for (const r of rows) {
    if (r.summary && r.level === 1) {
      phase = { id: String(wbs.length + 1), type: 'phase', name: r.name, wbsCode: String(wbs.length + 1), phaseKey: PHASE_KEY(r.name), children: [] };
      wbs.push(phase); sub = ''; continue;
    }
    if (r.summary) { sub = r.name; continue; }
    if (!phase) { phase = { id: '1', type: 'phase', name: 'Construction', wbsCode: '1', phaseKey: 'construction', children: [] }; wbs.push(phase); }
    const id = `${phase.id}.${phase.children.length + 1}`;
    idOf.set(r.uid, id);
    const duration = r.milestone ? 0 : Math.max(1, Math.round(r.hours / hpd));
    const task = {
      id, type: 'task', name: r.name, wbsCode: id, duration, durationUnit: 'days', sub, category: 'activity',
      isMilestone: !!r.milestone || duration === 0, percentComplete: r.pct || 0, importedStart: r.start, importedFinish: r.finish,
      predecessors: [], successors: [], isCritical: false, notes: '', children: [], source: 'import',
      _preds: [...(r.preds || []), ...(extraPreds.get(r.uid) || [])],
    };
    if (r.actualStart) task.actualStart = r.actualStart;
    if (r.actualFinish) task.actualFinish = r.actualFinish;
    if (r.constraintStart) task.constraintStart = r.constraintStart;
    phase.children.push(task);
  }
  // A link whose predecessor is a summary row comes from that summary's last child.
  const resolveFrom = uid => idOf.get(uid) || idOf.get(spans.get(uid)?.last);
  const dependencies = [];
  const all = wbs.flatMap(p => p.children);
  for (const t of all) {
    for (const p of t._preds) {
      const from = resolveFrom(p.uid);
      if (!from || from === t.id || t.predecessors.includes(from)) continue;
      t.predecessors.push(from);
      dependencies.push({ from, to: t.id, type: p.type, lag: p.lag, lagUnit: 'days', source: 'import' });
    }
    delete t._preds;
  }
  // Tasks with no logic keep their imported start as a start-no-earlier-than constraint.
  for (const t of all) if (!t.predecessors.length && t.importedStart && !t.constraintStart && !t.actualStart) t.constraintStart = t.importedStart;
  const starts = all.map(t => t.actualStart || t.importedStart).filter(Boolean).sort();
  const cycles = findDependencyCycles(all, dependencies);
  return {
    name, startDate: starts[0] || null, wbs, dependencies, taskCount: all.length, linkCount: dependencies.length,
    ...(cycles.length ? { cycles } : {}),
  };
}
