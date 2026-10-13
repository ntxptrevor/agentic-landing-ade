#!/usr/bin/env node
// Lightweight validator for bidforge.sync.v1 bundles and bidforge.canonical.v1 documents
// (no dependencies). Exit 1 on any error.
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: validate_bundle.mjs <sync-bundle.json|canonical.json>'); process.exit(1); }
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };
const TYPES = ['actual_dates', 'add_event', 'duration_change', 'resequence', 'milestone_move', 'tracker_update', 'jobtread_manual_edit', 'note'];

if (doc.schema === 'bidforge.sync.v1') {
  need(doc.window?.to, 'window.to missing');
  need(Array.isArray(doc.sources), 'sources must be an array');
  const srcIds = new Set((doc.sources || []).map(s => s.id));
  const ids = new Set();
  for (const it of doc.items || []) {
    need(!ids.has(it.id), `duplicate item id ${it.id}`); ids.add(it.id);
    need(srcIds.has(it.sourceId), `${it.id}: unknown sourceId ${it.sourceId}`);
    need(TYPES.includes(it.type), `${it.id}: bad type ${it.type}`);
    need([1, 2, 3].includes(it.priority), `${it.id}: priority must be 1-3`);
    need([1, 2, 3, 4, 5].includes(it.jevRating), `${it.id}: jevRating must be 1-5`);
    need(it.summary, `${it.id}: summary missing`);
    if (it.type === 'milestone_move') { need(it.priority === 3, `${it.id}: milestone moves are priority 3`); need(it.jevRating >= 4, `${it.id}: milestone moves rate ≥4`); need(it.newDate && it.taskId, `${it.id}: taskId/newDate required`); }
    if (['actual_dates', 'duration_change', 'resequence', 'jobtread_manual_edit'].includes(it.type)) need(it.taskId, `${it.id}: taskId required`);
    if (it.type === 'add_event') need(it.name && it.date, `${it.id}: name/date required`);
    if (it.type === 'tracker_update') need(it.tracker && it.record?.id, `${it.id}: tracker/record.id required`);
  }
  if (doc.codaBackup) {
    need(['written', 'unchanged', 'mismatch', 'failed', 'skipped'].includes(doc.codaBackup.status), `codaBackup.status invalid: ${doc.codaBackup.status}`);
    need(doc.codaBackup.at, 'codaBackup.at missing');
  } else {
    console.warn('! no codaBackup result — every sync event must back the Project Coda up to JobTread "Notes"');
  }
} else if (doc.schema === 'bidforge.canonical.v1') {
  need(['uploaded', 'acknowledged_none'].includes(doc.requirements?.status), 'requirements gate not satisfied');
  need(Array.isArray(doc.wbs) && doc.wbs.length, 'wbs empty');
  const ids = new Set(doc.wbs.flatMap(p => p.children.map(t => t.id)));
  for (const t of doc.wbs.flatMap(p => p.children)) for (const p of t.predecessors || []) need(ids.has(p), `${t.id}: predecessor ${p} missing`);
  need(Array.isArray(doc.changelog) && doc.changelog.length, 'changelog empty');
} else {
  errors.push(`unknown schema ${doc.schema}`);
}
if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log(`✓ ${doc.schema} valid`);
