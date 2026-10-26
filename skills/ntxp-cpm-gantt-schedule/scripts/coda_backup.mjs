#!/usr/bin/env node
// Project Coda -> JobTread job custom field "Notes" (backup on every sync event).
//
//   build:   node coda_backup.mjs build  canonical.json current_notes.txt <event> [--job <id>] [--field Notes]
//            -> JSON { status:'ready', form, notes, block, hash, changed, chars, mutation, readBack }
//            -> exit 4 + JSON { status:'skipped', reason:'notes_too_long', budget, minChars, jevRating:3,
//               message, mutation:null, codaBackup } when the team's notes leave no room for even
//               the minimal block (head + Live schedule + KB + END). Nothing is written then.
//   verify:  node coda_backup.mjs verify expected.json readback.json
//            -> exit 0 when the read-back Notes equals the built value
//   restore: node coda_backup.mjs restore current_notes.txt
//            -> JSON { coda, tampered, writtenAt } parsed from the Notes block (KB missing Coda)
//
// current_notes.txt may be "-" for an empty field. Text outside the Coda markers is never changed.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = path.dirname(new URL(import.meta.url).pathname);
const lib = await import(pathToFileURL(path.resolve(here, '../../../web/src/utils/codaBackup.js')).href);
const [cmd, ...args] = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const readNotes = p => (!p || p === '-' ? '' : fs.readFileSync(p, 'utf8'));

if (cmd === 'build') {
  const [canonPath, notesPath, event = 'sync'] = args;
  const doc = JSON.parse(fs.readFileSync(canonPath, 'utf8'));
  const hasCoda = !!(doc.coda && (doc.coda.version || doc.coda.kb || doc.coda.jobtread));
  const coda = hasCoda ? doc.coda : lib.codaFromLinks(doc.project || {}, doc.project?.name);
  const jobId = flag('--job', doc.project?.jobtreadJobId);
  const field = flag('--field', lib.CODA_FIELD_NAME);
  if (!jobId) { console.error('No JobTread job id (canonical project.jobtreadJobId or --job).'); process.exit(2); }
  const existing = readNotes(notesPath);
  const last = (doc.changelog || []).slice(-1)[0];
  // The team's notes and the block share the field's 1,024-character limit.
  const budget = lib.codaBudget(existing);
  const fit = lib.fitCodaBlock(coda, { event, canonicalVersion: doc.version || 0, lastChange: last?.id || '', maxChars: budget });
  if (!fit.ok) {
    // Never truncate the team's notes and never slice the block: write nothing, rate 3.
    const humanChars = lib.humanNotes(existing).length;
    const message = `Coda backup skipped: the team's Notes use ${humanChars} of ${lib.NOTES_FIELD_LIMIT} characters, leaving ${Math.max(0, budget)}; the smallest Coda block needs ${fit.minChars}. Shorten the team notes in JobTread (the Coda stays in the project KB).`;
    process.stdout.write(JSON.stringify({
      jobId, field, event, status: 'skipped', reason: fit.reason, budget: fit.budget, minChars: fit.minChars, jevRating: 3,
      message, mutation: null, readBack: null,
      codaBackup: { status: 'skipped', lastAt: new Date().toISOString(), lastHash: lib.codaHash(coda), error: `notes_too_long: ${message}` },
    }, null, 2) + '\n');
    console.error(message);
    process.exit(4);
  }
  const block = fit.block;
  const notes = lib.mergeNotes(existing, block);
  const prior = lib.parseCodaBlock(existing);
  const hash = lib.codaHash(coda);
  const out = {
    jobId, field, event, status: 'ready', form: fit.form, budget, hash, chars: notes.length, blockChars: block.length,
    changed: !prior || prior.actualHash !== hash,
    priorTampered: !!prior?.tampered,
    humanNotesPreserved: lib.preservesTeamNotes(existing, notes),
    // When the canonical file had no Coda, this derived Coda must be saved as the canonical
    // Coda (updateCoda) so the backup hash matches it.
    derivedCoda: hasCoda ? null : coda,
    notes, block,
    mutation: { updateJob: { $: { id: jobId, customFieldValues: { [field]: notes } } } },
    readBack: { job: { $: { id: jobId }, customFieldValues: { $: { size: 50 }, nodes: { value: {}, customField: { name: {} } } } } },
  };
  if (!out.humanNotesPreserved) { console.error('Refusing: merge would alter text outside the Coda block.'); process.exit(3); }
  process.stdout.write(JSON.stringify(out, null, 2));
} else if (cmd === 'verify') {
  const [expectedPath, readbackPath] = args;
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const rb = JSON.parse(fs.readFileSync(readbackPath, 'utf8'));
  const nodes = rb?.job?.customFieldValues?.nodes || [];
  const val = nodes.find(n => n.customField?.name === expected.field)?.value ?? '';
  const ok = val === expected.notes;
  console.log(JSON.stringify({ status: ok ? 'written' : 'mismatch', hash: expected.hash, chars: val.length, event: expected.event, at: new Date().toISOString(), error: ok ? null : `read-back differs (${val.length} vs ${expected.notes.length} chars${val.length < expected.notes.length ? ' — possible field length limit' : ''})` }));
  process.exit(ok ? 0 : 1);
} else if (cmd === 'restore') {
  const parsed = lib.parseCodaBlock(readNotes(args[0]));
  if (!parsed) { console.error('No Coda block in Notes.'); process.exit(1); }
  process.stdout.write(JSON.stringify(parsed, null, 2));
} else {
  console.error('usage: coda_backup.mjs build|verify|restore … (see header)');
  process.exit(1);
}
