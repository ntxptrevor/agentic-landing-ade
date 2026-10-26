#!/usr/bin/env node
// Write guard for derived copies (council audit #3, A-35). Run before every Drive / JobTread /
// Lightfield / site / KB write of a canonical-derived artifact.
//
//   check:  node write_guard.mjs check <canonical.json> <target> [--observed-version N] [--observed-hash H] [--json]
//           Compares the canonical about to be written with what the target already holds:
//           canonical sync.targets[<target>] = {version, hash, at} (recorded after the last write),
//           raised by an observed version read from the target itself (Drive file name v<N>, the
//           Coda block "schedule v<N>", the site's project version, the last Lightfield note title).
//             exit 0 action "write"  — canonical is newer (or the target was never written)
//             exit 0 action "skip"   — same version and same hash: the target is already current
//             exit 2 action "refuse" — the target holds a NEWER version, or the same version with a
//                                      different hash (a fork): pull/reconcile first, never overwrite
//           Prints the record to save after a successful write.
//   record: node write_guard.mjs record <canonical.json> <target> [--write | --out f] [--at ISO]
//           Sets sync.targets[<target>] = {version, hash, at} (no version bump: sync metadata).
//   hash:   node write_guard.mjs hash <canonical.json>   → content hash (sha-256, sync excluded)
// Targets: drive, jobtread, jobtread-notes, lightfield, site, kb.
import fs from 'node:fs';
import crypto from 'node:crypto';

export const TARGETS = ['drive', 'jobtread', 'jobtread-notes', 'lightfield', 'site', 'kb'];

const stable = v => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
    : JSON.stringify(v ?? null));

// Content hash of the schedule itself: `sync` (targets, push records, timestamps) is excluded so
// recording a write never changes the hash.
export function canonicalHash(doc) {
  const strip = o => { if (!o || typeof o !== 'object') return o; const { sync, ...rest } = o; return rest; };
  const d = strip(doc);
  if (d.meta && typeof d.meta === 'object') d.meta = strip(d.meta);
  return crypto.createHash('sha256').update(stable(d)).digest('hex');
}

const holderOf = doc => (doc.meta && typeof doc.meta === 'object' && doc.meta.version !== undefined ? doc.meta : doc);
export const versionOf = doc => Number(holderOf(doc).version ?? doc.version ?? 0) || 0;

export function checkWrite(doc, target, { observedVersion, observedHash } = {}) {
  if (!TARGETS.includes(target)) throw new Error(`unknown target "${target}" (${TARGETS.join(', ')})`);
  const version = versionOf(doc);
  const hash = canonicalHash(doc);
  const rec = (holderOf(doc).sync || doc.sync || {}).targets?.[target] || null;
  let held = rec ? { version: Number(rec.version) || 0, hash: rec.hash || null, source: 'record' } : null;
  if (observedVersion !== undefined && observedVersion !== null && observedVersion !== '' && (!held || Number(observedVersion) >= held.version)) {
    held = { version: Number(observedVersion), hash: observedHash || (held && Number(observedVersion) === held.version ? held.hash : null), source: 'observed' };
  }
  const record = { version, hash, at: new Date().toISOString() };
  if (!held) return { action: 'write', reason: `${target} has no recorded write — first write`, version, hash, held, record };
  if (held.version > version) return { action: 'refuse', reason: `${target} already holds v${held.version} (${held.source}); canonical is v${version} — load the latest canonical / pull the target first, never write an older version`, version, hash, held, record: null };
  if (held.version === version) {
    if (held.hash && held.hash !== hash) return { action: 'refuse', reason: `${target} holds v${version} with a different hash — fork; reconcile before writing`, version, hash, held, record: null };
    if (held.hash === hash) return { action: 'skip', reason: `${target} already holds v${version} (same hash)`, version, hash, held, record: null };
    return { action: 'write', reason: `${target} holds v${version} (hash unknown) — rewrite allowed`, version, hash, held, record };
  }
  return { action: 'write', reason: `${target} holds v${held.version}; canonical v${version} is newer`, version, hash, held, record };
}

export function recordWrite(doc, target, { at = new Date().toISOString() } = {}) {
  if (!TARGETS.includes(target)) throw new Error(`unknown target "${target}"`);
  const out = structuredClone(doc);
  const h = holderOf(out);
  h.sync = h.sync || {};
  h.sync.targets = { ...(h.sync.targets || {}), [target]: { version: versionOf(out), hash: canonicalHash(out), at } };
  return out;
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(new URL(import.meta.url).pathname); } catch { return false; } })();
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const VALUED = ['--observed-version', '--observed-hash', '--out', '--at'];
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const pos = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
  try {
    const doc = pos[0] ? JSON.parse(fs.readFileSync(pos[0], 'utf8')) : null;
    if (cmd === 'hash' && doc) { console.log(canonicalHash(doc)); process.exit(0); }
    if (cmd === 'check' && doc && pos[1]) {
      const r = checkWrite(doc, pos[1], { observedVersion: flag('--observed-version'), observedHash: flag('--observed-hash') });
      if (args.includes('--json')) process.stdout.write(JSON.stringify({ target: pos[1], ...r }, null, 2) + '\n');
      else {
        console.log(`write_guard ${pos[1]}: ${r.action.toUpperCase()} — ${r.reason}`);
        if (r.record) console.log(`after the write, save: sync.targets["${pos[1]}"] = ${JSON.stringify(r.record)}  (node write_guard.mjs record ${pos[0]} ${pos[1]} --write)`);
      }
      process.exit(r.action === 'refuse' ? 2 : 0);
    }
    if (cmd === 'record' && doc && pos[1]) {
      const out = recordWrite(doc, pos[1], { at: flag('--at') || undefined });
      const text = JSON.stringify(out, null, 2) + '\n';
      if (args.includes('--write')) fs.writeFileSync(pos[0], text);
      else if (flag('--out')) fs.writeFileSync(flag('--out'), text);
      else process.stdout.write(text);
      console.error(`recorded sync.targets["${pos[1]}"] = ${JSON.stringify(holderOf(out).sync.targets[pos[1]])}`);
      process.exit(0);
    }
    console.error('usage: write_guard.mjs check <canonical.json> <target> [--observed-version N] [--observed-hash H] | record <canonical.json> <target> [--write|--out f] | hash <canonical.json>');
    process.exit(1);
  } catch (e) { console.error(`write_guard: ${e.message}`); process.exit(1); }
}
