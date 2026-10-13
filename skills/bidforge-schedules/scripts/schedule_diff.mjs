#!/usr/bin/env node
// One-way JobTread -> canonical diff. Emits bidforge.sync.v1 items for manual JobTread edits.
// usage: node schedule_diff.mjs canonical.json jt_tasks.json > items.json
// jt_tasks.json: array of { id, name, startDate, endDate, progress, updatedAt } (Pave job.tasks nodes)
import fs from 'node:fs';

const [canonPath, jtPath] = process.argv.slice(2);
if (!canonPath || !jtPath) { console.error('usage: schedule_diff.mjs canonical.json jt_tasks.json'); process.exit(1); }
const canon = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
const raw = JSON.parse(fs.readFileSync(jtPath, 'utf8'));
const jt = Array.isArray(raw) ? raw : raw?.job?.tasks?.nodes || [];
const pushed = canon.sync?.jobtreadPushedUpdatedAt || {};

const tasks = canon.wbs.flatMap(p => p.children);
const byJt = new Map(tasks.filter(t => t.jobTreadTaskId).map(t => [t.jobTreadTaskId, t]));
const DAY = 86400000;
const workdays = (a, b) => { let n = 0; for (let d = new Date(`${a}T00:00:00Z`); d <= new Date(`${b}T00:00:00Z`); d = new Date(d.getTime() + DAY)) { const w = d.getUTCDay(); if (w && w < 6) n++; } return n; };

const items = [];
const sources = [];
for (const j of jt) {
  const t = byJt.get(j.id);
  if (!t) {
    items.push({ id: `jt-new-${j.id}`, sourceId: 'jobtread', type: 'note', priority: 2, jevRating: 2, summary: `JobTread task "${j.name}" (${j.startDate}→${j.endDate}) has no canonical match — map or add it`, name: j.name });
    continue;
  }
  if (pushed[j.id] && pushed[j.id] === j.updatedAt) continue; // our own push
  const startMoved = j.startDate && j.startDate !== t.startDate;
  const endMoved = j.endDate && j.endDate !== t.endDate;
  const prog = typeof j.progress === 'number' ? Math.round(j.progress * 100) : null;
  if (!startMoved && !endMoved && (prog === null || prog === (t.percentComplete || 0))) continue;
  const rating = t.isMilestone || t.protected ? 4 : t.isCritical ? 3 : 2;
  const dur = j.startDate && j.endDate ? Math.max(1, workdays(j.startDate, j.endDate)) : undefined;
  items.push({
    id: `jt-${j.id}`, sourceId: 'jobtread', type: 'jobtread_manual_edit', priority: prog === 100 ? 1 : 2, jevRating: rating,
    taskId: t.id, startDate: startMoved ? j.startDate : undefined, duration: endMoved || startMoved ? dur : undefined,
    percentComplete: prog ?? undefined,
    summary: `JobTread edit on ${t.id} ${t.name}: ${t.startDate}→${t.endDate} became ${j.startDate}→${j.endDate}${prog !== null ? `, ${prog}% complete` : ''}`,
    constraint: rating >= 4 ? 'Protected / milestone task — requires acknowledgement' : undefined,
  });
}
if (items.length) sources.push({ id: 'jobtread', kind: 'jobtread', title: 'JobTread task edits', date: new Date().toISOString(), summary: `${items.length} change(s) since last pull` });
process.stdout.write(JSON.stringify({ sources, items }, null, 2));
