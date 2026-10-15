// Crosswalk + environment scan (council audit #3, A-13 / F-06).
// run: node --test skills/bidforge-schedules/scripts/crosswalk.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeName, tokens, scoreCandidate, resolveLinks, verifyLinks, WEIGHTS } from './lib/crosswalk.mjs';
import { planScan, registerScan, staleSources, DEFAULT_REGISTRY } from './env_scan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = { name: 'McShan Elementary Restroom Renovation', number: '1125301', address: '1550 Mernie Dr, Dallas TX', owner: 'Dallas ISD' };
const CANDIDATES = {
  jobtread: [
    { id: 'JT-A', name: 'McShan ES Restroom Reno', number: '1125301', address: '1550 Mernie Drive Dallas TX', owner: 'Dallas ISD' },
    { id: 'JT-B', name: 'McShan ES Restroom Reno (old)', number: '1124999', address: '1550 Mernie Drive Dallas TX', owner: 'Dallas ISD' },
    { id: 'JT-C', name: 'Hulcy MS Gym Floor', number: '1125302', owner: 'Dallas ISD' },
  ],
  driveBid: [
    { id: 'DB-1', name: 'McShan Elementary Restroom Renovation (bid)' },
    { id: 'DB-2', name: 'McShan Elementary Restroom Renovation - ARCHIVE' },
  ],
  driveProject: [{ id: 'DP-1', name: '1125301 McShan Elementary Restrooms' }, { id: 'DP-2', name: 'Hulcy Middle School Gym' }],
  lightfield: [{ id: 'LF-1', name: 'McShan Elementary Restroom' }, { id: 'LF-2', name: 'McShan Elementary Restrooms' }],
  quickbooks: [{ id: 'QB-9', name: 'Dallas ISD:Hulcy MS Gym Floor' }],
  kb: [{ path: '!!NTXP Knowledge Base/McShan Elementary Restroom Renovation', name: 'McShan Elementary Restroom Renovation' }],
  site: [{ slug: 'mcshan-elementary-restroom-renovation', name: 'McShan Elementary Restroom Renovation' }, { slug: 'hulcy-gym', name: 'Hulcy Gym' }],
};

test('normalizeName / tokens: abbreviations, punctuation, bid/test markers', () => {
  assert.equal(normalizeName('McShan ES — Restroom Reno (bid)'), 'mcshan elementary restroom renovation');
  assert.equal(normalizeName('!Active Bids'), 'active bids');
  assert.equal(normalizeName('BidForge Smoke Test (TEST - safe to delete)'), 'bidforge smoke test');
  assert.deepEqual(tokens('The McShan Elementary Project'), ['mcshan', 'elementary']);
});

test('scoreCandidate uses explicit weights; a different job number caps the score', () => {
  assert.equal(WEIGHTS.number + WEIGHTS.name + WEIGHTS.address + WEIGHTS.owner, 1);
  const a = scoreCandidate(PROJECT, CANDIDATES.jobtread[0]);
  const b = scoreCandidate(PROJECT, CANDIDATES.jobtread[1]);
  assert.equal(a.parts.number, 1);
  assert.ok(a.score >= 0.9, JSON.stringify(a));
  assert.equal(b.parts.number, 0);
  assert.ok(b.score <= 0.5);
  // job number found inside a folder name counts as a number match
  assert.equal(scoreCandidate(PROJECT, CANDIDATES.driveProject[0]).parts.number, 1);
});

test('resolveLinks: threshold + margin; ambiguous never auto-picked; missing reported', () => {
  const r = resolveLinks(PROJECT, CANDIDATES);
  assert.equal(r.links.jobtreadJobId, 'JT-A');
  assert.equal(r.links.jobNumber, '1125301');
  assert.equal(r.links.driveBidFolderId, 'DB-1'); // archive copy loses (×0.9)
  assert.equal(r.links.driveProjectFolderId, 'DP-1');
  assert.equal(r.links.kbPath, '!!NTXP Knowledge Base/McShan Elementary Restroom Renovation');
  assert.equal(r.links.siteSlug, 'mcshan-elementary-restroom-renovation');
  assert.equal(r.links.lightfieldId, undefined);
  assert.deepEqual(r.ambiguous.map(a => a.key), ['lightfield']);
  assert.equal(r.ambiguous[0].candidates.length, 2);
  assert.deepEqual(r.missing.map(m => m.key), ['quickbooks']);
  for (const v of Object.values(r.confidence)) assert.ok(v >= 0.75);
});

test('verifyLinks: missing id, name change and a better match are reported', () => {
  const canonical = { version: 3, project: { name: PROJECT.name, address: PROJECT.address }, links: {
    jobNumber: '1125301', jobtreadJobId: 'JT-GONE', driveProjectFolderId: 'DP-2', kbPath: CANDIDATES.kb[0].path, siteSlug: 'mcshan-elementary-restroom-renovation' } };
  const r = verifyLinks(canonical, { candidates: CANDIDATES });
  const types = r.drift.map(d => `${d.type}:${d.key}`).sort();
  assert.ok(types.includes('missing_id:jobtread'));
  assert.ok(types.includes('name_changed:driveProject'));
  assert.ok(types.includes('better_match:driveProject'));
  assert.ok(types.includes('unlinked_match:driveBid'));
  assert.equal(r.ok, false);
  const clean = verifyLinks({ project: { name: PROJECT.name }, links: { jobNumber: '1125301', jobtreadJobId: 'JT-A', driveBidFolderId: 'DB-1', driveProjectFolderId: 'DP-1', kbPath: CANDIDATES.kb[0].path, siteSlug: 'mcshan-elementary-restroom-renovation' } }, { candidates: CANDIDATES });
  assert.equal(clean.ok, true, JSON.stringify(clean.drift));
});

test('crosswalk.mjs CLI: resolve exits 4 on ambiguity and --apply never overwrites a different link', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xw-'));
  const canon = path.join(dir, 'canonical.json'), scan = path.join(dir, 'scan.json'), out = path.join(dir, 'out.json');
  fs.writeFileSync(canon, JSON.stringify({ version: 1, project: { name: PROJECT.name, number: PROJECT.number }, links: { siteSlug: 'hulcy-gym' } }));
  fs.writeFileSync(scan, JSON.stringify({ candidates: CANDIDATES }));
  const r = spawnSync(process.execPath, [path.join(here, 'crosswalk.mjs'), 'resolve', canon, scan, '--apply', out, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 4, r.stderr);
  const res = JSON.parse(r.stdout);
  assert.deepEqual(res.conflicts.map(c => c.link), ['siteSlug']);
  const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(doc.links.siteSlug, 'hulcy-gym');
  assert.equal(doc.links.jobtreadJobId, 'JT-A');
  assert.ok(doc.crosswalk.resolvedAt);
  const v = spawnSync(process.execPath, [path.join(here, 'crosswalk.mjs'), 'verify', out, scan], { encoding: 'utf8' });
  assert.equal(v.status, 6); // siteSlug now has a better match
});

// ---- environment scan ----
const REG = JSON.parse(fs.readFileSync(DEFAULT_REGISTRY, 'utf8'));

test('sources registry covers JobTread, the three Drive roots, Lightfield, QuickBooks, site and meetings', () => {
  const ids = REG.sources.map(s => s.id);
  for (const id of ['jobtread-jobs', 'drive-active-bids', 'drive-active-projects', 'drive-knowledge-base', 'lightfield-accounts', 'quickbooks-projects', 'hosted-site', 'plaud-recordings', 'gemini-meeting-notes']) assert.ok(ids.includes(id), id);
  const keys = REG.sources.map(s => s.candidatesKey).filter(Boolean);
  for (const k of ['jobtread', 'driveBid', 'driveProject', 'kb', 'lightfield', 'quickbooks', 'site']) assert.ok(keys.includes(k), k);
});

test('plan prints the exact connector calls, substitutes the project, flags stale sources', () => {
  const p = planScan(REG, { projectName: 'McShan Elementary', jobtreadJobId: 'JOB1' }, { now: new Date('2026-10-15T00:00:00Z') });
  const qb = p.steps.find(s => s.id === 'quickbooks-projects');
  assert.equal(qb.tool, 'mcp__Intuit_QuickBooks__qbo_contact_search_customer');
  assert.deepEqual(qb.args, { query: 'McShan Elementary' });
  const bids = p.steps.find(s => s.id === 'drive-active-bids');
  assert.ok(bids.resolveFirst, 'unknown folder id → resolve by name first');
  assert.equal(p.steps.find(s => s.id === 'jobtread-notes-field').args.query.job.$.id, 'JOB1');
  assert.ok(p.stale.includes('jobtread-jobs')); // never scanned
  assert.ok(p.checklist.some(c => c.includes('crosswalk.mjs resolve')));
});

test('register: lastScanAt, folder ids, new connector / Drive folder type discovered once, stale after N days', () => {
  const scan = {
    scannedAt: '2026-10-15T12:00:00Z',
    scanned: { 'jobtread-jobs': { ok: true, count: 3 }, 'drive-active-bids': { ok: true, count: 2, folderId: 'F-BIDS' }, 'quickbooks-projects': { ok: false } },
    connectors: ['mcp__JobTread__query', 'mcp__Google_Drive__search_files', 'mcp__Procore__list_projects'],
    driveFolders: [{ id: 'F-BIDS', name: '!Active Bids' }, { id: 'F-WAR', name: '!Warranty' }, { id: 'X', name: 'Personal' }],
  };
  const r = registerScan(REG, scan, { now: new Date('2026-10-15T12:00:00Z') });
  const src = id => r.registry.sources.find(s => s.id === id);
  assert.equal(src('jobtread-jobs').lastScanAt, '2026-10-15T12:00:00Z');
  assert.equal(src('drive-active-bids').folderId, 'F-BIDS');
  assert.equal(src('quickbooks-projects').lastScanAt, null);
  assert.deepEqual(r.added.map(a => `${a.kind}:${a.name}`).sort(), ['connector:Procore', 'drive_folder_type:!Warranty']);
  assert.equal(r.added[0].firstSeen, '2026-10-15T12:00:00Z');
  assert.ok(r.stale.some(s => s.id === 'quickbooks-projects'));
  assert.ok(!r.stale.some(s => s.id === 'jobtread-jobs'));
  // second scan: nothing new, lastSeen moves; 10 days later jobtread is stale (7-day default)
  const r2 = registerScan(r.registry, { ...scan, scannedAt: '2026-10-16T12:00:00Z' }, { now: new Date('2026-10-16T12:00:00Z') });
  assert.equal(r2.added.length, 0);
  assert.equal(r2.registry.discovered.find(d => d.name === 'Procore').lastSeen, '2026-10-16T12:00:00Z');
  assert.ok(staleSources(r2.registry, new Date('2026-10-27T00:00:00Z')).some(s => s.id === 'jobtread-jobs'));
  assert.ok(!staleSources(r2.registry, new Date('2026-10-27T00:00:00Z'), 30).some(s => s.id === 'jobtread-jobs'));
  // discovered entries show up in the next plan for review
  assert.ok(planScan(r2.registry).steps.some(s => s.review && s.id.includes('Procore')));
});

test('env_scan.mjs CLI plan and register run without writing the real registry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
  const reg = path.join(dir, 'sources.json');
  fs.copyFileSync(DEFAULT_REGISTRY, reg);
  const p = spawnSync(process.execPath, [path.join(here, 'env_scan.mjs'), 'plan', '--registry', reg, '--project', 'McShan'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /mcp__JobTread__query/);
  const scan = path.join(dir, 'scan.json');
  fs.writeFileSync(scan, JSON.stringify({ scannedAt: '2026-10-15T00:00:00Z', scanned: { 'hosted-site': { ok: true } }, found: [{ kind: 'connector', name: 'Procore', tool: 'mcp__Procore__x' }] }));
  const r = spawnSync(process.execPath, [path.join(here, 'env_scan.mjs'), 'register', scan, '--registry', reg, '--write'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const saved = JSON.parse(fs.readFileSync(reg, 'utf8'));
  assert.equal(saved.discovered.length, 1);
  assert.equal(saved.sources.find(s => s.id === 'hosted-site').lastScanAt, '2026-10-15T00:00:00Z');
});
