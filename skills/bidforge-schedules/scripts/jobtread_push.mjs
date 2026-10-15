#!/usr/bin/env node
// Canonical -> JobTread date push, recorded so the daily pull can tell pushes from manual edits.
//
//   plan:   node jobtread_push.mjs plan canonical.json jt_tasks.json [--job <jobId>] > plan.json
//           -> { jobId, version, requests:[{kind:'create'|'update', taskId, jobTreadTaskId?, body, expect}],
//                conflicts:[…], unchanged, pushPending }
//           ONE Pave request per task (a batched multi-createTask fails on JobTread — 2026-10-14
//           smoke test). Send each `body` through mcp__JobTread__query in order.
//           A mapped task whose JobTread dates differ from the last recorded push is a manual edit:
//           it is listed under `conflicts` and NOT pushed (run schedule_diff.mjs and apply it first).
//   record: node jobtread_push.mjs record canonical.json plan.json readback.json [--write | --out new.json]
//           readback.json = job.tasks read AFTER the pushes (same query as the pull). For every
//           planned task whose read-back dates match, writes
//             sync.jobtreadPushed[jobTreadTaskId] = {startDate, endDate, progress, updatedAt, version, at}
//           plus jobTreadTaskId on created tasks and sync.lastJobtreadPushAt. Mismatches are reported
//           and not recorded (exit 1). Prints the updated canonical (or writes it with --write/--out).
import fs from 'node:fs';
import { view } from './lib/canonical_read.mjs';
import { jtNodes, jtIncomplete, scheduleTasks, pushedMap, progressOf, jtProgress } from './lib/jobtread.mjs';

const TASK_FIELDS = { id: {}, name: {}, startDate: {}, endDate: {}, progress: {}, updatedAt: {} };

export function buildPushPlan(canon, rawJt, { jobId } = {}) {
  const v = view(canon);
  const job = jobId || v.links.jobtreadJobId || v.project.jobtreadJobId;
  if (!job) throw new Error('No JobTread job id (canonical links.jobtreadJobId or --job).');
  const jt = new Map(jtNodes(rawJt).map(j => [j.id, j]));
  const pushed = pushedMap(canon);
  const requests = [];
  const conflicts = [];
  let unchanged = 0;
  for (const t of scheduleTasks(canon)) {
    if (!t.startDate || !t.endDate) continue;
    const expect = { startDate: t.startDate, endDate: t.endDate, progress: progressOf(t) };
    if (!t.jobTreadTaskId) {
      requests.push({ kind: 'create', taskId: t.id, name: t.name, expect,
        body: { createTask: { $: { targetType: 'job', targetId: job, name: String(t.name || t.id).slice(0, 200), startDate: t.startDate, endDate: t.endDate }, createdTask: TASK_FIELDS } } });
      continue;
    }
    const cur = jt.get(t.jobTreadTaskId);
    if (!cur) { conflicts.push({ taskId: t.id, jobTreadTaskId: t.jobTreadTaskId, reason: 'mapped JobTread task not found (deleted?) — remap before pushing' }); continue; }
    const snap = pushed[t.jobTreadTaskId];
    const manual = snap && snap.startDate && (cur.startDate !== snap.startDate || cur.endDate !== snap.endDate);
    if (manual && (cur.startDate !== t.startDate || cur.endDate !== t.endDate)) {
      conflicts.push({ taskId: t.id, jobTreadTaskId: t.jobTreadTaskId, reason: `manual JobTread edit since push v${snap.version ?? '?'} (${snap.startDate}→${snap.endDate} became ${cur.startDate}→${cur.endDate}) — pull it with schedule_diff.mjs first` });
      continue;
    }
    const progCur = jtProgress(cur);
    const datesSame = cur.startDate === t.startDate && cur.endDate === t.endDate;
    const progSame = progCur === null || progCur === expect.progress;
    if (datesSame && progSame) { unchanged++; continue; }
    const $ = { id: t.jobTreadTaskId };
    if (cur.startDate !== t.startDate) $.startDate = t.startDate;
    if (cur.endDate !== t.endDate) $.endDate = t.endDate;
    if (!progSame) $.progress = expect.progress / 100;
    requests.push({ kind: 'update', taskId: t.id, jobTreadTaskId: t.jobTreadTaskId, expect, body: { updateTask: { $ } } });
  }
  // Paginated: repeat with $.page = previous nextPage until nextPage is null; save all pages as a JSON array.
  const readBack = { job: { $: { id: job }, tasks: { $: { size: 100 }, nodes: TASK_FIELDS, nextPage: {} } } };
  return { jobId: job, version: v.version, plannedAt: new Date().toISOString(), requests, conflicts, unchanged, readBack };
}

export function recordPush(canon, plan, rawReadback, { at = new Date().toISOString() } = {}) {
  // Jobs with more than one page of tasks: every page must be read back (copy nextPage into $.page
  // until it is null) and passed as an array, or later tasks would never get their mapping.
  if (jtIncomplete(rawReadback)) throw new Error('read-back incomplete: nextPage is not null — fetch every page and pass them as a JSON array');
  const doc = structuredClone(canon);
  const holder = doc.meta && typeof doc.meta === 'object' && doc.meta.sync ? doc.meta : doc;
  holder.sync = holder.sync || {};
  const map = holder.sync.jobtreadPushed = { ...(holder.sync.jobtreadPushed || {}) };
  const rb = jtNodes(rawReadback);
  const byId = new Map(rb.map(j => [j.id, j]));
  const mapped = new Set(Object.keys(map));
  const tasks = new Map(view(doc).tasks.map(t => [t.id, t]));
  // view() returns copies: write jobTreadTaskId back into the real WBS nodes.
  const realNodes = new Map();
  const walk = ns => { for (const n of ns || []) { if (n && n.id !== undefined) realNodes.set(n.id, n); walk(n?.children); } };
  walk(doc.project?.wbs || doc.wbs);
  const recorded = [], mismatches = [];
  for (const r of plan.requests) {
    let j = r.jobTreadTaskId ? byId.get(r.jobTreadTaskId) : null;
    if (!j && r.kind === 'create') j = rb.find(x => !mapped.has(x.id) && x.name === String(r.name || '').slice(0, 200) && x.startDate === r.expect.startDate) || null;
    if (!j) { mismatches.push({ taskId: r.taskId, reason: 'not found in read-back' }); continue; }
    if (j.startDate !== r.expect.startDate || j.endDate !== r.expect.endDate) {
      mismatches.push({ taskId: r.taskId, jobTreadTaskId: j.id, reason: `read-back ${j.startDate}→${j.endDate} ≠ pushed ${r.expect.startDate}→${r.expect.endDate}` });
      continue;
    }
    mapped.add(j.id);
    map[j.id] = { startDate: j.startDate, endDate: j.endDate, progress: jtProgress(j) ?? r.expect.progress, updatedAt: j.updatedAt || null, version: plan.version, at };
    if (r.kind === 'create' && realNodes.get(r.taskId)) realNodes.get(r.taskId).jobTreadTaskId = j.id;
    recorded.push({ taskId: r.taskId, jobTreadTaskId: j.id, kind: r.kind });
  }
  // Unchanged mapped tasks: refresh the snapshot when JobTread still equals the canonical.
  for (const t of tasks.values()) {
    if (!t.jobTreadTaskId || map[t.jobTreadTaskId]?.version === plan.version) continue;
    const j = byId.get(t.jobTreadTaskId);
    if (j && j.startDate === t.startDate && j.endDate === t.endDate && !plan.conflicts.some(c => c.jobTreadTaskId === j.id)) {
      map[j.id] = { startDate: j.startDate, endDate: j.endDate, progress: jtProgress(j) ?? progressOf(t), updatedAt: j.updatedAt || null, version: plan.version, at };
    }
  }
  holder.sync.lastJobtreadPushAt = at;
  return { doc, recorded, mismatches };
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(new URL(import.meta.url).pathname); } catch { return false; } })();
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const pos = args.filter((a, i) => !a.startsWith('--') && !['--job', '--out'].includes(args[i - 1]));
  const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  try {
    if (cmd === 'plan' && pos.length >= 2) {
      const plan = buildPushPlan(readJson(pos[0]), readJson(pos[1]), { jobId: flag('--job') });
      process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
      console.error(`jobtread_push plan: ${plan.requests.length} request(s) (one per task), ${plan.conflicts.length} conflict(s), ${plan.unchanged} unchanged.`);
    } else if (cmd === 'record' && pos.length >= 3) {
      const { doc, recorded, mismatches } = recordPush(readJson(pos[0]), readJson(pos[1]), readJson(pos[2]));
      const text = JSON.stringify(doc, null, 2) + '\n';
      if (args.includes('--write')) fs.writeFileSync(pos[0], text);
      else if (flag('--out')) fs.writeFileSync(flag('--out'), text);
      else process.stdout.write(text);
      console.error(JSON.stringify({ recorded: recorded.length, mismatches }));
      process.exit(mismatches.length ? 1 : 0);
    } else {
      console.error('usage: jobtread_push.mjs plan canonical.json jt_tasks.json [--job id] | record canonical.json plan.json readback.json [--write|--out f]');
      process.exit(1);
    }
  } catch (e) { console.error(`jobtread_push: ${e.message}`); process.exit(2); }
}
