#!/usr/bin/env node
// Project-identifier crosswalk CLI (deterministic; see lib/crosswalk.mjs for weights and rules).
//
//   node crosswalk.mjs resolve <canonical.json> <scan.json> [--apply out.json] [--json]
//        exit 0 resolved (missing allowed), 4 when any source is ambiguous (never auto-picked)
//        --apply writes a copy of the canonical with the resolved links merged into `links`
//        (an existing, different link is NOT overwritten — it is reported as a conflict) and a
//        `crosswalk` record {resolvedAt, confidence, ambiguous, missing}.
//   node crosswalk.mjs verify  <canonical.json> <scan.json> [--json]
//        exit 0 no drift, 6 drift (missing_id | name_changed | better_match | unlinked_match)
//
// scan.json: { candidates: { jobtread:[{id,name,number,address,owner}], driveBid:[{id,name}],
//   driveProject:[…], lightfield:[{id,name}], quickbooks:[{id,name}], kb:[{path,name}], site:[{slug,name}] } }
//   (a bare candidates object is accepted). env_scan.mjs prints the queries that fill it.
import fs from 'node:fs';
import { resolveLinks, verifyLinks, projectOf } from './lib/crosswalk.mjs';

const [cmd, ...args] = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--apply');
const asJson = args.includes('--json');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

if (!['resolve', 'verify'].includes(cmd) || pos.length < 2) {
  console.error('usage: crosswalk.mjs resolve|verify <canonical.json> <scan.json> [--apply out.json] [--json]');
  process.exit(1);
}
let canon, scan;
try { canon = readJson(pos[0]); scan = readJson(pos[1]); } catch (e) { console.error(`crosswalk: ${e.message}`); process.exit(1); }
const candidates = scan.candidates || scan;

if (cmd === 'resolve') {
  const project = projectOf(canon);
  const r = resolveLinks(project, candidates);
  const holder = canon.meta && typeof canon.meta === 'object' ? canon.meta : canon;
  const current = { ...(canon.project || {}), ...(holder.links || {}) };
  const conflicts = Object.entries(r.links).filter(([k, v]) => current[k] && current[k] !== v).map(([k, v]) => ({ link: k, current: current[k], resolved: v }));
  const out = { command: 'resolve', project, ...r, conflicts };
  if (flag('--apply')) {
    const doc = structuredClone(canon);
    const h = doc.meta && typeof doc.meta === 'object' ? doc.meta : doc;
    h.links = { ...(h.links || {}) };
    for (const [k, v] of Object.entries(r.links)) if (!conflicts.some(c => c.link === k)) h.links[k] = v;
    h.crosswalk = { resolvedAt: new Date().toISOString(), confidence: r.confidence, ambiguous: r.ambiguous, missing: r.missing.map(m => m.link), conflicts };
    fs.writeFileSync(flag('--apply'), JSON.stringify(doc, null, 2) + '\n');
  }
  if (asJson) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  else {
    console.log(`Crosswalk — ${project.name}${project.number ? ` (#${project.number})` : ''}`);
    for (const [k, v] of Object.entries(r.links)) console.log(`  ✓ ${k}: ${v} (${r.confidence[k]})`);
    for (const a of r.ambiguous) console.log(`  ? ${a.link}: ambiguous — ${a.candidates.map(c => `${c.name} [${c.id}] ${c.score}`).join(' | ')} — ask the user`);
    for (const m of r.missing) console.log(`  ✗ ${m.link}: not located (${m.searched} searched${m.best ? `; best ${m.best.name} ${m.best.score}` : ''})`);
    for (const c of conflicts) console.log(`  ! ${c.link}: canonical has ${c.current}, scan resolves ${c.resolved} — not overwritten`);
  }
  process.exit(r.ambiguous.length ? 4 : 0);
} else {
  const r = verifyLinks(canon, scan);
  if (asJson) process.stdout.write(JSON.stringify({ command: 'verify', ...r }, null, 2) + '\n');
  else {
    console.log(`Crosswalk verify — ${r.project.name}: ${r.ok ? 'no drift' : `${r.drift.length} drift item(s)`}`);
    for (const d of r.drift) console.log(`  - ${d.type} ${d.link}: ${d.linked ?? ''}${d.found ? ` → ${d.found}` : ''}${d.name ? ` (now "${d.name}")` : ''}${d.score !== undefined ? ` score ${d.score}` : ''}`);
  }
  process.exit(r.ok ? 0 : 6);
}
