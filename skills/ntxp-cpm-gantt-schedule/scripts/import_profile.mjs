#!/usr/bin/env node
// Schedule-export import profiler: detects how a CSV/TXT/GZ schedule export is written, then
// test-parses a sample so bad durations and dates are caught before they become tasks.
//
//   node import_profile.mjs <file[.csv|.txt|.tsv][.gz]> [--json] [--sample N]
//        exit 0 profile ok; exit 5 review (unparsed share above 2 %, or no task-name column)
//
// Ideas adapted from JEV-T (journal-entry verification, AGPLv3 community edition, IA Solutions):
// header-sampled delimiter detection, sampled format voting, gzip-transparent reads, and a
// test-parse that reports raw → cleaned → parsed for every sampled value. No code is copied.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const WORK_DAYS_PER_WEEK = 5;
const HOURS_PER_DAY = 8;
const REVIEW_SHARE = 0.02;
const DELIMS = ['|', '\t', ';', ','];

// Read a text file, transparently gunzipping .gz and dropping a UTF-8 byte-order mark.
export function readText(file) {
  const raw = fs.readFileSync(file);
  const buf = file.toLowerCase().endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
  return buf.toString('utf8').replace(/^﻿/, '');
}

// Most frequent candidate in the header line wins; ties keep the order pipe > tab > semicolon > comma.
export function detectDelimiter(headerLine = '') {
  const counts = DELIMS.map(d => [d, headerLine.split(d).length - 1]);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ',';
}

// Split one line on the delimiter, honouring double-quoted fields and "" escapes.
export function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// Duration → working days. Plain numbers use the assumed unit and are flagged as assumed.
export function parseDuration(raw, unit = 'days') {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { ok: false, reason: 'blank' };
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([a-z]*)\.?$/);
  if (!m) return { ok: false, reason: 'not a number with an optional unit' };
  const n = Number(m[1]);
  const u = m[2];
  if (!u) return { ok: true, days: n, assumed: true, unit };
  if (/^(w|wk|wks|week|weeks)$/.test(u)) return { ok: true, days: n * WORK_DAYS_PER_WEEK, unit: 'weeks' };
  if (/^(d|dy|dys|day|days)$/.test(u)) return { ok: true, days: n, unit: 'days' };
  if (/^(h|hr|hrs|hour|hours)$/.test(u)) return { ok: true, days: n / HOURS_PER_DAY, unit: 'hours' };
  return { ok: false, reason: `unknown unit "${u}"` };
}

// Date → ISO yyyy-mm-dd. Slash dates use the sampled order ('mdy' or 'dmy').
export function parseDate(raw, order = 'mdy') {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, reason: 'blank' };
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return ok(iso[1], iso[2], iso[3]);
  const sl = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (sl) {
    const [a, b] = [Number(sl[1]), Number(sl[2])];
    const [mo, da] = order === 'dmy' ? [b, a] : [a, b];
    return ok(sl[3], mo, da);
  }
  return { ok: false, reason: 'unrecognised date' };
  function ok(y, mo, da) {
    const d = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da)));
    if (d.getUTCMonth() !== Number(mo) - 1 || d.getUTCDate() !== Number(da)) return { ok: false, reason: 'impossible date' };
    return { ok: true, iso: `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` };
  }
}

// Majority vote over sampled slash dates: any first part > 12 means d/m/y; any second part > 12 means m/d/y.
export function detectDateOrder(values) {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/);
    if (!m) continue;
    if (Number(m[1]) > 12) dmy++;
    if (Number(m[2]) > 12) mdy++;
  }
  if (dmy === mdy) return { order: 'mdy', evidence: { dmy, mdy } };
  return { order: dmy > mdy ? 'dmy' : 'mdy', evidence: { dmy, mdy } };
}

// Majority vote over explicit duration units in the sample; defaults to days.
export function detectDurationUnit(values) {
  const votes = { weeks: 0, days: 0, hours: 0 };
  for (const v of values) {
    const r = parseDuration(v);
    if (r.ok && !r.assumed && r.unit in votes) votes[r.unit]++;
  }
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return { unit: top[1] > 0 ? top[0] : 'days', evidence: votes };
}

const NAME_RE = /name|task|activity/i;
const DUR_RE = /dur/i;
const START_RE = /start/i;
const FINISH_RE = /finish|end/i;

// Profile a schedule export: delimiter, columns, format votes and a sampled test-parse.
export function profileText(text, { sample = 5000 } = {}) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const delimiter = detectDelimiter(lines[0] || '');
  const header = splitLine(lines[0] || '', delimiter);
  const col = re => header.findIndex(h => re.test(h));
  const cols = { name: col(NAME_RE), duration: col(DUR_RE), start: col(START_RE), finish: col(FINISH_RE) };
  const body = lines.slice(1, sample + 1).map(l => splitLine(l, delimiter));
  const pick = i => (i >= 0 ? body.map(r => r[i] ?? '') : []);
  const dateSamples = [...pick(cols.start), ...pick(cols.finish)];
  const dateOrder = detectDateOrder(dateSamples);
  const durationUnit = detectDurationUnit(pick(cols.duration));
  const failures = { durations: [], dates: [] };
  const preview = [];
  for (const r of body) {
    if (cols.duration >= 0) {
      const res = parseDuration(r[cols.duration], durationUnit.unit);
      if (!res.ok) failures.durations.push({ raw: r[cols.duration], reason: res.reason });
      if (preview.length < 10) preview.push({ column: 'duration', raw: r[cols.duration], parsed: res.ok ? `${res.days} days` : `ERROR: ${res.reason}` });
    }
    for (const i of [cols.start, cols.finish]) {
      if (i < 0) continue;
      const res = parseDate(r[i], dateOrder.order);
      if (!res.ok && r[i]) failures.dates.push({ raw: r[i], reason: res.reason });
    }
  }
  const attempted = body.length || 1;
  const unparsed = failures.durations.length + failures.dates.length;
  const hasName = cols.name >= 0;
  const verdict = !hasName ? 'review' : unparsed / attempted > REVIEW_SHARE ? 'review' : 'ok';
  return {
    delimiter, header, columns: cols, rows: body.length, dateOrder, durationUnit,
    failures: { durations: failures.durations.length, dates: failures.dates.length, examples: failures.durations.concat(failures.dates).slice(0, 10) },
    preview, verdict, notes: hasName ? [] : ['no Name / Task column found'],
  };
}

function main(argv) {
  const file = argv.find(a => !a.startsWith('--'));
  const asJson = argv.includes('--json');
  const si = argv.indexOf('--sample');
  const sample = si >= 0 ? Number(argv[si + 1]) : 5000;
  if (!file) {
    console.error('usage: import_profile.mjs <file[.csv|.txt|.tsv][.gz]> [--json] [--sample N]');
    return 2;
  }
  const report = profileText(readText(file), { sample });
  if (asJson) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`delimiter: ${JSON.stringify(report.delimiter)}  rows sampled: ${report.rows}`);
    console.log(`date order: ${report.dateOrder.order} (votes ${JSON.stringify(report.dateOrder.evidence)})`);
    console.log(`duration unit: ${report.durationUnit.unit} (votes ${JSON.stringify(report.durationUnit.evidence)})`);
    console.log(`unparsed: ${report.failures.durations} durations, ${report.failures.dates} dates`);
    for (const p of report.preview) console.log(`  ${p.column}: ${JSON.stringify(p.raw)} → ${p.parsed}`);
    console.log(`verdict: ${report.verdict}`);
  }
  return report.verdict === 'ok' ? 0 : 5;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
