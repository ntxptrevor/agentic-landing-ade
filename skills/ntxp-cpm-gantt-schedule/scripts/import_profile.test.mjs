// Tests for import_profile.mjs: delimiter sniffing, gzip reads, unit/date voting and the CLI verdict.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readText, detectDelimiter, splitLine, parseDuration, parseDate,
  detectDateOrder, detectDurationUnit, profileText,
} from './import_profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'impprof-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const write = (name, s) => { const p = path.join(tmp, name); fs.writeFileSync(p, s); return p; };

test('delimiter: pipe, tab and semicolon beat comma when they dominate the header', () => {
  assert.equal(detectDelimiter('Name|Duration|Start'), '|');
  assert.equal(detectDelimiter('Name\tDuration\tStart'), '\t');
  assert.equal(detectDelimiter('Name;Duration;Start'), ';');
  assert.equal(detectDelimiter('Name,Duration,Start'), ',');
  assert.equal(detectDelimiter('Name'), ',');
});

test('splitLine keeps quoted delimiters and "" escapes', () => {
  assert.deepEqual(splitLine('"Pour slab, level 2",5,"say ""hi"""', ','), ['Pour slab, level 2', '5', 'say "hi"']);
});

test('parseDuration converts units to working days and rejects blanks and junk', () => {
  assert.deepEqual(parseDuration('3d').days, 3);
  assert.equal(parseDuration('2 wks').days, 10);
  assert.equal(parseDuration('1w').days, 5);
  assert.equal(parseDuration('8 hrs').days, 1);
  assert.equal(parseDuration('7').assumed, true);
  assert.equal(parseDuration('').ok, false);
  assert.equal(parseDuration('soon').ok, false);
  assert.equal(parseDuration('2 fortnights').ok, false);
});

test('parseDate honours the sampled order and rejects impossible dates', () => {
  assert.equal(parseDate('03/04/2027', 'mdy').iso, '2027-03-04');
  assert.equal(parseDate('03/04/2027', 'dmy').iso, '2027-04-03');
  assert.equal(parseDate('2027-04-03').iso, '2027-04-03');
  assert.equal(parseDate('02/30/2027').ok, false);
});

test('detectDateOrder votes on values that cannot be ambiguous', () => {
  assert.equal(detectDateOrder(['13/02/2027', '04/03/2027']).order, 'dmy');
  assert.equal(detectDateOrder(['02/13/2027', '03/04/2027']).order, 'mdy');
  assert.equal(detectDateOrder(['03/04/2027']).order, 'mdy');
});

test('detectDurationUnit uses explicit units and defaults to days', () => {
  assert.equal(detectDurationUnit(['2 wks', '3 wks', '5']).unit, 'weeks');
  assert.equal(detectDurationUnit(['4', '6']).unit, 'days');
});

test('profileText counts unparsed values and flags review above the threshold', () => {
  const rows = ['Name|Duration|Start', ...Array.from({ length: 50 }, (_, i) => `Task ${i}|3d|2027-03-0${(i % 9) + 1}`), 'Bad|soon|2027-03-01'];
  const ok = profileText(rows.slice(0, 51).join('\n'));
  assert.equal(ok.verdict, 'ok');
  assert.equal(ok.delimiter, '|');
  const bad = profileText(['Name,Duration', ...Array.from({ length: 10 }, (_, i) => `T${i},xx`)].join('\n'));
  assert.equal(bad.verdict, 'review');
  assert.equal(bad.failures.durations, 10);
  assert.equal(profileText('Duration,Start\n3d,2027-03-01').verdict, 'review');
});

test('readText gunzips .gz files and strips a BOM', () => {
  const gz = path.join(tmp, 'sched.csv.gz');
  fs.writeFileSync(gz, zlib.gzipSync('﻿Name,Duration\nPour,3d\n'));
  assert.equal(readText(gz), 'Name,Duration\nPour,3d\n');
});

test('CLI exits 0 for a clean export and 5 for one needing review', () => {
  const good = write('good.tsv', 'Name\tDuration\tStart\nPour slab\t3d\t2027-03-01\nCure\t2 wks\t2027-03-08\n');
  const r1 = spawnSync(process.execPath, [path.join(here, 'import_profile.mjs'), good, '--json'], { encoding: 'utf8' });
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(JSON.parse(r1.stdout).verdict, 'ok');
  const bad = write('bad.csv', 'Name,Duration\nA,soon\nB,later\n');
  const r2 = spawnSync(process.execPath, [path.join(here, 'import_profile.mjs'), bad], { encoding: 'utf8' });
  assert.equal(r2.status, 5);
  assert.match(r2.stdout, /verdict: review/);
  assert.equal(spawnSync(process.execPath, [path.join(here, 'import_profile.mjs')], { encoding: 'utf8' }).status, 2);
});
