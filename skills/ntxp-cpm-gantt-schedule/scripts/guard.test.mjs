// Write guard (A-35) and OAC gate site-save rule (council audit #3 item 8).
// run: node --test skills/ntxp-cpm-gantt-schedule/scripts/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkWrite, recordWrite, canonicalHash } from './write_guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (script, args) => spawnSync(process.execPath, [path.join(here, script), ...args], { encoding: 'utf8' });
const tmp = (name, obj) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'g-')); const p = path.join(d, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; };

const doc = (version, extra = {}) => ({ version, project: { name: 'McShan', slug: 'mcshan' }, wbs: [{ type: 'phase', name: 'P', children: [{ id: '1.1', name: 'Demo', startDate: '2026-11-02', endDate: '2026-11-06', duration: 5 }] }], changelog: [], ...extra });

test('hash ignores sync metadata', () => {
  assert.equal(canonicalHash(doc(3)), canonicalHash(doc(3, { sync: { targets: { drive: { version: 3 } } } })));
  assert.notEqual(canonicalHash(doc(3)), canonicalHash(doc(4)));
});

test('first write allowed; record; same version+hash skips; newer canonical writes', () => {
  const d3 = doc(3);
  assert.equal(checkWrite(d3, 'drive').action, 'write');
  const rec = recordWrite(d3, 'drive', { at: '2026-10-15T00:00:00Z' });
  assert.deepEqual(rec.sync.targets.drive, { version: 3, hash: canonicalHash(d3), at: '2026-10-15T00:00:00Z' });
  assert.equal(checkWrite(rec, 'drive').action, 'skip');
  const d4 = { ...doc(4), sync: rec.sync };
  const r = checkWrite(d4, 'drive');
  assert.equal(r.action, 'write');
  assert.equal(r.record.version, 4);
});

test('refuses an older canonical than the target holds, and a same-version fork', () => {
  const older = { ...doc(3), sync: { targets: { site: { version: 5, hash: 'x' } } } };
  assert.equal(checkWrite(older, 'site').action, 'refuse');
  const fork = { ...doc(5), sync: { targets: { site: { version: 5, hash: 'other' } } } };
  assert.equal(checkWrite(fork, 'site').action, 'refuse');
  // an observed version read from the target itself raises the bar
  assert.equal(checkWrite(doc(6), 'jobtread-notes', { observedVersion: 7 }).action, 'refuse');
  assert.throws(() => checkWrite(doc(1), 'dropbox'));
});

test('write_guard.mjs CLI: exit 2 on refuse, prints the record to save on write', () => {
  const p = tmp('c.json', { ...doc(3), sync: { targets: { lightfield: { version: 4 } } } });
  assert.equal(run('write_guard.mjs', ['check', p, 'lightfield']).status, 2);
  const w = run('write_guard.mjs', ['check', p, 'drive']);
  assert.equal(w.status, 0);
  assert.match(w.stdout, /sync\.targets\["drive"\]/);
  assert.equal(run('write_guard.mjs', ['record', p, 'drive', '--write']).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(p, 'utf8')).sync.targets.drive.version, 3);
});

const passing = (extra = {}) => ({ ...doc(7), sync: { lastFullSyncAt: '2026-10-15T10:00:00Z', publishedVersion: 7, ...extra } });
const gate = (p, more = []) => run('oac_gate.mjs', [p, '--now', '2026-10-15T12:00:00Z', ...more]);

test('oac_gate passes a fresh, published canonical', () => {
  assert.equal(gate(tmp('c.json', passing())).status, 0);
});

test('oac_gate fails while site saves are unpulled (siteSavedVersion > publishedVersion)', () => {
  const r = gate(tmp('c.json', passing({ siteSavedVersion: 8 })));
  assert.equal(r.status, 2);
  assert.match(r.stdout, /Unpulled site save v8/);
});

test('oac_gate --changes: pending saves for this project fail the gate; other projects do not', () => {
  const c = tmp('c.json', passing());
  const mine = tmp('changes.json', { changes: [{ slug: 'mcshan', version: 8, hash: 'h', savedAt: '2026-10-15T11:00:00Z', by: 'pm@ntxpllc.com', reason: 'drag' }] });
  const other = tmp('changes.json', { changes: [{ slug: 'hulcy', version: 3 }] });
  const r = gate(c, ['--changes', mine, '--json']);
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).unpulledSiteSaves, 1);
  assert.equal(gate(c, ['--changes', other]).status, 0);
  assert.equal(gate(c, ['--changes', '/nonexistent.json']).status, 1);
});
