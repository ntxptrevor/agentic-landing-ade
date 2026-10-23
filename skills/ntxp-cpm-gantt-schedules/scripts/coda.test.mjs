// Coda backup budget tests (council audit #3, A-12/F-04).
// run: node --test skills/ntxp-cpm-gantt-schedules/scripts/coda.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = await import(pathToFileURL(path.resolve(here, '../../../web/src/utils/codaBackup.js')).href);
const CLI = path.join(here, 'coda_backup.mjs');

// A realistic Coda (values as written by the 2026-10-14 smoke test, with every field filled).
const CODA = {
  ...lib.emptyCoda(),
  version: 4,
  liveSchedule: 'https://schedule.ntxpllc.com/?project=mcshan-elementary-restroom-renovation',
  canonicalSchedule: '!!NTXP Knowledge Base/McShan Elementary Restroom Renovation/schedule/canonical.json',
  kb: '!!NTXP Knowledge Base/McShan Elementary Restroom Renovation',
  drive: '!Active Projects/McShan Elementary Restroom Renovation/06 - Schedule 1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  jobtread: 'McShan Elementary Restroom 22PFxyzAbC12',
  quickbooks: 'Dallas ISD:McShan Elementary Restroom Renovation',
  hosted: 'https://schedule.ntxpllc.com/projects/mcshan-elementary-restroom-renovation/live.html',
  council: 'NTXP Model Council v3 (Opus, GPT-5, Gemini 2.5 Pro; Fable tie-break)',
};
const AT = '2026-10-15T12:00:00.000Z';
const OPTS = { event: 'sync', at: AT, canonicalVersion: 42, lastChange: 'CHG-0137' };
const teamNotes = n => {
  const base = 'Scope: restroom renovation, 2 floors, night work only after 6 pm. Gate code 4471. Owner PM Ms. Rivera. ';
  let s = '';
  while (s.length < n) s += base;
  return s.slice(0, n);
};

function check(n) {
  const existing = teamNotes(n);
  const budget = lib.codaBudget(existing);
  const r = lib.fitCodaBlock(CODA, { ...OPTS, maxChars: budget });
  return { existing, budget, r };
}

for (const n of [0, 300, 650, 700]) {
  test(`team notes ${n} chars: block fits with both markers, notes untouched`, () => {
    const { existing, budget, r } = check(n);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.ok(r.block.length <= budget, `${r.block.length} > ${budget}`);
    assert.ok(r.block.startsWith(lib.CODA_START));
    assert.ok(r.block.endsWith(lib.CODA_END));
    const merged = lib.mergeNotes(existing, r.block);
    assert.ok(merged.length <= lib.NOTES_FIELD_LIMIT, `merged ${merged.length}`);
    assert.equal(lib.preservesTeamNotes(existing, merged), true);
    const parsed = lib.parseCodaBlock(merged);
    assert.ok(parsed, 'block parses back');
    assert.equal(parsed.coda.liveSchedule, CODA.liveSchedule);
    assert.equal(parsed.coda.kb, CODA.kb);
    // Re-running on the merged value replaces the block in place (idempotent size).
    const again = lib.fitCodaBlock(CODA, { ...OPTS, maxChars: lib.codaBudget(merged) });
    assert.equal(again.ok, true);
    assert.equal(lib.mergeNotes(merged, again.block), merged);
  });
}

test('realistic Coda with ~300 chars of team notes keeps the compact form (instructions + essentials whole)', () => {
  const { r } = check(300);
  assert.ok(['full', 'compact'].includes(r.form), r.form);
  const parsed = lib.parseCodaBlock(r.block);
  assert.equal(parsed.coda.instructions, lib.CODA_SHORT_INSTRUCTIONS);
  for (const k of ['liveSchedule', 'kb', 'jobtread', 'drive']) assert.equal(parsed.coda[k], CODA[k], k);
});

for (const n of [900, 1100]) {
  test(`team notes ${n} chars: notes_too_long, nothing built`, () => {
    const { budget, r } = check(n);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'notes_too_long');
    assert.equal(r.budget, budget);
    assert.ok(r.minChars > budget);
  });
}

test('the minimal block is about 240 chars and never sliced', () => {
  const r = lib.fitCodaBlock(CODA, { ...OPTS, maxChars: 300 });
  assert.equal(r.ok, true);
  assert.equal(r.form, 'minimal');
  assert.ok(r.block.endsWith(lib.CODA_END));
  for (let max = 0; max < 1100; max += 7) {
    const x = lib.fitCodaBlock(CODA, { ...OPTS, maxChars: max });
    if (x.ok) { assert.ok(x.block.length <= max); assert.ok(x.block.includes(lib.CODA_START) && x.block.endsWith(lib.CODA_END)); }
    else assert.equal(x.reason, 'notes_too_long');
  }
  // Preview helper always returns a block with both markers.
  const preview = lib.buildCodaBlock(CODA, { ...OPTS, maxChars: 50 });
  assert.ok(preview.startsWith(lib.CODA_START) && preview.endsWith(lib.CODA_END));
});

function runCli(n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coda-'));
  const canon = path.join(dir, 'canonical.json');
  fs.writeFileSync(canon, JSON.stringify({ version: 42, project: { name: 'McShan', jobtreadJobId: '22PFxyzAbC12' }, coda: CODA, changelog: [{ id: 'CHG-0137' }] }));
  const notes = path.join(dir, 'notes.txt');
  fs.writeFileSync(notes, teamNotes(n));
  const r = spawnSync(process.execPath, [CLI, 'build', canon, n ? notes : '-', 'sync'], { encoding: 'utf8' });
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null };
}

for (const n of [0, 300, 650, 700]) {
  test(`coda_backup.mjs build with ${n} chars of team notes writes a valid merge`, () => {
    const r = runCli(n);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.status, 'ready');
    assert.equal(r.json.humanNotesPreserved, true);
    assert.ok(r.json.chars <= 1024);
    assert.ok(r.json.mutation.updateJob);
  });
}

for (const n of [900, 1100]) {
  test(`coda_backup.mjs build with ${n} chars of team notes writes nothing (exit 4, rated 3)`, () => {
    const r = runCli(n);
    assert.equal(r.status, 4);
    assert.equal(r.json.status, 'skipped');
    assert.equal(r.json.reason, 'notes_too_long');
    assert.equal(r.json.mutation, null);
    assert.equal(r.json.jevRating, 3);
    assert.equal(r.json.codaBackup.status, 'skipped');
    assert.match(r.json.message, /team's Notes/);
  });
}
