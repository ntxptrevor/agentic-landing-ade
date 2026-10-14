// Import an existing schedule (MS Project MSPDI XML or CSV) into canonical WBS form,
// so an uploaded schedule becomes the starting canonical instead of a fresh build.

const TYPE = { 0: 'FF', 1: 'FS', 2: 'SF', 3: 'SS' };
const PHASE_KEY = name => (/precon|pre-con|procure|submittal|design|permit/i.test(name) ? 'preconstruction'
  : /close|punch|turnover|warranty/i.test(name) ? 'closeout' : 'construction');
const hoursOf = d => { const m = String(d || '').match(/PT(\d+)H(\d+)M/); return m ? Number(m[1]) + Number(m[2]) / 60 : 0; };
const dateOf = s => (s ? String(s).slice(0, 10) : null);

export function parseMSPDI(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a readable MS Project XML file');
  const txt = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent ?? '';
  const hpd = Number(txt(doc.documentElement, 'MinutesPerDay')) / 60 || 8;
  const name = txt(doc.documentElement, 'Title') || txt(doc.documentElement, 'Name').replace(/\.xml$|\.mpp$/i, '');
  const rows = [...doc.getElementsByTagName('Task')].map(t => ({
    uid: txt(t, 'UID'), name: txt(t, 'Name'), level: Number(txt(t, 'OutlineLevel')) || 1,
    summary: txt(t, 'Summary') === '1', milestone: txt(t, 'Milestone') === '1',
    start: dateOf(txt(t, 'Start')), finish: dateOf(txt(t, 'Finish')), hours: hoursOf(txt(t, 'Duration')),
    pct: Number(txt(t, 'PercentComplete')) || 0,
    preds: [...t.getElementsByTagName('PredecessorLink')].map(l => ({ uid: txt(l, 'PredecessorUID'), type: TYPE[txt(l, 'Type')] || 'FS', lag: Math.round((Number(txt(l, 'LinkLag')) || 0) / (hpd * 600)) })),
  })).filter(r => r.name && r.uid !== '0');
  return toWbs(name, rows, hpd);
}

// CSV with a header row: Name, Duration (days), Start, Finish, Predecessors (row numbers), Phase.
export function parseScheduleCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const split = l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  const head = split(lines.shift() || '').map(h => h.toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const c = { name: col(/name|task|activity/), dur: col(/dur/), start: col(/start/), finish: col(/finish|end/), pred: col(/pred/), phase: col(/phase|wbs|group/) };
  if (c.name < 0) throw new Error('CSV needs a Name / Task column');
  const rows = [];
  let phase = null;
  lines.forEach((l, i) => {
    const v = split(l);
    if (!v[c.name]) return;
    const ph = c.phase >= 0 ? v[c.phase] : null;
    if (ph && ph !== phase) { phase = ph; rows.push({ uid: `p${i}`, name: ph, level: 1, summary: true }); }
    rows.push({
      uid: String(i + 1), name: v[c.name], level: ph ? 2 : 1, summary: false,
      start: c.start >= 0 ? normDate(v[c.start]) : null, finish: c.finish >= 0 ? normDate(v[c.finish]) : null,
      hours: (c.dur >= 0 ? parseFloat(v[c.dur]) || 1 : 1) * 8, milestone: c.dur >= 0 && parseFloat(v[c.dur]) === 0,
      preds: c.pred >= 0 ? String(v[c.pred] || '').split(/[;,\s]+/).filter(Boolean).map(p => ({ uid: p.replace(/\D.*$/, ''), type: (p.match(/FS|SS|FF|SF/i) || ['FS'])[0].toUpperCase(), lag: 0 })) : [],
    });
  });
  return toWbs('', rows, 8);
}

function normDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const iso = String(s).match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
}

function toWbs(name, rows, hpd) {
  const wbs = [];
  let phase = null;
  let sub = '';
  const idOf = new Map();
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
    phase.children.push({
      id, type: 'task', name: r.name, wbsCode: id, duration, durationUnit: 'days', sub, category: 'activity',
      isMilestone: !!r.milestone || duration === 0, percentComplete: r.pct || 0, importedStart: r.start, importedFinish: r.finish,
      predecessors: [], successors: [], isCritical: false, notes: '', children: [], source: 'import', _preds: r.preds || [],
    });
  }
  const dependencies = [];
  const all = wbs.flatMap(p => p.children);
  for (const t of all) {
    for (const p of t._preds) {
      const from = idOf.get(p.uid);
      if (!from || from === t.id) continue;
      t.predecessors.push(from);
      dependencies.push({ from, to: t.id, type: p.type, lag: p.lag, lagUnit: 'days', source: 'import' });
    }
    delete t._preds;
  }
  // Tasks with no logic keep their imported start as a start-no-earlier-than constraint.
  for (const t of all) if (!t.predecessors.length && t.importedStart) t.constraintStart = t.importedStart;
  const starts = all.map(t => t.importedStart).filter(Boolean).sort();
  return { name, startDate: starts[0] || null, wbs, dependencies, taskCount: all.length, linkCount: dependencies.length };
}
