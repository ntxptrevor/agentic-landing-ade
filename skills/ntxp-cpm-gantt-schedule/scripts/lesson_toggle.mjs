#!/usr/bin/env node
// Mark a lesson removed / applied in knowledge/lessons-learned.md and report everything tagged
// with it (council audit #3, A-33 / F-20). Never deletes code: it lists what to remove.
//
//   node lesson_toggle.mjs list [--lessons md]
//   node lesson_toggle.mjs <LL-id> removed|applied [--by <name>] [--date YYYY-MM-DD] [--reason "…"]
//        [--lessons md] [--repo <root>] [--canonical c.json …] [--write] [--json]
//
// - Whole entry: its "Status:" line becomes "removed (<date>, <by>: <reason>; was: <old status>)"
//   (or "applied (…)"). History is never deleted.
// - A member of a range entry (e.g. LL-2026-10-13-23 inside "22…25"): a "Member status:" line is
//   added under Status instead, so the rest of the range keeps its status.
// - Lists every tagged row/link: source lines in web/src (data files, jevTree, calibration…) that
//   mention the id, and tasks / dependencies tagged `lesson` in the given canonicals, plus the
//   entry's "Remove by:" instruction. --write saves lessons-learned.md (otherwise a dry run).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { view } from './lib/canonical_read.mjs';
import { parseLessons, findLesson, statusKind } from './lib/lessons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LESSONS = path.resolve(HERE, '../knowledge/lessons-learned.md');
const DEFAULT_REPO = path.resolve(HERE, '../../..');

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (/\.(m?js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Source references: exact id, or the range id the entry uses (e.g. "LL-22…25" shorthand in comments).
export function findReferences(repo, ids, shorthand = []) {
  const refs = [];
  const roots = [path.join(repo, 'web/src'), path.join(repo, 'skills/ntxp-cpm-gantt-schedule/scripts')];
  const needles = [...ids, ...shorthand];
  for (const f of roots.flatMap(r => walkFiles(r))) {
    if (/lesson_toggle|lessons_metrics|\.test\.mjs$/.test(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (needles.some(n => line.includes(n))) refs.push({ file: path.relative(repo, f), line: i + 1, text: line.trim().slice(0, 200) });
    });
  }
  return refs;
}

export function canonicalRefs(docs, ids) {
  const out = [];
  for (const { path: p, doc } of docs) {
    const v = view(doc);
    const has = x => x && String(x).split(/[,\s]+/).some(t => ids.includes(t));
    for (const t of v.tasks) if (has(t.lesson)) out.push({ canonical: p, kind: 'task', id: t.id, name: t.name });
    const deps = [...(Array.isArray(v.project.dependencies) ? v.project.dependencies : []), ...(Array.isArray(doc.dependencies) ? doc.dependencies : [])];
    for (const d of deps) if (has(d.lesson)) out.push({ canonical: p, kind: 'link', from: d.from ?? d.predecessor, to: d.to ?? d.successor, type: d.type || 'FS' });
    for (const t of v.tasks) for (const pr of Array.isArray(t.predecessors) ? t.predecessors : []) if (pr && typeof pr === 'object' && has(pr.lesson)) out.push({ canonical: p, kind: 'link', from: pr.id ?? pr.taskId, to: t.id, type: pr.type || 'FS' });
  }
  return out;
}

export function toggleLesson(md, id, action, { by = 'user', date = new Date().toISOString().slice(0, 10), reason = '' } = {}) {
  const lessons = parseLessons(md);
  const l = findLesson(lessons, id);
  if (!l) throw new Error(`lesson ${id} not found`);
  if (l.statusLine < 0) throw new Error(`lesson ${l.id} has no Status: line`);
  const lines = md.split('\n');
  const note = `${date}, ${by}${reason ? `: ${reason}` : ''}`;
  const whole = l.id === id || l.ids.length === 1;
  if (whole) {
    const old = lines[l.statusLine];
    const scope = old.match(/(\s{2,}Scope:.*)$/)?.[1] || '';
    lines[l.statusLine] = `Status: ${action} (${note}; was: ${l.status})${scope}`;
  } else {
    lines.splice(l.statusLine + 1, 0, `Member status: ${id} ${action} (${note})`);
  }
  return { md: lines.join('\n'), entry: l, whole, previous: statusKind(l.status) };
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const VALUED = ['--by', '--date', '--reason', '--lessons', '--repo', '--canonical'];
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const multi = n => args.flatMap((a, i) => (a === n && args[i + 1] ? [args[i + 1]] : []));
  const pos = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
  const mdPath = flag('--lessons') || DEFAULT_LESSONS;
  try {
    const md = fs.readFileSync(mdPath, 'utf8');
    if (pos[0] === 'list') {
      for (const l of parseLessons(md)) console.log(`${l.id.padEnd(24)} ${statusKind(l.status).padEnd(20)} ${l.title}`);
      process.exit(0);
    }
    const [id, action] = pos;
    if (!/^LL-\d{4}-\d{2}-\d{2}-\d{2}/.test(id || '') || !['removed', 'applied'].includes(action)) {
      console.error('usage: lesson_toggle.mjs list | <LL-id> removed|applied [--by name] [--reason …] [--canonical c.json] [--write] [--json]');
      process.exit(1);
    }
    const r = toggleLesson(md, id, action, { by: flag('--by'), date: flag('--date'), reason: flag('--reason') });
    const ids = r.whole ? r.entry.ids : [id];
    const shorthand = r.whole && r.entry.ids.length > 1 ? [r.entry.id, `LL-${r.entry.ids[0].slice(-2)}…${r.entry.ids.at(-1).slice(-2)}`] : [];
    const refs = findReferences(flag('--repo') || DEFAULT_REPO, ids, shorthand);
    const docs = multi('--canonical').map(p => ({ path: p, doc: JSON.parse(fs.readFileSync(p, 'utf8')) }));
    const rows = canonicalRefs(docs, ids);
    if (args.includes('--write')) fs.writeFileSync(mdPath, r.md);
    const report = { id, action, entry: r.entry.id, title: r.entry.title, previous: r.previous, wholeEntry: r.whole, written: args.includes('--write'), removeBy: r.entry.removeBy, sourceReferences: refs, canonicalRows: rows };
    if (args.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else {
      console.log(`${id} → ${action}${r.whole ? '' : ` (member of ${r.entry.id})`} — ${r.entry.title}${args.includes('--write') ? '' : '   [dry run: add --write to save lessons-learned.md]'}`);
      if (r.entry.removeBy) console.log(`Remove by: ${r.entry.removeBy}`);
      console.log(`Source references (${refs.length}) — edit these to ${action === 'removed' ? 'remove' : 'restore'} the lesson (this tool deletes nothing):`);
      for (const x of refs) console.log(`  ${x.file}:${x.line}  ${x.text}`);
      if (docs.length) { console.log(`Canonical rows/links tagged (${rows.length}):`); for (const x of rows) console.log(`  ${x.canonical}: ${x.kind} ${x.kind === 'task' ? `${x.id} ${x.name}` : `${x.from} → ${x.to} ${x.type}`}`); }
    }
  } catch (e) { console.error(`lesson_toggle: ${e.message}`); process.exit(1); }
}
