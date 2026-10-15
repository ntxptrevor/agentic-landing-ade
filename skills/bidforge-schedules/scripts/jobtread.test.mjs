// JobTread push record + three-way pull diff (council audit #3, A-08 / F-09).
// run: node --test skills/bidforge-schedules/scripts/jobtread.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffJobtread } from './schedule_diff.mjs';
import { buildPushPlan, recordPush } from './jobtread_push.mjs';
import { calendarOf, workdaysBetween } from './lib/jobtread.mjs';

const canon = (over = {}) => ({
  version: 11,
  project: { name: 'McShan', jobtreadJobId: 'JOB1', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: ['2026-11-26', '2026-11-27'] },
  wbs: [{ type: 'phase', name: 'Construction', children: [
    { id: '2.1', name: 'Drywall Hang', startDate: '2026-11-23', endDate: '2026-12-01', jobTreadTaskId: 'T1', isCritical: true },
    { id: '2.2', name: 'Ceiling Grid', startDate: '2026-12-02', endDate: '2026-12-04', jobTreadTaskId: 'T2' },
    { id: '2.3', name: 'Flooring', startDate: '2026-12-07', endDate: '2026-12-11' },
  ] }],
  sync: { jobtreadPushed: {
    T1: { startDate: '2026-11-23', endDate: '2026-12-01', updatedAt: 'u1', version: 10 },
    T2: { startDate: '2026-12-01', endDate: '2026-12-03', updatedAt: 'u2', version: 10 },
  } },
  ...over,
});

test('working days honor canonical holidays (Thanksgiving)', () => {
  const cal = calendarOf(canon());
  assert.equal(workdaysBetween('2026-11-23', '2026-12-01', cal), 5); // Mon-Wed + Mon-Tue, Thu/Fri holidays
});

test('canonical change not pushed yet is push-pending, not a manual edit (no ping-pong)', () => {
  // v11 moved 2.2 a day later on the site; JobTread still holds the v10 push.
  const jt = [{ id: 'T1', name: 'Drywall Hang', startDate: '2026-11-23', endDate: '2026-12-01', updatedAt: 'u1' },
    { id: 'T2', name: 'Ceiling Grid', startDate: '2026-12-01', endDate: '2026-12-03', updatedAt: 'u2' }];
  const out = diffJobtread(canon(), jt);
  assert.equal(out.items.length, 0);
  assert.deepEqual(out.pushPending, ['2.2']);
});

test('a true manual edit (later) becomes an item with holiday-aware duration', () => {
  const jt = [{ id: 'T1', name: 'Drywall Hang', startDate: '2026-11-24', endDate: '2026-12-02', updatedAt: 'u9' }];
  const [it] = diffJobtread(canon(), jt).items;
  assert.equal(it.type, 'jobtread_manual_edit');
  assert.equal(it.direction, 'later');
  assert.equal(it.startDate, '2026-11-24');
  assert.equal(it.duration, 5);
  assert.equal(it.jevRating, 3); // critical
});

test('a manual edit that moves a task earlier is rated >= 3 with a predecessor note', () => {
  const jt = [{ id: 'T2', name: 'Ceiling Grid', startDate: '2026-11-30', endDate: '2026-12-02', updatedAt: 'u9' }];
  const [it] = diffJobtread(canon(), jt).items;
  assert.equal(it.direction, 'earlier');
  assert.equal(it.startDate, '2026-11-30');
  assert.ok(it.jevRating >= 3);
  assert.match(it.note, /predecessors may prevent it/);
});

test('no push snapshot → skipped and reported, never an item', () => {
  const c = canon({ sync: {} });
  const out = diffJobtread(c, [{ id: 'T1', startDate: '2026-11-30', endDate: '2026-12-04', updatedAt: 'u5' }]);
  assert.equal(out.items.length, 0);
  assert.equal(out.skipped[0].reason, 'no_push_snapshot');
});

test('push plan: one request per task, create for unmapped, update for changed, conflict for manual edits', () => {
  const jt = [{ id: 'T1', name: 'Drywall Hang', startDate: '2026-11-25', endDate: '2026-12-03', updatedAt: 'u9' },
    { id: 'T2', name: 'Ceiling Grid', startDate: '2026-12-01', endDate: '2026-12-03', updatedAt: 'u2' }];
  const plan = buildPushPlan(canon(), jt);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].jobTreadTaskId, 'T1');
  const kinds = plan.requests.map(r => `${r.kind}:${r.taskId}`).sort();
  assert.deepEqual(kinds, ['create:2.3', 'update:2.2']);
  for (const r of plan.requests) assert.equal(Object.keys(r.body).length, 1, 'one mutation per request');
  assert.deepEqual(plan.requests.find(r => r.kind === 'update').body.updateTask.$, { id: 'T2', startDate: '2026-12-02', endDate: '2026-12-04' });
});

test('record after read-back writes sync.jobtreadPushed and new task ids; then the pull is quiet', () => {
  const c = canon();
  const jtBefore = [{ id: 'T1', name: 'Drywall Hang', startDate: '2026-11-23', endDate: '2026-12-01', updatedAt: 'u1' },
    { id: 'T2', name: 'Ceiling Grid', startDate: '2026-12-01', endDate: '2026-12-03', updatedAt: 'u2' }];
  const plan = buildPushPlan(c, jtBefore);
  const readback = { job: { tasks: { nodes: [jtBefore[0],
    { id: 'T2', name: 'Ceiling Grid', startDate: '2026-12-02', endDate: '2026-12-04', updatedAt: 'u3' },
    { id: 'T3', name: 'Flooring', startDate: '2026-12-07', endDate: '2026-12-11', updatedAt: 'u4' }] } } };
  const { doc, recorded, mismatches } = recordPush(c, plan, readback, { at: '2026-10-15T12:00:00Z' });
  assert.equal(mismatches.length, 0);
  assert.equal(recorded.length, 2);
  assert.equal(doc.wbs[0].children[2].jobTreadTaskId, 'T3');
  assert.deepEqual(doc.sync.jobtreadPushed.T2, { startDate: '2026-12-02', endDate: '2026-12-04', progress: 0, updatedAt: 'u3', version: 11, at: '2026-10-15T12:00:00Z' });
  assert.equal(doc.sync.jobtreadPushed.T1.version, 11);
  assert.equal(doc.sync.lastJobtreadPushAt, '2026-10-15T12:00:00Z');
  const pull = diffJobtread(doc, readback);
  assert.equal(pull.items.length, 0);
  assert.equal(pull.skipped.length, 0);
});

test('record refuses to record a read-back that differs from what was pushed', () => {
  const c = canon();
  const plan = buildPushPlan(c, [{ id: 'T1', startDate: '2026-11-23', endDate: '2026-12-01' }, { id: 'T2', startDate: '2026-12-01', endDate: '2026-12-03' }]);
  const { doc, mismatches } = recordPush(c, plan, [{ id: 'T2', startDate: '2026-12-01', endDate: '2026-12-03', updatedAt: 'u2' }]);
  assert.ok(mismatches.some(m => m.taskId === '2.2'));
  assert.equal(doc.sync.jobtreadPushed.T2.version, 10);
});
