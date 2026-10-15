// BidForge engine regression tests (council audit #3). Run: node --test web/src/utils/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate, toISODate, formatDate, addWorkingDays, subtractWorkingDays, workingDaysBetween,
  shiftWorkingDays, countWorkingDays, getNtxpNonWorkDays, MAX_DAY_ITERATIONS,
} from './dateUtils.js';
import { calculateSchedule, detectCircularDependencies, findDependencyCycles, wouldCreateCycle } from './scheduler.js';
import { moveTaskAfter, moveTaskBefore } from './reorder.js';
import { parseMSPDI, parseScheduleCSV } from './scheduleImport.js';
import { buildWbs } from './jevTree.js';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const T = (id, duration, predecessors = [], extra = {}) => ({ id, type: 'task', name: `T${id}`, duration, predecessors, children: [], ...extra });
const proj = (children, dependencies = [], extra = {}) => ({
  name: 'P', startDate: '2026-11-02', workingDays: WD, holidays: [],
  wbs: [{ id: '2', type: 'phase', name: 'Construction', children }], dependencies, ...extra,
});
const task = (p, id) => p.wbs.flatMap(ph => ph.children).find(t => t.id === id);
const clone = o => JSON.parse(JSON.stringify(o));
const timed = fn => { const t = performance.now(); const r = fn(); return [r, performance.now() - t]; };

// ---------------------------------------------------------------- A-01 dates
test('A-01 parseDate accepts YYYY-MM-DD, ISO timestamps, M/D/YYYY, M/D/YY; null otherwise', () => {
  assert.equal(formatDate(parseDate('2026-11-16')), '2026-11-16');
  assert.equal(formatDate(parseDate('2026-11-16T00:00:00.000Z')), '2026-11-16');
  assert.equal(formatDate(parseDate('2026-11-02T13:00:00Z')), '2026-11-02');
  assert.equal(formatDate(parseDate('11/02/2026')), '2026-11-02');
  assert.equal(formatDate(parseDate('11/2/26')), '2026-11-02');
  for (const bad of ['garbage', '', '2026-02-30', '13/01/2026', '2026/11/02', null, undefined, 42, {}]) {
    assert.equal(parseDate(bad), null, `parseDate(${JSON.stringify(bad)})`);
  }
  assert.equal(toISODate('11/02/2026'), '2026-11-02');
  assert.equal(toISODate('nope'), null);
});

test('A-01 working-day loops reject invalid dates and unbounded spans with a clear Error', () => {
  assert.throws(() => addWorkingDays(new Date(NaN), 3, WD, []), /invalid date/);
  assert.throws(() => addWorkingDays('11/02/2026x', 3, WD, []), /invalid date/);
  assert.throws(() => subtractWorkingDays(null, 3, WD, []), /invalid date/);
  assert.throws(() => workingDaysBetween(new Date(NaN), new Date(), WD, []), /invalid date/);
  assert.throws(() => addWorkingDays(new Date(2026, 10, 2), 1e7, WD, []), /iteration cap/);
  assert.throws(() => addWorkingDays(new Date(2026, 10, 2), 3, [], []), /no working days/);
  assert.throws(() => workingDaysBetween(new Date(2000, 0, 1), new Date(2090, 0, 1), WD, []), new RegExp(String(MAX_DAY_ITERATIONS)));
});

test('A-01 working-day math matches the legacy day-by-day loop (holidays included)', () => {
  const hol = [2026, 2027].flatMap(getNtxpNonWorkDays);
  const isW = d => WD.includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]) && !hol.includes(formatDate(d));
  const loopAdd = (s, n) => { const c = new Date(s); let k = 0; while (k < n) { c.setDate(c.getDate() + 1); if (isW(c)) k++; } return formatDate(c); };
  const loopSub = (s, n) => { const c = new Date(s); let k = 0; while (k < n) { c.setDate(c.getDate() - 1); if (isW(c)) k++; } return formatDate(c); };
  for (let i = 0; i < 400; i += 7) {
    const s = new Date(2026, 9, 1 + i);
    for (const n of [0, 1, 4, 13]) {
      assert.equal(formatDate(addWorkingDays(s, n, WD, hol)), loopAdd(s, n));
      assert.equal(formatDate(subtractWorkingDays(s, n, WD, hol)), loopSub(s, n));
    }
  }
  assert.equal(formatDate(shiftWorkingDays(new Date(2026, 10, 13), -2, WD, [])), '2026-11-11');
  assert.equal(countWorkingDays(new Date(2026, 10, 2), new Date(2026, 10, 6), WD, []), 5);
});

test('A-01 calculateSchedule finishes quickly on ISO-timestamp and M/D/YYYY actuals (seat A probe6)', () => {
  for (const v of ['2026-11-16T00:00:00.000Z', '11/16/2026', '2026-11-16T13:00:00Z']) {
    const [r, ms] = timed(() => calculateSchedule(proj([T('2.1', 5, [], { actualStart: v }), T('2.2', 5, ['2.1'])])));
    assert.ok(ms < 1000, `${v} took ${ms} ms`);
    assert.equal(task(r, '2.1').startDate, '2026-11-16');
    assert.equal(task(r, '2.1').actualStart, '2026-11-16', 'normalized in place');
    assert.equal(task(r, '2.2').startDate, '2026-11-23');
    assert.deepEqual(r.warnings, []);
  }
});

test('A-01 unparseable actual/constraint/contract dates are ignored with warnings', () => {
  const r = calculateSchedule(proj([
    T('2.1', 5, [], { actualStart: 'next tuesday', actualFinish: '31/31/2026', constraintStart: 'soon', contractDate: 'tbd' }),
    T('2.2', 5, ['2.1']),
  ]));
  assert.equal(task(r, '2.1').startDate, '2026-11-02');
  assert.equal(task(r, '2.2').startDate, '2026-11-09');
  assert.deepEqual(r.warnings.map(w => w.field).sort(), ['actualFinish', 'actualStart', 'constraintStart', 'contractDate']);
  assert.ok(r.warnings.every(w => w.code === 'invalid_date' && w.taskId === '2.1'));
});

test('A-01 empty workingDays / missing start date do not hang', () => {
  const r = calculateSchedule(proj([T('2.1', 3)], [], { workingDays: [] }));
  assert.equal(task(r, '2.1').endDate, '2026-11-04');
  assert.ok(r.warnings.some(w => w.code === 'working_days'));
  const r2 = calculateSchedule(proj([T('2.1', 3)], [], { startDate: null }));
  assert.ok(r2.warnings.some(w => w.code === 'start_date'));
});

// ---------------------------------------------------------------- A-16 / F-02 cycles
test('A-16 cycle is reported, flagged inCycle and keeps previous dates (seat A 2.1<->2.2)', () => {
  const base = calculateSchedule(proj([T('2.1', 5), T('2.2', 5, ['2.1']), T('2.3', 3, ['2.2'])]));
  assert.equal(base.error, undefined);
  const prev = { a: [task(base, '2.1').startDate, task(base, '2.1').endDate], b: [task(base, '2.2').startDate, task(base, '2.2').endDate] };
  const p = clone(base);
  task(p, '2.1').predecessors = ['2.2'];
  const r = calculateSchedule(p);
  assert.equal(r.error, 'dependency_cycle');
  assert.deepEqual(r.cycles.map(c => [...c].sort()), [['2.1', '2.2']]);
  assert.equal(task(r, '2.1').inCycle, true);
  assert.equal(task(r, '2.2').inCycle, true);
  assert.deepEqual([task(r, '2.1').startDate, task(r, '2.1').endDate], prev.a);
  assert.deepEqual([task(r, '2.2').startDate, task(r, '2.2').endDate], prev.b);
  assert.equal(task(r, '2.3').inCycle, undefined);
  assert.ok(task(r, '2.3').startDate > task(r, '2.2').endDate, 'downstream follows the kept dates');
  // Fixing the loop clears the flag and the error.
  task(r, '2.1').predecessors = [];
  const fixed = calculateSchedule(r);
  assert.equal(fixed.error, undefined);
  assert.equal(fixed.cycles, undefined);
  assert.equal(task(fixed, '2.1').inCycle, undefined);
});

test('F-02 resequence loop (seat B 2.6<-2.7) and transitive cycles are caught; no cycle on a fresh project uses project start', () => {
  const p = proj([T('2.6', 3, ['2.7']), T('2.7', 4, ['2.8']), T('2.8', 2, ['2.6']), T('2.9', 1, ['2.8'])]);
  const r = calculateSchedule(p);
  assert.equal(r.error, 'dependency_cycle');
  assert.deepEqual(r.cycles.map(c => [...c].sort()), [['2.6', '2.7', '2.8']]);
  assert.equal(task(r, '2.6').startDate, '2026-11-02');
  for (const id of ['2.6', '2.7', '2.8']) assert.ok(task(r, id).endDate >= task(r, id).startDate);
  assert.equal(detectCircularDependencies(p.wbs[0].children), true);
  assert.equal(findDependencyCycles(p.wbs[0].children).length, 1);
});

test('wouldCreateCycle helper', () => {
  const p = proj([T('2.1', 1), T('2.2', 1, ['2.1']), T('2.3', 1, ['2.2'])], [{ from: '2.1', to: '2.2', type: 'FS', lag: 0 }]);
  assert.equal(wouldCreateCycle(p, '2.3', '2.1'), true);
  assert.equal(wouldCreateCycle(p, '2.1', '2.3'), false);
  assert.equal(wouldCreateCycle(p, '2.2', '2.2'), true);
  assert.equal(detectCircularDependencies(p.wbs[0].children), false);
});

// ---------------------------------------------------------------- A-15 negative lags
test('A-15 FS-3 starts 3 WD before the predecessor finish; driving pred stays critical', () => {
  const r = calculateSchedule(proj([T('2.1', 10), T('2.2', 5, ['2.1'])], [{ from: '2.1', to: '2.2', type: 'FS', lag: -3 }]));
  assert.equal(task(r, '2.1').endDate, '2026-11-13');
  assert.equal(task(r, '2.2').startDate, '2026-11-11');
  assert.equal(task(r, '2.1').float, 0);
  assert.equal(task(r, '2.1').isCritical, true);
  assert.equal(task(r, '2.2').isCritical, true);
});

test('A-15 leads never schedule before the project start; SS-2 honored', () => {
  const r = calculateSchedule(proj([T('2.1', 1), T('2.2', 3, ['2.1'])], [{ from: '2.1', to: '2.2', type: 'FS', lag: -5 }]));
  assert.equal(task(r, '2.2').startDate, '2026-11-02');
  const r2 = calculateSchedule(proj([T('2.1', 5), T('2.2', 5, ['2.1']), T('2.3', 2, ['2.2'])], [{ from: '2.2', to: '2.3', type: 'SS', lag: -2 }]));
  assert.equal(task(r2, '2.2').startDate, '2026-11-09');
  assert.equal(task(r2, '2.3').startDate, '2026-11-05');
});

// ---------------------------------------------------------------- A-17 actuals
test('A-17 actualFinish without actualStart derives the start (seat A 11-16 finish)', () => {
  const r = calculateSchedule(proj([T('2.1', 5, [], { actualFinish: '2026-11-16' }), T('2.2', 2, ['2.1'])]));
  assert.equal(task(r, '2.1').startDate, '2026-11-10');
  assert.equal(task(r, '2.1').endDate, '2026-11-16');
  assert.equal(task(r, '2.2').startDate, '2026-11-17');
});

test('A-17 actualStart after actualFinish warns and uses actualStart for both', () => {
  const r = calculateSchedule(proj([T('2.1', 5, [], { actualStart: '2026-11-12', actualFinish: '2026-11-05' })]));
  assert.equal(task(r, '2.1').startDate, '2026-11-12');
  assert.equal(task(r, '2.1').endDate, '2026-11-12');
  assert.equal(task(r, '2.1').actualFinish, '2026-11-05', 'recorded value untouched');
  assert.ok(r.warnings.some(w => w.code === 'actual_finish_before_start'));
});

// ---------------------------------------------------------------- reorder
const chain = (types) => {
  // 2.1 -> 2.2 -> 2.3 with the given link types, plus an unrelated 2.4 / 2.5 tail.
  const [t1, t2] = types;
  const deps = [{ from: '2.1', to: '2.2', ...t1 }, { from: '2.2', to: '2.3', ...t2 }, { from: '2.4', to: '2.5', type: 'FS', lag: 2 }];
  return calculateSchedule(proj([T('2.1', 5), T('2.2', 5, ['2.1']), T('2.3', 5, ['2.2']), T('2.4', 3), T('2.5', 2, ['2.4'])], deps));
};
const link = (p, from, to) => p.dependencies.filter(d => d.from === from && d.to === to);

test('A-04 reorder closes the gap preserving SS+lag (successor does not jump)', () => {
  const p = chain([{ type: 'SS', lag: 2 }, { type: 'SS', lag: 2 }]);
  assert.equal(task(p, '2.3').startDate, '2026-11-06');
  const r = moveTaskAfter(p, '2.2', '2.5');
  assert.equal(r.error, undefined);
  assert.deepEqual(link(r.project, '2.1', '2.3').map(d => [d.type, d.lag]), [['SS', 4]]);
  assert.equal(task(r.project, '2.3').startDate, '2026-11-06', 'old successor keeps its date');
  assert.ok(r.relinked.some(l => l.from === '2.1' && l.to === '2.3' && l.type === 'SS' && l.lag === 4));
});

test('A-04 reorder preserves FF+lag and flags type conflicts with lag 0', () => {
  const ff = moveTaskAfter(chain([{ type: 'FF', lag: 1 }, { type: 'FF', lag: 2 }]), '2.2', '2.5');
  assert.deepEqual(link(ff.project, '2.1', '2.3').map(d => [d.type, d.lag]), [['FF', 3]]);
  const mixed = moveTaskAfter(chain([{ type: 'FS', lag: 0 }, { type: 'SS', lag: 2 }]), '2.2', '2.5');
  assert.deepEqual(link(mixed.project, '2.1', '2.3').map(d => [d.type, d.lag]), [['SS', 0]]);
  assert.ok(mixed.relinked.some(l => l.from === '2.1' && l.to === '2.3' && l.typeConflict));
});

test('A-04 reorder never duplicates pred->succ pairs and keeps target successor type/lag', () => {
  const deps = [
    { from: '2.1', to: '2.2', type: 'FS', lag: 0 }, { from: '2.2', to: '2.3', type: 'FS', lag: 0 }, { from: '2.1', to: '2.3', type: 'FS', lag: 1 },
    { from: '2.4', to: '2.5', type: 'FS', lag: 2 },
  ];
  const p = calculateSchedule(proj([T('2.1', 5), T('2.2', 5, ['2.1']), T('2.3', 5, ['2.2', '2.1']), T('2.4', 3), T('2.5', 2, ['2.4'])], deps));
  const r = moveTaskAfter(p, '2.2', '2.4');
  const keys = r.project.dependencies.map(d => `${d.from}>${d.to}`);
  assert.equal(new Set(keys).size, keys.length, `duplicates in ${keys}`);
  assert.deepEqual(link(r.project, '2.1', '2.3').map(d => d.lag), [1], 'existing link kept as-is');
  assert.deepEqual(link(r.project, '2.2', '2.5').map(d => [d.type, d.lag]), [['FS', 2]], 'target successor re-pointed with lag');
  assert.deepEqual(link(r.project, '2.4', '2.2').map(d => [d.type, d.lag]), [['FS', 0]]);
  assert.deepEqual(task(r.project, '2.2').predecessors, ['2.4']);
  assert.deepEqual(task(r.project, '2.5').predecessors, ['2.2']);
  assert.ok(r.changes.some(c => c.id === '2.2' && c.startBefore !== c.startAfter));
  assert.ok(r.changes.some(c => c.id === '2.5'), 'downstream date moves are listed');
  for (const c of r.changes) assert.ok(c.name && 'startBefore' in c && 'startAfter' in c);
});

test('A-05 constrained tasks are refused unless allowConstrained; constraints and actuals never deleted', () => {
  const p = chain([{ type: 'FS', lag: 0 }, { type: 'FS', lag: 0 }]);
  task(p, '2.2').constraintStart = '2026-12-15';
  task(p, '2.2').contractDate = '2026-12-21';
  const r = moveTaskAfter(p, '2.2', '2.5');
  assert.equal(r.error, 'constrained');
  assert.match(r.message, /constraint/);
  const ok = moveTaskAfter(p, '2.2', '2.5', { allowConstrained: true });
  assert.equal(task(ok.project, '2.2').constraintStart, '2026-12-15');
  assert.equal(task(ok.project, '2.2').contractDate, '2026-12-21');
  assert.ok(task(ok.project, '2.2').startDate >= '2026-12-15');

  const q = chain([{ type: 'FS', lag: 0 }, { type: 'FS', lag: 0 }]);
  task(q, '2.2').actualStart = '2026-11-09';
  assert.equal(moveTaskAfter(q, '2.2', '2.5').error, 'has_actuals');
  const ok2 = moveTaskAfter(q, '2.2', '2.5', { allowActuals: true });
  assert.equal(task(ok2.project, '2.2').actualStart, '2026-11-09');
});

test('A-36 moveTaskBefore: task takes target predecessors, target follows FS0; phase id = first row', () => {
  const p = chain([{ type: 'FS', lag: 0 }, { type: 'SS', lag: 1 }]);
  const r = moveTaskBefore(p, '2.5', '2.3');
  assert.equal(r.error, undefined);
  assert.deepEqual(link(r.project, '2.2', '2.5').map(d => [d.type, d.lag]), [['SS', 1]]);
  assert.deepEqual(link(r.project, '2.5', '2.3').map(d => [d.type, d.lag]), [['FS', 0]]);
  assert.deepEqual(task(r.project, '2.3').predecessors, ['2.5']);
  const ids = r.project.wbs[0].children.map(t => t.id);
  assert.ok(ids.indexOf('2.5') === ids.indexOf('2.3') - 1);
  const first = moveTaskBefore(p, '2.3', '2');
  assert.equal(first.project.wbs[0].children[0].id, '2.3');
  assert.deepEqual(link(first.project, '2.3', '2.1').map(d => d.type), ['FS']);
  assert.equal(first.moved.mode, 'before');
});

test('A-06 cross-phase move keeps a unique global id and reports phaseChanged', () => {
  const p = calculateSchedule({
    name: 'P', startDate: '2026-11-02', workingDays: WD, holidays: [],
    wbs: [
      { id: '1', type: 'phase', name: 'Precon', children: [T('1.1', 2), T('1.2', 2, ['1.1'])] },
      { id: '2', type: 'phase', name: 'Construction', children: [T('2.1', 3, ['1.2']), T('2.2', 3, ['2.1'])] },
    ],
    dependencies: [{ from: '1.1', to: '1.2', type: 'FS', lag: 0 }, { from: '1.2', to: '2.1', type: 'FS', lag: 0 }, { from: '2.1', to: '2.2', type: 'FS', lag: 0 }],
  });
  const r = moveTaskAfter(p, '1.2', '2.1');
  assert.equal(r.moved.phaseChanged, true);
  assert.equal(r.moved.fromPhase, '1');
  assert.equal(r.moved.toPhase, '2');
  const ids = r.project.wbs.flatMap(ph => ph.children.map(t => t.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(r.project.wbs[1].children.some(t => t.id === '1.2'));
  assert.deepEqual(task(r.project, '2.1').predecessors, ['1.1']);
});

test('reorder rejects moves on a looping graph; returns null for unusable ids', () => {
  const p = proj([T('2.1', 1, ['2.3']), T('2.2', 1, ['2.1']), T('2.3', 1, ['2.2']), T('2.4', 1)]);
  const r = moveTaskAfter(p, '2.4', '2.1');
  assert.equal(r.error, 'cycle');
  assert.equal(moveTaskAfter(p, '2.4', '2.4'), null);
  assert.equal(moveTaskAfter(p, 'nope', '2.1'), null);
});

// ---------------------------------------------------------------- A-25 import
test('A-25 MSPDI import keeps actuals, SNET constraints and summary-task links', () => {
  const task = (uid, name, lvl, extra = '', links = '') => `<Task><UID>${uid}</UID><Name>${name}</Name><OutlineLevel>${lvl}</OutlineLevel>${extra}${links}</Task>`;
  const pl = (uid, type = 1, lag = 0) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID><Type>${type}</Type><LinkLag>${lag}</LinkLag></PredecessorLink>`;
  const xml = `<?xml version="1.0"?><Project><Name>Job.xml</Name><MinutesPerDay>480</MinutesPerDay><Tasks>
    ${task(0, 'Job', 0, '<Summary>1</Summary>')}
    ${task(1, 'Precon', 1, '<Summary>1</Summary>')}
    ${task(2, 'Submittals', 2, '<Duration>PT40H0M</Duration><Start>2026-11-02T08:00:00</Start><Finish>2026-11-06T17:00:00</Finish><PercentComplete>100</PercentComplete><ActualStart>2026-11-02T08:00:00</ActualStart><ActualFinish>2026-11-06T17:00:00</ActualFinish>')}
    ${task(3, 'Permit', 2, '<Duration>PT16H0M</Duration><ConstraintType>4</ConstraintType><ConstraintDate>2026-11-20T08:00:00</ConstraintDate>', pl(2))}
    ${task(4, 'Construction', 1, '<Summary>1</Summary>', pl(1))}
    ${task(5, 'Demo', 2, '<Duration>PT24H0M</Duration><PercentComplete>40</PercentComplete><Start>2026-11-23T08:00:00</Start><ActualStart>2026-11-23T08:00:00</ActualStart>')}
    ${task(6, 'Framing', 2, '<Duration>PT24H0M</Duration>', pl(5, 3, 4800))}
    ${task(7, 'Closeout', 1, '<Summary>1</Summary>')}
    ${task(8, 'Punch', 2, '<Duration>PT8H0M</Duration>', pl(4))}
  </Tasks></Project>`;
  const r = parseMSPDI(xml);
  const all = r.wbs.flatMap(p => p.children);
  const by = n => all.find(t => t.name === n);
  assert.equal(by('Submittals').actualStart, '2026-11-02');
  assert.equal(by('Submittals').actualFinish, '2026-11-06');
  assert.equal(by('Permit').constraintStart, '2026-11-20');
  assert.equal(by('Demo').actualStart, '2026-11-23');
  assert.equal(by('Demo').actualFinish, undefined);
  assert.deepEqual(by('Demo').predecessors, [by('Permit').id], 'Construction summary link -> first child, from Precon last child');
  assert.deepEqual(by('Punch').predecessors, [by('Framing').id], 'link from a summary comes from its last child');
  assert.ok(r.dependencies.some(d => d.from === by('Demo').id && d.to === by('Framing').id && d.type === 'SS' && d.lag === 1));
  const s = calculateSchedule({ ...r, workingDays: WD, holidays: [] });
  assert.equal(s.error, undefined);
  assert.equal(by('Submittals').endDate, '2026-11-06');
  assert.equal(by('Permit').startDate, '2026-11-20');
});

test('A-25 CSV import keeps Actual Start / Actual Finish / % Complete', () => {
  const csv = 'Task,Duration,Start,Finish,Actual Start,Actual Finish,% Complete,Predecessors,Phase\n'
    + 'Demo,5,11/2/2026,11/6/2026,11/02/2026,11/06/2026,100%,,Construction\n'
    + 'Framing,5,11/9/2026,11/13/2026,11/10/26,,50,1,Construction\n'
    + 'Drywall,5,,,,,0,2FS+2,Construction\n';
  const r = parseScheduleCSV(csv);
  const [demo, framing, drywall] = r.wbs[0].children;
  assert.equal(demo.actualStart, '2026-11-02');
  assert.equal(demo.actualFinish, '2026-11-06');
  assert.equal(demo.percentComplete, 100);
  assert.equal(framing.actualStart, '2026-11-10');
  assert.equal(framing.percentComplete, 50);
  assert.deepEqual(r.dependencies.find(d => d.to === drywall.id), { from: framing.id, to: drywall.id, type: 'FS', lag: 2, lagUnit: 'days', source: 'import' });
});

// ---------------------------------------------------------------- A-27 performance + parity
function synthetic(n) {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const phases = []; const deps = []; const per = Math.ceil(n / 10); let k = 0;
  for (let p = 1; p <= 10; p++) {
    const ch = [];
    for (let i = 1; i <= per && k < n; i++, k++) {
      const id = `${p}.${i}`; const preds = [];
      if (k > 0) { const prev = k - 1; const f = `${Math.floor(prev / per) + 1}.${prev % per + 1}`; preds.push(f); deps.push({ from: f, to: id, type: rnd() < 0.3 ? 'SS' : 'FS', lag: rnd() < 0.3 ? 2 : 0 }); }
      if (k > 5 && rnd() < 0.5) { const o = Math.floor(rnd() * (k - 2)); const f = `${Math.floor(o / per) + 1}.${o % per + 1}`; if (!preds.includes(f)) { preds.push(f); deps.push({ from: f, to: id, type: 'FS', lag: 0 }); } }
      ch.push(T(id, 1 + Math.floor(rnd() * 8), preds, { sub: `S${Math.floor(i / 10)}` }));
    }
    phases.push({ id: String(p), type: 'phase', name: `Phase ${p}`, children: ch });
  }
  const holidays = Array.from({ length: 10 }, (_, y) => getNtxpNonWorkDays(2026 + y)).flat();
  return { name: 'Perf', startDate: '2026-11-02', workingDays: WD, holidays, wbs: phases, dependencies: deps };
}

test('A-27 2,000 activities / ~3,000 links schedule in < 60 ms (median of 5)', () => {
  const p = synthetic(2000);
  assert.ok(p.dependencies.length >= 2900);
  calculateSchedule(clone(p)); // warm-up
  const runs = [];
  for (let i = 0; i < 5; i++) { const q = clone(p); runs.push(timed(() => calculateSchedule(q))[1]); }
  runs.sort((a, b) => a - b);
  const budget = Number(process.env.ENGINE_PERF_BUDGET_MS) || 60;
  assert.ok(runs[2] < budget, `median ${runs[2].toFixed(1)} ms >= ${budget} ms`);
  const r = calculateSchedule(clone(p));
  assert.equal(r.error, undefined);
  const [m, ms] = timed(() => moveTaskAfter(r, '5.3', '2.4'));
  assert.equal(m.error, undefined);
  assert.ok(ms < budget * 3, `reorder ${ms.toFixed(1)} ms`);
});

test('engine output on a generated NTXP WBS has no warnings, no cycles and sane dates', () => {
  const { wbs, dependencies } = buildWbs(['selective_demo', 'fire_alarm', 'fire_suppression', 'low_voltage'], { tier: 'standard', sf: 10000, sector: 'isd', constraints: [] });
  const r = calculateSchedule({ name: 'B', startDate: '2027-01-04', workingDays: WD, holidays: [], wbs, dependencies });
  assert.deepEqual(r.warnings, []);
  assert.equal(r.error, undefined);
  for (const t of r.wbs.flatMap(p => p.children)) assert.ok(t.endDate >= t.startDate, t.id);
});
