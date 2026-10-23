// Lesson drift metrics + toggle (council audit #3, A-33 / F-20).
// run: node --test skills/ntxp-cpm-gantt-schedules/scripts/lessons.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseLessons, findLesson } from './lib/lessons.mjs';
import { computeMetrics } from './lessons_metrics.mjs';
import { toggleLesson, findReferences } from './lesson_toggle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MD = `# Lessons Learned

## 2026-10-13

### LL-2026-10-13-22…25 — Inspection holds, mockup gates
Status: applied   Scope: jevTree
Remove by: delete the rows/links tagged LL-22…25.

### LL-2026-10-13-04 — Slab moisture testing before flooring
Status: applied   Scope: backbone/construction
Remove by: delete rows tagged lesson: 'LL-2026-10-13-04'.

### LL-2026-10-13-05 — Permit-issued gate
Status: **awaiting-user**   Scope: backbone/preconstruction
`;

const canonical = {
  version: 9,
  project: { name: 'McShan', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: ['2026-11-26'] },
  wbs: [{ type: 'phase', name: 'Construction', children: [
    // planned 5, actual 8 (Mon 11/23 → Thu 12/3 skipping Thanksgiving) → +60 %
    { id: '2.1', name: 'Slab Moisture / pH Testing', duration: 5, lesson: 'LL-2026-10-13-04', actualStart: '2026-11-23', actualFinish: '2026-12-03' },
    { id: '2.2', name: 'Above-Ceiling Inspection', duration: 2, lesson: 'LL-2026-10-13-22', actualStart: '2026-12-07', actualFinish: '2026-12-08' },
    { id: '2.3', name: 'Rough-in Mockup', duration: 5, lesson: 'LL-2026-10-13-23' },
  ] }],
  changelog: [
    { id: 'CHG-0001', type: 'schedule_generated' },
    { id: 'CHG-0002', type: 'duration_change', target: '2.1' },
    { id: 'CHG-0003', type: 'task_edits', after: ['2.1 Slab Moisture 7d'] },
    { id: 'CHG-0004', type: 'actual_dates', target: '2.2' },
  ],
};

test('parser expands range headings and reads status / remove-by', () => {
  const l = parseLessons(MD);
  assert.deepEqual(l.map(x => x.id), ['LL-2026-10-13-22…25', 'LL-2026-10-13-04', 'LL-2026-10-13-05']);
  assert.deepEqual(l[0].ids, ['LL-2026-10-13-22', 'LL-2026-10-13-23', 'LL-2026-10-13-24', 'LL-2026-10-13-25']);
  assert.equal(findLesson(l, 'LL-2026-10-13-24').id, 'LL-2026-10-13-22…25');
  assert.equal(l[2].status, 'awaiting-user');
  // the real file parses too
  const real = parseLessons(fs.readFileSync(path.join(here, '../knowledge/lessons-learned.md'), 'utf8'));
  assert.ok(real.length >= 15);
  assert.ok(real.every(x => x.statusLine > 0), 'every real entry has a Status line');
});

test('metrics: planned vs actual (holiday-aware), inspection hold accuracy, overrides, council flag', () => {
  const r = computeMetrics(MD, [{ path: 'c.json', doc: canonical }], { date: '2026-12-10' });
  const m = id => r.lessons.find(l => l.id === id);
  assert.equal(m('LL-2026-10-13-04').plannedWd, 5);
  assert.equal(m('LL-2026-10-13-04').actualWd, 8);
  assert.equal(m('LL-2026-10-13-04').meanVariance, 0.6);
  assert.equal(m('LL-2026-10-13-04').overrides, 2);
  assert.equal(m('LL-2026-10-13-04').councilReview, true);
  assert.equal(m('LL-2026-10-13-22').inspection.accuracy, 1);
  assert.equal(m('LL-2026-10-13-22').councilReview, false);
  assert.equal(m('LL-2026-10-13-23').completed, 0);
  assert.equal(m('LL-2026-10-13-05').rows, 0);
  assert.deepEqual(r.flagged, ['LL-2026-10-13-04']);
});

test('lessons_metrics.mjs CLI writes the metrics file to --out', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-'));
  fs.writeFileSync(path.join(d, 'canonical.json'), JSON.stringify(canonical));
  fs.writeFileSync(path.join(d, 'll.md'), MD);
  const out = path.join(d, 'metrics', '2026-12-10.json');
  const r = spawnSync(process.execPath, [path.join(here, 'lessons_metrics.mjs'), d, '--lessons', path.join(d, 'll.md'), '--date', '2026-12-10', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')).flagged, ['LL-2026-10-13-04']);
});

test('toggle: whole entry status, range member note, history kept', () => {
  const a = toggleLesson(MD, 'LL-2026-10-13-04', 'removed', { by: 'Trevor', date: '2026-12-10', reason: 'metrics +60%' });
  assert.match(a.md, /Status: removed \(2026-12-10, Trevor: metrics \+60%; was: applied\)\s+Scope: backbone\/construction/);
  assert.equal(parseLessons(a.md)[1].status.startsWith('removed'), true);
  const b = toggleLesson(MD, 'LL-2026-10-13-23', 'removed', { by: 'Trevor', date: '2026-12-10' });
  assert.equal(b.whole, false);
  assert.match(b.md, /Member status: LL-2026-10-13-23 removed \(2026-12-10, Trevor\)/);
  assert.match(b.md, /Status: applied {3}Scope: jevTree/);
  const c = toggleLesson(a.md, 'LL-2026-10-13-04', 'applied', { by: 'Trevor', date: '2026-12-11' });
  assert.match(c.md, /Status: applied \(2026-12-11, Trevor; was: removed/);
  assert.throws(() => toggleLesson(MD, 'LL-2099-01-01-01', 'removed'));
});

test('references: lists tagged source rows in this repo without deleting anything', () => {
  const repo = path.resolve(here, '../../..');
  const refs = findReferences(repo, ['LL-2026-10-13-03']);
  assert.ok(refs.some(r => r.file.endsWith('constructionPhases.js')), JSON.stringify(refs));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-'));
  fs.writeFileSync(path.join(d, 'll.md'), MD);
  fs.writeFileSync(path.join(d, 'c.json'), JSON.stringify(canonical));
  const r = spawnSync(process.execPath, [path.join(here, 'lesson_toggle.mjs'), 'LL-2026-10-13-23', 'removed', '--lessons', path.join(d, 'll.md'), '--canonical', path.join(d, 'c.json'), '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.written, false);
  assert.deepEqual(rep.canonicalRows.map(x => x.id), ['2.3']);
  assert.equal(fs.readFileSync(path.join(d, 'll.md'), 'utf8'), MD); // dry run
});
