#!/usr/bin/env node
// One-way JobTread -> canonical diff. Emits bidforge.sync.v1 items for MANUAL JobTread edits only.
// usage: node schedule_diff.mjs canonical.json jt_tasks.json [--today YYYY-MM-DD] > items.json
// jt_tasks.json: array of { id, name, startDate, endDate, progress, updatedAt } (Pave job.tasks nodes)
//
// Three-way diff (council audit #3, A-08): JobTread is compared with the dates BidForge last
// PUSHED (canonical sync.jobtreadPushed, written by `jobtread_push.mjs record`), not with the
// current canonical. So:
//   JobTread == pushed                → no item (canonical changes not pushed yet are "push pending")
//   JobTread != pushed, == canonical  → no item (converged)
//   JobTread != pushed, != canonical  → jobtread_manual_edit item
//   no pushed snapshot for a task     → skipped and reported (cannot tell an edit from a stale push)
// Working-day math honors the canonical workingDays + holidays (F-09). A manual edit that moves a
// task EARLIER is rated >= 3 with direction:'earlier' and a note that predecessors may prevent it.
import fs from 'node:fs';
import { calendarOf, workdaysBetween, workdayShift, jtNodes, scheduleTasks, pushedMap, progressOf, jtProgress } from './lib/jobtread.mjs';

export function diffJobtread(canon, rawJt) {
  const jt = jtNodes(rawJt);
  const pushed = pushedMap(canon);
  const cal = calendarOf(canon);
  const tasks = scheduleTasks(canon);
  const byJt = new Map(tasks.filter(t => t.jobTreadTaskId).map(t => [t.jobTreadTaskId, t]));
  const items = [];
  const skipped = [];
  const pushPending = [];
  for (const j of jt) {
    const t = byJt.get(j.id);
    if (!t) {
      items.push({ id: `jt-new-${j.id}`, sourceId: 'jobtread', type: 'note', priority: 2, jevRating: 2, summary: `JobTread task "${j.name}" (${j.startDate}→${j.endDate}) has no canonical match — map or add it`, name: j.name });
      continue;
    }
    const snap = pushed[j.id];
    if (!snap || (!snap.startDate && !snap.endDate)) {
      if (snap && snap.updatedAt && snap.updatedAt === j.updatedAt) continue; // legacy map: our own push
      skipped.push({ jobTreadTaskId: j.id, taskId: t.id, reason: 'no_push_snapshot' });
      continue;
    }
    const prog = jtProgress(j);
    const startEdited = !!j.startDate && j.startDate !== snap.startDate;
    const endEdited = !!j.endDate && j.endDate !== snap.endDate;
    const progRef = typeof snap.progress === 'number' ? snap.progress : progressOf(t);
    const progEdited = prog !== null && prog !== progRef && prog !== progressOf(t);
    if (!startEdited && !endEdited && !progEdited) {
      if ((t.startDate && t.startDate !== snap.startDate) || (t.endDate && t.endDate !== snap.endDate)) pushPending.push(t.id);
      continue;
    }
    const startMoved = startEdited && j.startDate !== t.startDate;
    const endMoved = endEdited && j.endDate !== t.endDate;
    if (!startMoved && !endMoved && !progEdited) continue; // JobTread already matches canonical
    let rating = t.isMilestone || t.protected ? 4 : t.isCritical ? 3 : 2;
    const shift = startMoved ? workdayShift(t.startDate, j.startDate, cal) : 0;
    const direction = startMoved ? (j.startDate < t.startDate ? 'earlier' : 'later') : endMoved ? (j.endDate < t.endDate ? 'earlier' : 'later') : undefined;
    if (direction === 'earlier') rating = Math.max(rating, 3);
    const s = j.startDate || t.startDate;
    const e = j.endDate || t.endDate;
    const dur = (startMoved || endMoved) && s && e ? Math.max(1, workdaysBetween(s, e, cal)) : undefined;
    items.push({
      id: `jt-${j.id}-${j.updatedAt || 'x'}`, sourceId: 'jobtread', type: 'jobtread_manual_edit', priority: prog === 100 ? 1 : 2, jevRating: rating,
      taskId: t.id, startDate: startMoved ? j.startDate : undefined, endDate: endMoved ? j.endDate : undefined, duration: dur,
      direction, shiftWorkdays: startMoved ? shift : undefined,
      percentComplete: progEdited ? prog : undefined,
      pushed: { startDate: snap.startDate, endDate: snap.endDate, version: snap.version ?? null },
      summary: `JobTread manual edit on ${t.id} ${t.name}: pushed ${snap.startDate}→${snap.endDate} (v${snap.version ?? '?'}), now ${j.startDate}→${j.endDate}${progEdited ? `, ${prog}% complete` : ''}`,
      note: direction === 'earlier' ? 'Moves the task earlier: predecessors may prevent it — the CPM keeps the logic-driven date unless the user changes the links or records an actual start.' : undefined,
      constraint: rating >= 4 ? 'Protected / milestone task — requires acknowledgement' : undefined,
    });
  }
  const sources = items.length ? [{ id: 'jobtread', kind: 'jobtread', title: 'JobTread task edits', date: new Date().toISOString(), summary: `${items.length} manual change(s) since the last push` }] : [];
  return { sources, items, skipped, pushPending };
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(new URL(import.meta.url).pathname); } catch { return false; } })();
if (isMain) {
  const [canonPath, jtPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!canonPath || !jtPath) { console.error('usage: schedule_diff.mjs canonical.json jt_tasks.json'); process.exit(1); }
  const canon = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
  const raw = JSON.parse(fs.readFileSync(jtPath, 'utf8'));
  const out = diffJobtread(canon, raw);
  if (out.skipped.length) console.error(`schedule_diff: ${out.skipped.length} mapped task(s) have no push snapshot (sync.jobtreadPushed) — not diffed. Run jobtread_push.mjs plan/record once to establish it.`);
  process.stdout.write(JSON.stringify(out, null, 2));
}
