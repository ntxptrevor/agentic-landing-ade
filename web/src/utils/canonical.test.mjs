// node --test web/src/utils/canonical.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyMeta, logChange, logActivity, nextChgSeq, entriesSinceVersion, tasksChangedSince,
  applySyncItems, holdSyncItems, acknowledgeHeld, dismissHeld, openHeld, oacGateCheck,
  markSiteSaved, markPublished, fromCanonicalDocument, buildCanonicalDocument, summarizeChanges, changesSinceSave,
  safeHref, matchProjects, normalizeProjectName, saveLocal, markAwarded, keepAwarded, recordCodaBackup,
  sourceRef, APPLIED_ITEM_IDS_CAP, unionSources,
} from './canonical.js';

const project = () => ({
  name: 'Demo Clinic', startDate: '2026-11-02', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: [], hoursPerDay: 8,
  wbs: [
    { id: '1', name: 'Preconstruction', phaseKey: 'preconstruction', children: [
      { id: '1.1', name: 'NTP', duration: 0, startDate: '2026-11-02', endDate: '2026-11-02', predecessors: [] },
    ] },
    { id: '2', name: 'Construction', phaseKey: 'construction', children: [
      { id: '2.1', name: 'Demo', duration: 5, startDate: '2026-11-03', endDate: '2026-11-09', predecessors: ['1.1'] },
      { id: '2.2', name: 'Framing', duration: 5, startDate: '2026-11-10', endDate: '2026-11-16', predecessors: ['2.1'] },
      { id: '2.3', name: 'Substantial Completion', duration: 0, startDate: '2026-11-17', endDate: '2026-11-17', predecessors: ['2.2'], isMilestone: true },
    ] },
  ],
  dependencies: [
    { from: '1.1', to: '2.1', type: 'FS', lag: 0 },
    { from: '2.1', to: '2.2', type: 'SS', lag: 2 },
    { from: '2.2', to: '2.3', type: 'FS', lag: 0 },
  ],
});
const src = [sourceRef('gmail', 'Owner email', 'https://mail.example.com/1', '2026-10-14')];

test('logChange: CHG ids from chgSeq, unique across noVersion entries; legacy ids read', () => {
  let m = emptyMeta();
  m = logChange(m, { type: 'a', sources: src });
  m = logActivity(m, { type: 'oac_report' });
  m = logChange(m, { type: 'b', sources: src });
  assert.deepEqual(m.changelog.map(e => e.id), ['CHG-0001', 'CHG-0002', 'CHG-0003']);
  assert.equal(m.version, 2);
  assert.equal(m.chgSeq, 3);
  assert.equal(m.changelog[1].noVersion, true);
  assert.equal(m.changelog[1].version, 1);
  assert.equal(m.changelog[2].version, 2);
  assert.ok(!('noVersion' in m.changelog[0]));
  // Legacy: ids not equal to length (reconciled branches) — next id is above all of them.
  const legacy = { ...emptyMeta(), version: 9, changelog: [{ id: 'CHG-0007', at: 'x' }, { id: 'CHG-0003', at: 'y' }] };
  assert.equal(nextChgSeq(legacy), 8);
  assert.equal(logChange(legacy, { type: 'c' }).changelog[2].id, 'CHG-0008');
});

test('logChange: every entry carries sources (fallback names the origin)', () => {
  const m = logChange(emptyMeta(), { type: 'x', source: 'task editor' });
  assert.equal(m.changelog[0].sources.length, 1);
  assert.equal(m.changelog[0].sources[0].title, 'task editor');
});

test('entriesSinceVersion / tasksChangedSince (legacy entries without version)', () => {
  const m = { ...emptyMeta(), version: 3, changelog: [
    { id: 'CHG-0001', type: 'a', target: '2.1' },
    { id: 'CHG-0002', type: 'b', target: '2.2 Framing' },
    { id: 'CHG-0003', type: 'oac_report', noVersion: true },
    { id: 'CHG-0004', type: 'c', target: '2.3' },
  ] };
  assert.deepEqual(entriesSinceVersion(m, 1).map(e => e.id), ['CHG-0002', 'CHG-0003', 'CHG-0004']);
  assert.deepEqual([...tasksChangedSince(m, 1)].sort(), ['2.2', '2.3']);
  assert.deepEqual([...tasksChangedSince(m, 3)], []);
});

test('applySyncItems: idempotent by item id, appliedItemIds capped', () => {
  const item = { id: 'i1', type: 'actual_dates', taskId: '2.1', actualStart: '2026-11-03', summary: 'Demo started', sources: src, jevRating: 1 };
  const r1 = applySyncItems(project(), emptyMeta(), [item]);
  assert.equal(r1.report.applied, 1);
  assert.equal(r1.meta.version, 1);
  assert.deepEqual(r1.meta.sync.appliedItemIds, ['i1']);
  const r2 = applySyncItems(r1.project, r1.meta, [item]);
  assert.equal(r2.report.applied, 0);
  assert.equal(r2.report.duplicates, 1);
  assert.equal(r2.meta.version, 1);
  assert.equal(r2.meta.changelog.length, r1.meta.changelog.length);
  const big = { ...emptyMeta(), sync: { ...emptyMeta().sync, appliedItemIds: Array.from({ length: APPLIED_ITEM_IDS_CAP }, (_, i) => `old${i}`) } };
  const r3 = applySyncItems(project(), big, [{ ...item, id: 'new1' }]);
  assert.equal(r3.meta.sync.appliedItemIds.length, APPLIED_ITEM_IDS_CAP);
  assert.equal(r3.meta.sync.appliedItemIds.at(-1), 'new1');
  assert.ok(!r3.meta.sync.appliedItemIds.includes('old0'));
});

test('applySyncItems: add_event dedupes by sourceId+name and name+date', () => {
  const ev = { id: 'e1', type: 'add_event', sourceId: 's1', name: 'Owner meeting', date: '2026-11-04', summary: 'OAC', sources: src };
  const r1 = applySyncItems(project(), emptyMeta(), [ev]);
  const added = r1.project.wbs[1].children.filter(t => t.name === 'Owner meeting');
  assert.equal(added.length, 1);
  assert.equal(added[0].id, '2.4');
  const r2 = applySyncItems(r1.project, r1.meta, [{ ...ev, id: 'e2' }]); // new id, same event
  assert.equal(r2.project.wbs[1].children.filter(t => t.name === 'Owner meeting').length, 1);
  assert.equal(r2.report.duplicates, 1);
  assert.equal(r2.meta.version, r1.meta.version);
  assert.equal(r2.meta.changelog.at(-1).type, 'add_event_skipped');
  const r3 = applySyncItems(r1.project, r1.meta, [{ ...ev, id: 'e3', sourceId: 'other' }]); // same name+date
  assert.equal(r3.project.wbs[1].children.filter(t => t.name === 'Owner meeting').length, 1);
});

test('applySyncItems: unknown taskId is logged as skipped, not applied (F-08)', () => {
  const r = applySyncItems(project(), emptyMeta(), [{ id: 'x1', type: 'actual_dates', taskId: '9.99', actualFinish: '2026-11-05', summary: 'ghost', sources: src }]);
  assert.equal(r.report.applied, 0);
  assert.equal(r.report.skipped, 1);
  assert.equal(r.meta.version, 0);
  const e = r.meta.changelog.at(-1);
  assert.equal(e.type, 'actual_dates_skipped');
  assert.match(e.reason, /task not found/);
  assert.equal(e.noVersion, true);
  assert.deepEqual(e.sources, src);
  assert.ok(!r.meta.sync.appliedItemIds.includes('x1'));
});

test('applySyncItems: unapproved milestone_move is tracked, not moved (A-18)', () => {
  const it = { id: 'm1', type: 'milestone_move', taskId: '2.3', oldDate: '2026-11-17', newDate: '2027-01-15', summary: 'Owner wants SC later', sources: src, jevRating: 3 };
  const r = applySyncItems(project(), emptyMeta(), [{ ...it, approved: false }]);
  const t = r.project.wbs[1].children.find(x => x.id === '2.3');
  assert.equal(t.contractDate, undefined);
  assert.equal(t.constraintStart, undefined);
  const e = r.meta.changelog.at(-1);
  assert.equal(e.type, 'milestone_move_tracked');
  assert.equal(e.after.proposed, '2027-01-15');
  assert.equal(e.after.applied, false);
  assert.equal(r.meta.version, 0);
  const ok = applySyncItems(project(), emptyMeta(), [{ ...it, approved: true }]);
  assert.equal(ok.project.wbs[1].children.find(x => x.id === '2.3').contractDate, '2027-01-15');
  assert.equal(ok.meta.changelog.at(-1).type, 'milestone_move');
  assert.equal(ok.meta.version, 1);
});

test('applySyncItems: earlier JobTread edit sets requestedStart, not constraintStart (F-09)', () => {
  const r = applySyncItems(project(), emptyMeta(), [{ id: 'j1', type: 'jobtread_manual_edit', taskId: '2.2', startDate: '2026-11-05', direction: 'earlier', summary: 'JT moved framing earlier', sources: src }]);
  const t = r.project.wbs[1].children.find(x => x.id === '2.2');
  assert.equal(t.requestedStart, '2026-11-05');
  assert.equal(t.constraintStart, undefined);
  assert.match(r.meta.changelog.at(-1).reason, /predecessors prevent an earlier start/);
  const later = applySyncItems(project(), emptyMeta(), [{ id: 'j2', type: 'jobtread_manual_edit', taskId: '2.2', startDate: '2026-11-20', summary: 'later' }]);
  assert.equal(later.project.wbs[1].children.find(x => x.id === '2.2').constraintStart, '2026-11-20');
});

test('applySyncItems: resequence keeps existing link type/lag', () => {
  const r = applySyncItems(project(), emptyMeta(), [{ id: 'r1', type: 'resequence', taskId: '2.2', predecessors: ['2.1', '1.1'], summary: 'reseq' }]);
  const into = r.project.dependencies.filter(d => d.to === '2.2');
  assert.deepEqual(into.find(d => d.from === '2.1'), { from: '2.1', to: '2.2', type: 'SS', lag: 2 });
  assert.equal(into.find(d => d.from === '1.1').type, 'FS');
});

test('applySyncItems: entries carry sources (bundle refs or fallback)', () => {
  const r = applySyncItems(project(), emptyMeta(), [
    { id: 'a', type: 'duration_change', taskId: '2.1', duration: 7, summary: 'longer', sources: src },
    { id: 'b', type: 'note', summary: 'just a note', source: 'Plaud' },
  ]);
  for (const e of r.meta.changelog) assert.ok(e.sources.length >= 1, e.type);
  assert.equal(r.meta.changelog[0].sources[0].url, 'https://mail.example.com/1');
  assert.equal(r.meta.changelog[1].noVersion, true);
  assert.equal(r.meta.version, 1);
});

test('held items: hold, acknowledge, dismiss, apply; OAC gate counts only open ones', () => {
  const held = { id: 'h1', type: 'duration_change', taskId: '2.2', duration: 9, summary: 'Framing +4 d', jevRating: 4, sources: src };
  let m = holdSyncItems(emptyMeta(), [held, { ...held, id: 'h2', summary: 'Other' }]);
  assert.equal(m.version, 0);
  assert.equal(m.changelog.at(-1).type, 'sync_held');
  assert.equal(openHeld(m).length, 2);
  assert.deepEqual(m.sync.pending[0].item.duration, 9);
  const base = { ...m, version: 4, sync: { ...m.sync, lastSyncAt: new Date().toISOString(), publishedVersion: 4 } };
  assert.match(oacGateCheck(base).reasons.join(' '), /2 held sync item/);
  let a = acknowledgeHeld(base, ['h1'], { by: 'pm@ntxpllc.com', note: 'owner aware' });
  assert.equal(a.version, 4);
  const e = a.changelog.at(-1);
  assert.equal(e.type, 'held_acknowledged');
  assert.equal(e.noVersion, true);
  assert.deepEqual(e.sources, src);
  assert.equal(a.sync.pending[0].acknowledged, true);
  assert.equal(a.sync.pending[0].ackBy, 'pm@ntxpllc.com');
  assert.match(oacGateCheck(a).reasons.join(' '), /1 held sync item/);
  a = dismissHeld(a, ['h2'], { by: 'pm' });
  assert.equal(a.sync.pending[1].status, 'dismissed');
  assert.equal(a.changelog.at(-1).type, 'held_dismissed');
  assert.ok(oacGateCheck(a).ok, oacGateCheck(a).reasons.join('; '));
  assert.equal(acknowledgeHeld(a, ['h1']), a); // already resolved: no-op
  // Apply a held item later: it leaves pending.
  const m2 = holdSyncItems(emptyMeta(), [held]);
  const r = applySyncItems(project(), m2, [{ ...m2.sync.pending[0].item, approved: true }]);
  assert.equal(r.meta.sync.pending.length, 0);
  assert.equal(r.project.wbs[1].children.find(t => t.id === '2.2').duration, 9);
});

test('OAC gate: site save is not a publish (A-07); OAC report does not bump version (F-07)', () => {
  let m = { ...emptyMeta(), version: 5, sync: { ...emptyMeta().sync, lastSyncAt: new Date().toISOString() } };
  m = markSiteSaved(m, 5);
  assert.equal(m.sync.siteSavedVersion, 5);
  assert.equal(m.sync.publishedVersion, undefined);
  assert.equal(oacGateCheck(m).ok, false);
  m = markPublished(m);
  assert.ok(oacGateCheck(m).ok);
  const afterOac = logActivity({ ...m, sync: { ...m.sync, lastOacAt: new Date().toISOString() } }, { type: 'oac_report' });
  assert.equal(afterOac.version, 5);
  assert.ok(oacGateCheck(afterOac).ok);
  const newerSite = markSiteSaved({ ...m, version: 5 }, 6);
  assert.match(oacGateCheck(newerSite).reasons.join(' '), /Site save v6 is newer/);
  const stale = { ...m, sync: { ...m.sync, lastSyncAt: '2020-01-01T00:00:00Z', lastFullSyncAt: null } };
  assert.match(oacGateCheck(stale).reasons.join(' '), /older than 24 h/);
});

test('recordCodaBackup is bookkeeping (no version bump) with a source (C-14)', () => {
  const m = recordCodaBackup({ ...emptyMeta(), version: 3 }, { status: 'failed', error: 'timeout', at: '2026-10-14T00:00:00Z' });
  assert.equal(m.version, 3);
  assert.equal(m.changelog.at(-1).type, 'coda_backup');
  assert.equal(m.changelog.at(-1).noVersion, true);
  assert.ok(m.changelog.at(-1).sources.length);
});

test('fromCanonicalDocument: flat and nested shapes; refuses a doc without wbs (C-06)', () => {
  const p = project();
  let meta = logChange({ ...emptyMeta(), slug: '1125-demo' }, { type: 'x', sources: src });
  meta = { ...meta, links: { ...meta.links, jobNumber: '1125' } };
  const flat = buildCanonicalDocument(p, meta);
  assert.equal(flat.project.slug, '1125-demo');
  const a = fromCanonicalDocument(JSON.parse(JSON.stringify(flat)));
  assert.equal(a.project.wbs.length, 2);
  assert.equal(a.meta.version, 1);
  assert.equal(a.meta.slug, '1125-demo');
  assert.equal(a.meta.links.jobNumber, '1125');
  assert.equal(a.meta.chgSeq, 1);
  const nested = { schema: 'bidforge.canonical.v1', meta: { version: 7, status: 'active', changelog: meta.changelog, links: { jobNumber: 'J-9' }, sync: { publishedVersion: 7 } }, project: { name: 'Nested', slug: 'nested', startDate: '2026-11-02', wbs: p.wbs, dependencies: p.dependencies } };
  const b = fromCanonicalDocument(nested);
  assert.equal(b.meta.version, 7);
  assert.equal(b.meta.status, 'active');
  assert.equal(b.meta.links.jobNumber, 'J-9');
  assert.equal(b.project.name, 'Nested');
  assert.equal(b.project.dependencies.length, 3);
  assert.deepEqual(b.meta.sync.pending, []);
  assert.throws(() => fromCanonicalDocument({ schema: 'bidforge.canonical.v1', version: 1, project: { name: 'Demo' }, tasks: [{ id: 'T1' }] }), /no WBS activities.*flat "tasks"/);
  assert.throws(() => fromCanonicalDocument({ schema: 'bidforge.canonical.v1', meta: { version: 2 }, project: { name: 'E', wbs: [] } }), /no WBS activities/);
});

test('buildCanonicalDocument: project.slug is the routing slug when given (A-24)', () => {
  const doc = buildCanonicalDocument(project(), emptyMeta(), 'mcshan-1125');
  assert.equal(doc.project.slug, 'mcshan-1125');
  assert.equal(buildCanonicalDocument(project(), emptyMeta()).project.slug, 'demo-clinic');
});

test('summarizeChanges: save reason covers every change since last save; sources unioned (A-23)', () => {
  let m = emptyMeta();
  m = logChange(m, { type: 'a', reason: 'first', sources: src });
  const savedAt = m.changelog[0].at;
  m.changelog[0].at = '2026-01-01T00:00:00.000Z';
  m = logChange(m, { type: 'b', reason: 'second', sources: src });
  m = logChange(m, { type: 'c', reason: 'third', sources: [sourceRef('site', 'Drag', '/?project=x')] });
  m = logActivity(m, { type: 'oac_report', reason: 'oac' });
  const since = changesSinceSave(m, '2026-06-01T00:00:00.000Z');
  assert.equal(since.length, 3);
  const { reason, sources } = summarizeChanges(since);
  assert.match(reason, /^3 changes: CHG-0002 b: second; CHG-0003 c: third; CHG-0004 oac_report: oac/);
  assert.equal(sources.length, 3); // src (deduped) + Drag + fallback app source
  assert.equal(summarizeChanges([]).reason, 'Saved from schedule.ntxpllc.com');
  assert.ok(savedAt);
  assert.equal(unionSources([src, src]).length, 1);
});

test('safeHref allows http(s), mailto, / and ./ only (A-29)', () => {
  assert.equal(safeHref('https://x.com/a'), 'https://x.com/a');
  assert.equal(safeHref('http://x.com'), 'http://x.com');
  assert.equal(safeHref('mailto:a@b.com'), 'mailto:a@b.com');
  assert.equal(safeHref('/?project=x'), '/?project=x');
  assert.equal(safeHref('./api/file.php?id=1'), './api/file.php?id=1');
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', '//evil.com', '/\\evil.com', 'vbscript:x', '\u0001javascript:x', 'ftp://x', '', null, undefined]) {
    assert.equal(safeHref(bad), '', String(bad));
  }
});

test('matchProjects: fuzzy name / job number match (A-24/C-11)', () => {
  const list = [
    { slug: '1125-mcshan-es', name: '1125 McShan Elementary School Renovation', number: '1125', status: 'active' },
    { slug: 'demo-clinic', name: 'Demo Family Clinic Renovation', number: 'DEMO-001', status: 'active' },
    { slug: 'unt-union', name: 'UNT Union Starbucks Ph 3', status: 'bid' },
  ];
  assert.equal(normalizeProjectName('1125 · McShan Elementary!'), 'mcshan elementary');
  assert.equal(normalizeProjectName('DEMO-001 - Demo Family Clinic'), 'demo family clinic');
  assert.deepEqual(matchProjects(list, { name: 'McShan Elementary School Renovation' }).map(p => p.slug), ['1125-mcshan-es']);
  assert.deepEqual(matchProjects(list, { name: 'Something else', number: 'demo 001' }).map(p => p.slug), ['demo-clinic']);
  assert.deepEqual(matchProjects(list, { name: 'Demo family clinic' }).map(p => p.slug), ['demo-clinic']);
  assert.deepEqual(matchProjects(list, { name: 'UNT union starbucks phase 3' }).map(p => p.slug), ['unt-union']);
  assert.deepEqual(matchProjects(list, { name: 'Brand New Courthouse' }), []);
});

test('saveLocal: skips unchanged content, reports quota errors (A-26)', () => {
  const store = new Map();
  let writes = 0;
  let full = false;
  globalThis.localStorage = {
    setItem(k, v) { if (full) { const e = new Error('exceeded the quota'); e.name = 'QuotaExceededError'; throw e; } writes += 1; store.set(k, v); },
    getItem: k => store.get(k) ?? null,
  };
  try {
    const p = project();
    const m = logChange(emptyMeta(), { type: 'x' });
    assert.deepEqual(saveLocal(p, m), { ok: true });
    const w = writes;
    assert.equal(saveLocal(p, m).skipped, true);
    assert.equal(writes, w);
    const doc = JSON.parse(store.get('bidforge.canonical.demo-clinic'));
    assert.ok(doc.generatedAt);
    full = true;
    const r = saveLocal(p, logChange(m, { type: 'y' }));
    assert.equal(r.ok, false);
    assert.equal(r.quota, true);
  } finally {
    delete globalThis.localStorage;
  }
});

test('award: status active is kept; markAwarded routes to the project folder with a source (C-12)', () => {
  assert.equal(keepAwarded('bid', 'active'), 'active');
  assert.equal(keepAwarded('bid', undefined, null), 'bid');
  const m = markAwarded(emptyMeta(), { name: 'Demo Clinic', by: 'pm@ntxpllc.com', url: 'https://schedule.ntxpllc.com/?project=demo' });
  assert.equal(m.status, 'active');
  const e = m.changelog.at(-1);
  assert.equal(e.type, 'status_changed');
  assert.equal(e.after.folder, '!Active Projects/Demo Clinic/06 - Schedule');
  assert.equal(e.sources[0].url, 'https://schedule.ntxpllc.com/?project=demo');
  assert.equal(markAwarded(m, { name: 'Demo Clinic' }), m);
});
