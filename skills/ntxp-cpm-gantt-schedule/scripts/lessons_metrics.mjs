#!/usr/bin/env node
// Self-learning drift metrics per lesson (council audit #3, A-33 / F-20). Deterministic; no model.
//
//   node lessons_metrics.mjs <canonical.json | dir-of-canonicals> [...] [--lessons knowledge/lessons-learned.md]
//        [--threshold 0.25] [--override-ratio 0.5] [--date YYYY-MM-DD] [--write | --out file.json]
//
// For every lesson in lessons-learned.md (range headings expand to each id) and every task tagged
// `lesson: <id>` in the canonicals:
//   rows / completed           tagged rows, and those with actualStart + actualFinish
//   plannedWd / actualWd       planned duration (baselineDuration → originalDuration → plannedDuration
//                              → duration) vs actual working days (canonical workingDays + holidays)
//   meanVariance               mean (actual − planned) / planned over completed rows
//   inspection                 tagged inspection rows: completed, withinHold (actual ≤ planned), accuracy
//   overrides                  changelog entries that changed a tagged row (duration, resequence,
//                              JobTread manual edit, manual task edits, removal, …) — user overrides
//   councilReview + reasons    |meanVariance| > threshold, overrides / rows > override-ratio, or
//                              inspection accuracy < 1 − threshold
// --write saves knowledge/metrics/<date>.json; otherwise the JSON is printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { view } from './lib/canonical_read.mjs';
import { calendarOf, workdaysBetween } from './lib/jobtread.mjs';
import { parseLessons, statusKind } from './lib/lessons.mjs';

const KNOWLEDGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../knowledge');
const NOT_OVERRIDE = new Set(['actual_dates', 'tracker_update', 'note', 'coda_backup', 'coda_updated', 'schedule_generated', 'sync_item_held', 'memory', 'project_setup', 'links_updated', 'oac_report']);

export function collectCanonicals(paths) {
  const files = [];
  for (const p of paths) {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) if (f.endsWith('.json')) files.push(path.join(p, f));
    } else files.push(p);
  }
  const out = [];
  for (const f of files) {
    try {
      const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (doc && (doc.wbs || doc.project?.wbs)) out.push({ path: f, doc });
    } catch { /* not a canonical */ }
  }
  return out;
}

const planned = t => Number(t.baselineDuration ?? t.originalDuration ?? t.plannedDuration ?? t.duration) || 0;

export function computeMetrics(lessonsMd, canonicals, { threshold = 0.25, overrideRatio = 0.5, date = new Date().toISOString().slice(0, 10) } = {}) {
  const lessons = parseLessons(lessonsMd);
  const byId = new Map();
  const ensure = (id, entry) => {
    if (!byId.has(id)) byId.set(id, { id, entry: entry?.id || null, title: entry?.title || '(not in lessons-learned.md)', status: entry ? statusKind(entry.status) : 'unknown', rows: 0, completed: 0, plannedWd: 0, actualWd: 0, variances: [], inspection: { rows: 0, completed: 0, withinHold: 0 }, overrides: 0, projects: new Set() });
    return byId.get(id);
  };
  for (const l of lessons) for (const id of l.ids) ensure(id, l);
  const docs = [];
  for (const { path: p, doc } of canonicals) {
    const v = view(doc);
    const cal = calendarOf(doc);
    docs.push({ path: p, project: v.name, version: v.version });
    const tagged = v.tasks.filter(t => t.lesson);
    const tagOf = new Map();
    for (const t of tagged) {
      const ids = String(t.lesson).split(/[,\s]+/).filter(Boolean);
      tagOf.set(String(t.id), ids);
      for (const id of ids) {
        const m = ensure(id, lessons.find(l => l.ids.includes(id)));
        m.rows++;
        m.projects.add(v.name);
        const isInsp = /inspect/i.test(t.name || '');
        if (isInsp) m.inspection.rows++;
        if (t.actualStart && t.actualFinish) {
          const plan = planned(t);
          const act = workdaysBetween(t.actualStart, t.actualFinish, cal);
          m.completed++;
          m.plannedWd += plan;
          m.actualWd += act;
          if (plan > 0) m.variances.push((act - plan) / plan);
          if (isInsp) { m.inspection.completed++; if (act <= plan) m.inspection.withinHold++; }
        }
      }
    }
    for (const e of v.changelog) {
      if (!e || NOT_OVERRIDE.has(e.type)) continue;
      const hits = new Set();
      const ref = e.taskId ?? e.target;
      if (ref !== undefined && tagOf.has(String(ref))) tagOf.get(String(ref)).forEach(id => hits.add(id));
      if (Array.isArray(e.after)) for (const a of e.after) { const k = String(a).split(' ')[0]; if (tagOf.has(k)) tagOf.get(k).forEach(id => hits.add(id)); }
      if (e.lesson) String(e.lesson).split(/[,\s]+/).forEach(id => hits.add(id));
      for (const id of hits) ensure(id).overrides++;
    }
  }
  const round = x => Math.round(x * 1000) / 1000;
  const out = [];
  for (const m of byId.values()) {
    const meanVariance = m.variances.length ? round(m.variances.reduce((a, b) => a + b, 0) / m.variances.length) : null;
    const accuracy = m.inspection.completed ? round(m.inspection.withinHold / m.inspection.completed) : null;
    const reasons = [];
    if (meanVariance !== null && Math.abs(meanVariance) > threshold) reasons.push(`mean duration variance ${(meanVariance * 100).toFixed(0)}% exceeds ±${threshold * 100}% (${m.completed} completed row(s))`);
    if (m.rows && m.overrides / m.rows > overrideRatio) reasons.push(`${m.overrides} user override(s) on ${m.rows} tagged row(s)`);
    if (accuracy !== null && accuracy < 1 - threshold) reasons.push(`inspection hold accuracy ${(accuracy * 100).toFixed(0)}%`);
    out.push({ id: m.id, entry: m.entry, title: m.title, status: m.status, projects: m.projects.size, rows: m.rows, completed: m.completed,
      plannedWd: m.plannedWd, actualWd: m.actualWd, meanVariance,
      inspection: { ...m.inspection, accuracy }, overrides: m.overrides,
      councilReview: reasons.length > 0 && m.status !== 'removed', reasons });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return { schema: 'bidforge.lesson-metrics.v1', date, generatedAt: new Date().toISOString(), threshold, overrideRatio, canonicals: docs, lessons: out, flagged: out.filter(l => l.councilReview).map(l => l.id) };
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const VALUED = ['--lessons', '--threshold', '--override-ratio', '--date', '--out'];
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const pos = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
  if (!pos.length) { console.error('usage: lessons_metrics.mjs <canonical.json|dir> [...] [--lessons md] [--threshold 0.25] [--date YYYY-MM-DD] [--write|--out f]'); process.exit(1); }
  try {
    const md = fs.readFileSync(flag('--lessons') || path.join(KNOWLEDGE, 'lessons-learned.md'), 'utf8');
    const date = flag('--date') || new Date().toISOString().slice(0, 10);
    const r = computeMetrics(md, collectCanonicals(pos), { threshold: Number(flag('--threshold') ?? 0.25), overrideRatio: Number(flag('--override-ratio') ?? 0.5), date });
    const text = JSON.stringify(r, null, 2) + '\n';
    const target = args.includes('--write') ? path.join(KNOWLEDGE, 'metrics', `${date}.json`) : flag('--out');
    if (target) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); console.error(`lessons_metrics: wrote ${target}`); }
    else process.stdout.write(text);
    console.error(`lessons_metrics: ${r.canonicals.length} canonical(s), ${r.lessons.length} lesson id(s), flagged for council review: ${r.flagged.join(', ') || 'none'}`);
  } catch (e) { console.error(`lessons_metrics: ${e.message}`); process.exit(1); }
}
