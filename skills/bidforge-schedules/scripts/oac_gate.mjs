#!/usr/bin/env node
// OAC gate — the forced-schedule-update rule. Every OAC report / agenda / minutes generation
// must pass this first. Exit 0 only when ALL hold:
//   1. synced (sync.lastFullSyncAt or sync.lastSyncAt) within --max-age-hours (default 24)
//   2. no pending JEV rating >= 4 item that is still unacknowledged
//   3. the published version (KB-published, sync.publishedVersion) equals the canonical version
//   4. no unpulled hosted-site saves: none in --changes <changes.json> (the output of
//      GET /api/changes.php?since=…) for this project, and sync.siteSavedVersion is not newer
//      than sync.publishedVersion (site saves must be pulled into the KB canonical first)
// Otherwise prints the reasons and exits 2.  Bad input exits 1.
// usage: node oac_gate.mjs <canonical.json> [--changes changes.json] [--max-age-hours 24] [--now ISO] [--json]
import fs from 'node:fs';
import { loadCanonical, view, checkGate, GATE_INSTRUCTION } from './lib/canonical_read.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const path = args.find((a, i) => !a.startsWith('--') && !['--max-age-hours', '--now', '--changes'].includes(args[i - 1]));
if (!path) { console.error('usage: oac_gate.mjs <canonical.json> [--changes changes.json] [--max-age-hours 24] [--now ISO] [--json]'); process.exit(1); }

let v;
try { v = view(loadCanonical(path)); } catch (e) { console.error(`oac_gate: cannot read ${path}: ${e.message}`); process.exit(1); }
const maxAgeHours = Number(flag('--max-age-hours') ?? 24);
const now = flag('--now') ? new Date(flag('--now')) : new Date();
let changes = null;
if (flag('--changes')) {
  try { changes = JSON.parse(fs.readFileSync(flag('--changes'), 'utf8')); } catch (e) { console.error(`oac_gate: cannot read ${flag('--changes')}: ${e.message}`); process.exit(1); }
}
const r = checkGate(v, { maxAgeHours, now, changes });
const instruction = GATE_INSTRUCTION(v.slug);

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify({ ...r, project: v.name, instruction: r.pass ? null : instruction }, null, 2) + '\n');
} else if (r.pass) {
  console.log(`OAC gate PASS — ${v.name} v${r.version} (published v${r.publishedVersion}), last sync ${r.lastSync}.`);
} else {
  console.log(`OAC gate FAIL — ${v.name} v${r.version}`);
  for (const x of r.reasons) console.log(`  - ${x}`);
  console.log(instruction);
}
process.exit(r.pass ? 0 : 2);
