#!/usr/bin/env node
// Environment scan (council audit #3, A-13 / F-06): deterministic, testable.
//
//   plan:     node env_scan.mjs plan [--project "<name>"] [--job <jobtreadJobId>] [--since ISO]
//                 [--registry knowledge/sources.json] [--now ISO] [--stale-days N] [--json]
//             Prints, per registered source, the exact connector call (tool + args) the agent must
//             run, then a checklist. Stale sources (never scanned, or > N days since lastScanAt)
//             are flagged. Save the results as one scan.json (format below).
//   register: node env_scan.mjs register <scan.json> [--registry …] [--now ISO] [--stale-days N] [--write]
//             Records lastScanAt (and newly resolved Drive folder ids) for every source scanned OK,
//             registers NEW sources found (a new connector, a new top-level "!…" Drive folder type,
//             or explicit scan.found entries) in `discovered` with firstSeen, and lists stale sources.
//             --write saves the registry; otherwise the updated registry is printed.
//
// scan.json: { scannedAt, scanned: { <sourceId>: { ok, count, folderId? } },
//              connectors: ["mcp__Name__tool", …], driveFolders: [{id, name}],
//              found: [{kind, name, tool?, id?}], candidates: { jobtread:[…], driveBid:[…], … } }
// `candidates` is what crosswalk.mjs resolve/verify reads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
export const DEFAULT_REGISTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../knowledge/sources.json');

const fill = (v, ctx) => {
  if (typeof v === 'string') return v.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== '' ? String(ctx[k]) : m));
  if (Array.isArray(v)) return v.map(x => fill(x, ctx));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, ctx)]));
  return v;
};

export function staleSources(registry, now = new Date(), days = registry.staleAfterDays ?? 7) {
  return (registry.sources || []).filter(s => !s.lastScanAt || (now - new Date(s.lastScanAt)) / DAY > days)
    .map(s => ({ id: s.id, lastScanAt: s.lastScanAt || null, ageDays: s.lastScanAt ? Math.floor((now - new Date(s.lastScanAt)) / DAY) : null }));
}

export function planScan(registry, ctx = {}, { now = new Date(), staleDays } = {}) {
  const stale = new Set(staleSources(registry, now, staleDays).map(s => s.id));
  const steps = [];
  for (const s of registry.sources || []) {
    const c = { ...ctx, folderId: s.folderId };
    const needsFolder = 'folderId' in s && !s.folderId;
    steps.push({
      id: s.id, title: s.title, tool: s.tool, stale: stale.has(s.id), candidatesKey: s.candidatesKey || null,
      preflight: s.preflight || [],
      resolveFirst: needsFolder ? { tool: s.tool, args: s.resolveFolder, note: `folder id unknown — resolve "${s.folderName}" by name, then record scanned.${s.id}.folderId` } : null,
      args: fill(s.args, c),
      map: s.map || null,
      unresolved: [...JSON.stringify(fill(s.args, c)).matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter((x, i, a) => a.indexOf(x) === i),
    });
  }
  for (const d of registry.discovered || []) {
    if (d.status === 'ignored') continue;
    steps.push({ id: `discovered:${d.kind}:${d.name}`, title: `Discovered ${d.kind} "${d.name}" (first seen ${d.firstSeen}) — review and register as a source or mark ignored`, tool: d.tool || null, stale: false, args: d.id ? { id: d.id } : {}, review: true });
  }
  const checklist = [
    ...steps.map(s => `[ ] ${s.id}${s.stale ? ' (STALE)' : ''} — ${s.title}${s.unresolved?.length ? ` · needs: ${s.unresolved.join(', ')}` : ''}`),
    '[ ] Save every result into scan.json (scanned.<id> = {ok, count}; candidates.<key> = mapped records; connectors = tools available this session; driveFolders = top-level Drive folders seen)',
    '[ ] node env_scan.mjs register scan.json --write',
    '[ ] node crosswalk.mjs resolve <canonical.json> scan.json   (ambiguous → ask the user; never auto-pick)',
    '[ ] node crosswalk.mjs verify <canonical.json> scan.json    (drift → fix links in canonical, log a changelog entry)',
  ];
  return { asOf: now.toISOString(), project: ctx.projectName || null, steps, checklist, stale: [...stale] };
}

export function registerScan(registry, scan, { now = new Date(), staleDays } = {}) {
  const reg = structuredClone(registry);
  reg.sources = reg.sources || [];
  reg.discovered = reg.discovered || [];
  const at = scan.scannedAt || now.toISOString();
  const updated = [], added = [];
  for (const s of reg.sources) {
    const r = scan.scanned?.[s.id];
    if (!r || r.ok === false) continue;
    s.lastScanAt = at;
    if (typeof r.count === 'number') s.lastCount = r.count;
    if ('folderId' in s && !s.folderId && r.folderId) s.folderId = r.folderId;
    updated.push(s.id);
  }
  const knownTools = new Set(reg.sources.map(s => s.tool).filter(Boolean));
  const knownPrefixes = new Set([...knownTools].map(t => (t.match(/^mcp__[^_]+(?:_[^_]+)*?__/) || [t])[0]));
  const knownFolders = new Set(reg.sources.map(s => s.folderName).filter(Boolean));
  const seen = (kind, name) => reg.discovered.find(d => d.kind === kind && d.name === name);
  const add = (entry) => {
    const prior = seen(entry.kind, entry.name);
    if (prior) { prior.lastSeen = at; return; }
    const e = { ...entry, firstSeen: at, lastSeen: at, status: 'new' };
    reg.discovered.push(e);
    added.push(e);
  };
  for (const c of scan.connectors || []) {
    const tool = typeof c === 'string' ? c : c.tool;
    if (!tool) continue;
    const prefix = (tool.match(/^mcp__[^_]+(?:_[^_]+)*?__/) || [tool])[0];
    if (knownTools.has(tool) || knownPrefixes.has(prefix)) continue;
    add({ kind: 'connector', name: prefix.replace(/^mcp__|__$/g, ''), tool });
    knownPrefixes.add(prefix);
  }
  for (const f of scan.driveFolders || []) {
    const name = typeof f === 'string' ? f : f.name;
    if (!name || !/^!/.test(name) || knownFolders.has(name)) continue;
    add({ kind: 'drive_folder_type', name, id: f.id || null, tool: 'mcp__Google_Drive__search_files' });
  }
  for (const f of scan.found || []) if (f && f.kind && f.name) add({ ...f });
  reg.lastScanAt = at;
  return { registry: reg, updated, added, stale: staleSources(reg, now, staleDays ?? reg.staleAfterDays) };
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const VALUED = ['--project', '--job', '--since', '--registry', '--now', '--stale-days'];
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const pos = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
  const regPath = flag('--registry') || DEFAULT_REGISTRY;
  const now = flag('--now') ? new Date(flag('--now')) : new Date();
  const staleDays = flag('--stale-days') !== undefined ? Number(flag('--stale-days')) : undefined;
  let registry;
  try { registry = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (e) { console.error(`env_scan: cannot read registry ${regPath}: ${e.message}`); process.exit(1); }
  if (cmd === 'plan') {
    const p = planScan(registry, { projectName: flag('--project'), jobtreadJobId: flag('--job'), lastSyncAt: flag('--since') }, { now, staleDays });
    if (args.includes('--json')) process.stdout.write(JSON.stringify(p, null, 2) + '\n');
    else {
      console.log(`# Environment scan — ${p.project || '(all projects)'} · ${p.asOf}`);
      for (const s of p.steps) {
        console.log(`\n## ${s.id}${s.stale ? '  [STALE]' : ''}\n${s.title}`);
        for (const pf of s.preflight || []) console.log(`  first: ${pf}`);
        if (s.resolveFirst) console.log(`  resolve: ${s.resolveFirst.tool} ${JSON.stringify(s.resolveFirst.args)} — ${s.resolveFirst.note}`);
        if (s.tool) console.log(`  call: ${s.tool} ${JSON.stringify(s.args)}`);
        if (s.map) console.log(`  save as candidates.${s.candidatesKey}: ${s.map}`);
      }
      console.log('\n## Checklist');
      for (const c of p.checklist) console.log(c);
    }
  } else if (cmd === 'register' && pos[0]) {
    let scan;
    try { scan = JSON.parse(fs.readFileSync(pos[0], 'utf8')); } catch (e) { console.error(`env_scan: cannot read scan ${pos[0]}: ${e.message}`); process.exit(1); }
    const r = registerScan(registry, scan, { now, staleDays });
    if (args.includes('--write')) fs.writeFileSync(regPath, JSON.stringify(r.registry, null, 2) + '\n');
    else process.stdout.write(JSON.stringify(r.registry, null, 2) + '\n');
    console.error(JSON.stringify({ updated: r.updated, added: r.added.map(a => `${a.kind}:${a.name}`), stale: r.stale.map(s => s.id) }));
  } else {
    console.error('usage: env_scan.mjs plan [--project name] [--job id] [--since ISO] | register <scan.json> [--write]   (see header)');
    process.exit(1);
  }
}
