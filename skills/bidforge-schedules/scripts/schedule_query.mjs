#!/usr/bin/env node
// Deterministic read-only query CLI over the canonical schedule (bidforge.canonical.v1).
// Other tools, skills and agents call this instead of re-deriving schedule facts.
//
// usage: node schedule_query.mjs <canonical.json> <command> [args] [--json]
//          [--today YYYY-MM-DD] [--activity activity_stream.json] [--max-age-hours 24] [--now ISO]
// commands:
//   summary                 project, version, SC forecast vs contract, % complete, critical, last sync, pending
//   lookahead [weeks=3]     tasks active/starting in the window, grouped by week, critical flagged
//   milestones              all milestones with forecast, contract date and variance
//   critical                open critical-path tasks
//   task <id|name substr>   task detail(s)
//   late                    endDate < today and < 100 %, or milestone variance > 0
//   changes [since ISO]     changelog entries with sources + links (default: last 30 days)
//   activity [n=20]         meta.activity, or the KB activity_stream.json given with --activity
//   oac                     ready-to-paste OAC schedule section; exit 3 if the OAC gate fails
// Exit codes: 0 ok, 1 usage / unreadable input, 3 OAC gate failed.
import fs from 'node:fs';
import {
  loadCanonical, view, scInfo, percentComplete, pct, real, variance, pendingItems, isOpen, rating,
  publishedVersion, lastSync, lastOac, entrySources, checkGate, GATE_INSTRUCTION, addDays, mondayOf, isoDate,
} from './lib/canonical_read.mjs';

const VALUE_FLAGS = ['--today', '--activity', '--max-age-hours', '--now'];
const argv = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.includes(a)) flags[a.slice(2)] = argv[++i];
  else if (a.startsWith('--')) flags[a.slice(2)] = true;
  else pos.push(a);
}
const [path, cmd = 'summary', ...rest] = pos;
const USAGE = 'usage: schedule_query.mjs <canonical.json> <summary|lookahead [weeks]|milestones|critical|task <q>|late|changes [since]|activity [n]|oac> [--json] [--today YYYY-MM-DD] [--activity file]';
if (!path) { console.error(USAGE); process.exit(1); }

let v;
try { v = view(loadCanonical(path)); } catch (e) { console.error(`schedule_query: cannot read ${path}: ${e.message}`); process.exit(1); }
const today = flags.today || isoDate(Date.now());
const asJson = !!flags.json;
const now = flags.now ? new Date(flags.now) : new Date();

// ── helpers ────────────────────────────────────────────────────────
const fmtTask = t => ({
  id: t.id, name: t.name, phase: t.phaseName, trade: t.trade || '', startDate: t.startDate || null, endDate: t.endDate || null,
  duration: t.duration ?? null, percentComplete: pct(t), isCritical: !!t.isCritical, isMilestone: !!t.isMilestone,
  float: t.float ?? null, contractDate: t.contractDate || null, variance: variance(t),
});
const flag = t => `${t.isCritical ? ' **[CP]**' : ''}${t.isMilestone ? ' ◆' : ''}`;
const sign = n => (n == null ? 'n/a' : n > 0 ? `+${n}` : `${n}`);
const open = t => real(t) && pct(t) < 100;
const pendingOpen = () => pendingItems(v).filter(isOpen);

function summary() {
  const sc = scInfo(v);
  const pend = pendingOpen();
  return {
    project: v.name, slug: v.slug, version: v.version, publishedVersion: publishedVersion(v), asOf: today,
    start: v.project.startDate || null, finish: v.tasks.map(t => t.endDate).filter(Boolean).sort().pop() || null,
    substantialCompletion: { forecast: sc.forecast, contract: sc.contract, varianceDays: sc.varianceDays, task: sc.task ? sc.task.id : null },
    percentComplete: percentComplete(v),
    tasks: v.tasks.filter(real).length,
    criticalOpen: v.tasks.filter(t => open(t) && t.isCritical).length,
    late: late().length,
    lastSync: lastSync(v), lastJobtreadPullAt: v.sync.lastJobtreadPullAt || null,
    pending: { total: pend.length, rating4plus: pend.filter(i => rating(i) >= 4).length },
    lastChange: v.changelog.length ? { id: v.changelog[v.changelog.length - 1].id, at: v.changelog[v.changelog.length - 1].at } : null,
    links: v.links,
  };
}

function lookahead(weeks = 3) {
  const w = Math.max(1, Math.min(26, Number(weeks) || 3));
  const start = mondayOf(today);
  const out = [];
  for (let i = 0; i < w; i++) {
    const ws = addDays(start, i * 7), we = addDays(ws, 6);
    const items = v.tasks.filter(t => open(t) && t.startDate && t.endDate && t.startDate <= we && t.endDate >= ws)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || String(a.id).localeCompare(String(b.id)))
      .map(t => ({ ...fmtTask(t), status: t.startDate >= ws ? 'starts' : 'continues' }));
    out.push({ week: i + 1, from: ws, to: we, tasks: items });
  }
  return { asOf: today, weeks: w, window: { from: start, to: addDays(start, w * 7 - 1) }, byWeek: out };
}

const milestones = () => v.tasks.filter(t => real(t) && t.isMilestone).map(fmtTask)
  .sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
const critical = () => v.tasks.filter(t => open(t) && t.isCritical).map(fmtTask)
  .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

function late() {
  return v.tasks.filter(real).filter(t => (t.endDate && t.endDate < today && pct(t) < 100) || (variance(t) ?? 0) > 0)
    .map(t => ({ ...fmtTask(t), reason: (variance(t) ?? 0) > 0 ? `milestone variance +${variance(t)} cd vs contract ${t.contractDate}` : `finish ${t.endDate} passed at ${pct(t)} %` }));
}

function task(q) {
  if (!q) return [];
  const ql = String(q).toLowerCase();
  const exact = v.tasks.filter(t => String(t.id).toLowerCase() === ql || String(t.wbsCode || '').toLowerCase() === ql);
  const hits = exact.length ? exact : v.tasks.filter(t => String(t.name || '').toLowerCase().includes(ql));
  const byId = new Map(v.tasks.map(t => [t.id, t]));
  return hits.slice(0, 25).map(t => ({
    ...fmtTask(t), actualStart: t.actualStart || null, actualFinish: t.actualFinish || null, csi: t.csi || '', sub: t.sub || '',
    predecessors: (t.predecessors || []).map(id => ({ id, name: byId.get(id)?.name || '' })),
    successors: v.tasks.filter(x => (x.predecessors || []).includes(t.id)).map(x => ({ id: x.id, name: x.name })),
    notes: t.notes || '', jobTreadTaskId: t.jobTreadTaskId || null, isReference: !!t.isReference,
  }));
}

function changes(since) {
  const from = since || addDays(today, -30);
  return v.changelog.filter(e => e && (!e.at || e.at >= from)).map(e => ({
    id: e.id || '', at: e.at || '', type: e.type || '', target: e.target || '', reason: e.reason || '', actor: e.actor || '',
    jevRating: e.jevRating ?? null, sources: entrySources(e),
  })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function activity(n = 20) {
  let list = v.activity;
  if (flags.activity) {
    try {
      const raw = JSON.parse(fs.readFileSync(flags.activity, 'utf8'));
      list = Array.isArray(raw) ? raw : raw.events || raw.activity || raw.items || [];
    } catch (e) { console.error(`schedule_query: cannot read --activity ${flags.activity}: ${e.message}`); process.exit(1); }
  }
  return [...list].filter(Boolean).sort((a, b) => String(b.ts || b.at || '').localeCompare(String(a.ts || a.at || ''))).slice(0, Math.max(1, Number(n) || 20));
}

function oac() {
  const gate = checkGate(v, { maxAgeHours: Number(flags['max-age-hours'] ?? 24), now });
  if (!gate.pass) return { gate };
  const since = lastOac(v, today) || addDays(today, -14);
  return { gate, summary: summary(), lookahead: lookahead(3), critical: critical(), late: late(), changesSince: since, changes: changes(since) };
}

// ── markdown renderers ─────────────────────────────────────────────
const L = [];
const p = s => L.push(s);
const srcMd = ss => ss.map(s => (s.link ? `[${s.type}: ${s.title || s.link}](${s.link})` : `${s.type}: ${s.title}`)).join('; ') || '—';
const row = t => `| ${t.id} | ${t.name}${flag(t)} | ${t.startDate || ''} | ${t.endDate || ''} | ${t.percentComplete}% |`;
const tbl = ts => { p('| ID | Task | Start | Finish | % |'); p('|---|---|---|---|---|'); ts.forEach(t => p(row(t))); };

function mdSummary(s) {
  p(`## Schedule summary — ${s.project}`);
  p(`- **Version:** v${s.version}${s.publishedVersion != null ? ` (published v${s.publishedVersion})` : ' (not published)'} · as of ${s.asOf}`);
  p(`- **Substantial completion:** forecast ${s.substantialCompletion.forecast || 'n/a'} · contract ${s.substantialCompletion.contract || 'n/a'} · variance ${sign(s.substantialCompletion.varianceDays)} cd`);
  p(`- **Percent complete:** ${s.percentComplete}% (duration-weighted, ${s.tasks} tasks)`);
  p(`- **Critical open:** ${s.criticalOpen} · **Late:** ${s.late}`);
  p(`- **Last sync:** ${s.lastSync || 'never'}${s.lastJobtreadPullAt ? ` · JobTread pull ${s.lastJobtreadPullAt}` : ''}`);
  p(`- **Pending items:** ${s.pending.total} (${s.pending.rating4plus} rated JEV ≥ 4)`);
  if (s.lastChange) p(`- **Last change:** ${s.lastChange.id} at ${s.lastChange.at}`);
  if (s.links.hostUrl) p(`- **Hosted:** ${s.links.hostUrl}`);
}
function mdLookahead(r) {
  p(`## ${r.weeks}-week look-ahead (${r.window.from} → ${r.window.to})`);
  for (const w of r.byWeek) {
    p(`### Week ${w.week}: ${w.from} – ${w.to}`);
    if (!w.tasks.length) { p('_No open work scheduled._'); continue; }
    w.tasks.forEach(t => p(`- ${t.id} ${t.name}${flag(t)} — ${t.startDate} → ${t.endDate} (${t.status}, ${t.percentComplete}%)`));
  }
}
function mdMilestones(ms) {
  p('## Milestones');
  if (!ms.length) return p('_No milestones._');
  p('| ID | Milestone | Forecast | Contract | Var (cd) | % |'); p('|---|---|---|---|---|---|');
  ms.forEach(t => p(`| ${t.id} | ${t.name}${t.isCritical ? ' **[CP]**' : ''} | ${t.endDate || ''} | ${t.contractDate || '—'} | ${t.variance == null ? '—' : sign(t.variance)} | ${t.percentComplete}% |`));
}
function mdChanges(cs, title) {
  p(title);
  if (!cs.length) return p('_No changes._');
  cs.forEach(c => p(`- **${c.id}** ${String(c.at).slice(0, 10)} · ${c.type}${c.jevRating != null ? ` · JEV ${c.jevRating}` : ''}${c.target ? ` · ${c.target}` : ''} — ${c.reason || ''} · Sources: ${srcMd(c.sources)}`));
}

function render(result) {
  switch (cmd) {
    case 'summary': mdSummary(result); break;
    case 'lookahead': mdLookahead(result); break;
    case 'milestones': mdMilestones(result); break;
    case 'critical': p('## Critical path (open)'); result.length ? tbl(result) : p('_No open critical tasks._'); break;
    case 'late': p(`## Late items (as of ${today})`); result.length ? result.forEach(t => p(`- ${t.id} ${t.name}${flag(t)} — ${t.reason}`)) : p('_Nothing late._'); break;
    case 'task':
      if (!result.length) { p(`_No task matches "${rest.join(' ')}"._`); break; }
      for (const t of result) {
        p(`### ${t.id} ${t.name}${flag(t)}`);
        p(`- Phase: ${t.phase} · Trade: ${t.trade} · CSI ${t.csi || '—'} · ${t.sub || ''}`);
        p(`- Plan: ${t.startDate} → ${t.endDate} (${t.duration} WD) · Float ${t.float ?? 'n/a'} · ${t.percentComplete}%`);
        if (t.actualStart || t.actualFinish) p(`- Actual: ${t.actualStart || '—'} → ${t.actualFinish || '—'}`);
        if (t.contractDate) p(`- Contract date ${t.contractDate} · variance ${sign(t.variance)} cd`);
        p(`- Predecessors: ${t.predecessors.map(x => `${x.id} ${x.name}`).join('; ') || '—'}`);
        p(`- Successors: ${t.successors.map(x => `${x.id} ${x.name}`).join('; ') || '—'}`);
        if (t.notes) p(`- Notes: ${t.notes}`);
      }
      break;
    case 'changes': mdChanges(result, `## Schedule changes since ${rest[0] || addDays(today, -30)}`); break;
    case 'activity':
      p('## Activity stream');
      result.length ? result.forEach(a => p(`- ${a.ts || a.at || ''} · ${a.source || ''}/${a.kind || ''} — ${a.text || a.summary || ''}${a.link ? ` ([link](${a.link}))` : ''}`)) : p('_No activity._');
      break;
    case 'oac': {
      const s = result.summary;
      p(`## Schedule update — ${s.project}`);
      p(`**Schedule version:** v${s.version} (published) · data date ${today} · last sync ${s.lastSync}`);
      p(`**Substantial completion:** forecast ${s.substantialCompletion.forecast || 'n/a'} vs contract ${s.substantialCompletion.contract || 'n/a'} — variance ${sign(s.substantialCompletion.varianceDays)} calendar days`);
      p(`**Overall progress:** ${s.percentComplete}% complete · ${s.criticalOpen} open critical activities · ${result.late.length} late`);
      p('');
      L.push(...captureMd(() => mdLookahead(result.lookahead)).map(x => x.replace(/^## /, '### ').replace(/^### Week/, '#### Week')));
      p(''); p('### Critical items');
      result.critical.length ? result.critical.slice(0, 15).forEach(t => p(`- ${t.id} ${t.name} — ${t.startDate} → ${t.endDate} (${t.percentComplete}%)`)) : p('_None open._');
      if (result.critical.length > 15) p(`- … ${result.critical.length - 15} more (schedule_query critical)`);
      p(''); p('### Late items');
      result.late.length ? result.late.forEach(t => p(`- ${t.id} ${t.name} — ${t.reason}`)) : p('_Nothing late._');
      p('');
      L.push(...captureMd(() => mdChanges(result.changes, `### Changes since last OAC (${String(result.changesSince).slice(0, 10)})`)));
      p(''); p(`_Source: canonical schedule v${s.version}${s.links.hostUrl ? ` · ${s.links.hostUrl}` : ''}_`);
      break;
    }
    default: break;
  }
}
function captureMd(fn) { const start = L.length; fn(); return L.splice(start); }

// ── dispatch ───────────────────────────────────────────────────────
const COMMANDS = {
  summary: () => summary(), lookahead: () => lookahead(rest[0]), milestones, critical, late,
  task: () => task(rest.join(' ')), changes: () => changes(rest[0]), activity: () => activity(rest[0]), oac,
};
if (!COMMANDS[cmd]) { console.error(`schedule_query: unknown command "${cmd}"\n${USAGE}`); process.exit(1); }
const result = COMMANDS[cmd]();

if (cmd === 'oac' && !result.gate.pass) {
  const instruction = GATE_INSTRUCTION(v.slug);
  if (asJson) process.stdout.write(JSON.stringify({ error: 'oac_gate_failed', ...result.gate, instruction }, null, 2) + '\n');
  else { console.log('OAC gate FAIL — schedule must be updated before the OAC report:'); result.gate.reasons.forEach(r => console.log(`  - ${r}`)); console.log(instruction); }
  process.exit(3);
}
if (asJson) process.stdout.write(JSON.stringify({ command: cmd, project: v.name, version: v.version, asOf: today, result }, null, 2) + '\n');
else { render(result); process.stdout.write(L.join('\n') + '\n'); }
