// Project Coda backup block for the JobTread job custom field "Notes".
// The block is appended to whatever the team already wrote in Notes and is the only
// part ever rewritten; text outside the markers is preserved byte-for-byte.
// Shared by the web app and skills/ntxp-cpm-gantt-schedules/scripts/coda_backup.mjs.

export const CODA_START = '=== NTXP PROJECT CODA (BidForge backup) ';
export const CODA_END = '=== END NTXP PROJECT CODA ===';
export const CODA_FIELD_NAME = 'Notes';
// JobTread text custom fields hold at most 1,024 characters (verified by a live write,
// 2026-10-14) — the team's notes and the Coda block share that budget.
export const NOTES_FIELD_LIMIT = 1024;
export const CODA_MAX_CHARS = NOTES_FIELD_LIMIT;
// Kept whole in every compact form; other fields are added only while they fit whole.
const CODA_ESSENTIAL = ['liveSchedule', 'kb', 'jobtread', 'drive'];

export const CODA_FIELDS = [
  ['liveSchedule', 'Live schedule (HTML)'],
  ['canonicalSchedule', 'Canonical schedule'],
  ['kb', 'Knowledge base'],
  ['drive', 'Drive folder'],
  ['jobtread', 'JobTread job'],
  ['quickbooks', 'QuickBooks'],
  ['hosted', 'Hosted'],
  ['meetingSources', 'Meeting sources'],
  ['models', 'Default models'],
  ['syncCadence', 'Sync cadence'],
  ['council', 'Council'],
  ['instructions', 'Instructions'],
];

export function emptyCoda() {
  return {
    version: 0, updatedAt: null,
    liveSchedule: '',
    canonicalSchedule: '', kb: '', drive: '', jobtread: '', quickbooks: '', hosted: '',
    meetingSources: 'Plaud / Gemini Meetings folder / Google Calendar',
    models: 'orchestrator per mini-JEV router; logistics low tier; judgment frontier',
    syncCadence: 'daily JobTread pull 6:47 CT Mon-Sat; full sync on SYNC',
    council: '',
    // Persistent instructions, rewritten on every sync so the Coda always points at the live schedule.
    instructions: 'Open the Live schedule link for the current version. Change dates only through /ntxp-cpm-gantt-schedules (sync, input, or the live page then SYNC). Ask schedule questions with schedule_query.mjs. Never edit Drive or JobTread copies.',
  };
}

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

// FNV-1a over the Coda content lines only (not timestamps), so the hash changes only
// when the Coda itself changes.
export function codaHash(coda) {
  // Hash the values exactly as they are serialized into the block, so an untouched block
  // always re-hashes to its declared value.
  const s = CODA_FIELDS.map(([k]) => `${k}=${clean(coda?.[k])}`).join('\n') + `\nv=${coda?.version ?? 0}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Short, fixed instructions used by every compact form (the full text lives in the KB Coda).
export const CODA_SHORT_INSTRUCTIONS = 'Use the Live schedule link; change dates only via BidForge.';
// The smallest block ever written: head marker + Live schedule + Knowledge base + END marker.
// When even that does not fit beside the team's notes, nothing is written (notes_too_long).

// Builds the largest form that fits in maxChars. Never slices through a marker: every block
// returned contains CODA_START…CODA_END, and its length is <= maxChars.
//   → { ok: true, block, form: 'full' | 'compact' | 'minimal', chars }
//   → { ok: false, reason: 'notes_too_long', budget, minChars } when the minimal block does not fit
export function fitCodaBlock(coda, { event = 'sync', at = new Date().toISOString(), canonicalVersion = 0, lastChange = '', maxChars = CODA_MAX_CHARS } = {}) {
  const budget = Math.floor(Number(maxChars));
  const line = (k, label) => `${label}: ${clean(coda[k]) || 'not located'}`;
  const lines = CODA_FIELDS.map(([k, label]) => line(k, label));
  const head = `${CODA_START}v${coda.version || 0} · ${at.slice(0, 16)}Z · sha:${codaHash(coda)} ===`;
  const foot = [
    `Last sync: ${at.slice(0, 16)}Z (${event}) · schedule v${canonicalVersion}${lastChange ? ` · ${lastChange}` : ''}`,
    'Regenerated on every BidForge sync — edit the Coda in the project KB, not here.',
    CODA_END,
  ];
  const ok = (block, form) => ({ ok: true, block, form, chars: block.length });
  const full = [head, ...lines, ...foot].join('\n');
  if (full.length <= budget) return ok(full, 'full');

  // Compact form: the essential links stay whole (the live schedule link above all) and the
  // instructions become the short fixed text. The other fields are added whole, in field order,
  // while they fit; a field that does not fit is left out (never truncated) and a restore takes
  // it from the KB Coda.
  const cHead = head.replace(' ===', ' · compact ===');
  const shortFoot = [`Last sync: ${at.slice(0, 16)}Z (${event}) · v${canonicalVersion}${lastChange ? ` · ${lastChange}` : ''}`, 'Full Coda in the project KB.', CODA_END];
  const instr = `Instructions: ${CODA_SHORT_INSTRUCTIONS}`;
  const keep = new Set(CODA_ESSENTIAL.concat('instructions'));
  const render = () => [cHead, ...CODA_FIELDS.filter(([k]) => keep.has(k)).map(([k, label]) => (k === 'instructions' ? instr : line(k, label))), ...shortFoot].join('\n');
  if (render().length <= budget) {
    for (const [k, label] of CODA_FIELDS) {
      if (keep.has(k) || !clean(coda[k])) continue;
      keep.add(k);
      if (render().length > budget) keep.delete(k);
    }
    return ok(render(), 'compact');
  }
  // Minimal form: head marker + live schedule + KB + END marker.
  const minimal = minimalCodaBlock(coda, { at });
  if (minimal.length <= budget) return ok(minimal, 'minimal');
  return { ok: false, reason: 'notes_too_long', budget, minChars: minimal.length };
}

// Block string for previews (no team notes). Always contains both markers; when maxChars is
// smaller than the minimal block, the minimal block is returned anyway — callers that must
// respect a budget (coda_backup.mjs) use fitCodaBlock and write nothing on notes_too_long.
export function buildCodaBlock(coda, opts = {}) {
  const r = fitCodaBlock(coda, opts);
  return r.ok ? r.block : minimalCodaBlock(coda, opts);
}

function minimalCodaBlock(coda, { at = new Date().toISOString() } = {}) {
  const head = `${CODA_START}v${coda.version || 0} · ${at.slice(0, 16)}Z · sha:${codaHash(coda)} · compact ===`;
  return [head, `Live schedule (HTML): ${clean(coda.liveSchedule) || 'not located'}`, `Knowledge base: ${clean(coda.kb) || 'not located'}`, CODA_END].join('\n');
}

// Room the team's notes leave for the block in the shared 1,024-character field
// (the block is separated from the notes by up to two newlines).
export function codaBudget(existingNotes, limit = NOTES_FIELD_LIMIT) {
  return limit - humanNotes(existingNotes).length - 2;
}

function blockSpan(text) {
  const s = text.indexOf(CODA_START);
  const e = s >= 0 ? text.indexOf(CODA_END, s) : -1;
  return s >= 0 && e >= 0 ? [s, e + CODA_END.length] : null;
}

// Replace the previous block in place, or append one. Every byte outside the block is kept
// exactly as the team wrote it (no trimming or whitespace normalization).
export function mergeNotes(existing, block) {
  const text = String(existing ?? '');
  const span = blockSpan(text);
  if (span) return text.slice(0, span[0]) + block + text.slice(span[1]);
  if (!text) return block;
  return text + (text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n') + block;
}

// True when `next` differs from `existing` only inside the Coda block (plus the separator
// added on first append).
export function preservesTeamNotes(existing, next) {
  const before = String(existing ?? '');
  const after = String(next ?? '');
  const a = blockSpan(before);
  const b = blockSpan(after);
  if (!b) return false;
  if (a) return before.slice(0, a[0]) === after.slice(0, b[0]) && before.slice(a[1]) === after.slice(b[1]);
  return after.slice(0, before.length) === before && /^\n{0,2}$/.test(after.slice(before.length, b[0])) && b[1] === after.length;
}

// The team's text with the Coda block removed (exact bytes, separator left in place).
export function humanNotes(existing) {
  const text = String(existing ?? '');
  const span = blockSpan(text);
  return span ? text.slice(0, span[0]) + text.slice(span[1]) : text;
}

// Parse a block back into a Coda (restore path). Returns null when no block exists.
export function parseCodaBlock(notes) {
  const text = String(notes ?? '');
  const s = text.indexOf(CODA_START);
  const e = s >= 0 ? text.indexOf(CODA_END, s) : -1;
  if (s < 0 || e < 0) return null;
  const body = text.slice(s, e).split('\n');
  const head = body[0];
  const coda = emptyCoda();
  coda.version = Number(head.match(/ v(\d+) /)?.[1] || 0);
  const at = head.match(/· (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})Z/)?.[1];
  for (const line of body.slice(1)) {
    const i = line.indexOf(': ');
    if (i < 0) continue;
    const label = line.slice(0, i);
    const field = CODA_FIELDS.find(([, l]) => l === label);
    if (field) coda[field[0]] = line.slice(i + 2) === 'not located' ? '' : line.slice(i + 2);
  }
  const declared = head.match(/sha:([0-9a-f]{8})/)?.[1] || null;
  const compact = head.includes('· compact');
  return { coda, compact, declaredHash: declared, actualHash: codaHash(coda), tampered: !compact && !!declared && declared !== codaHash(coda), writtenAt: at ? `${at}:00Z` : null };
}

// Coda from canonical links when the KB has no Coda yet.
export function codaFromLinks(links = {}, projectName = '') {
  return {
    ...emptyCoda(),
    canonicalSchedule: links.kbPath ? `${links.kbPath}/schedule/canonical.json` : '',
    kb: links.kbPath || '',
    drive: [links.driveFolderName, links.driveFolderId].filter(Boolean).join(' '),
    jobtread: [projectName, links.jobtreadJobId].filter(Boolean).join(' '),
    quickbooks: links.quickbooksProjectId || '',
    hosted: links.hostUrl || '',
    liveSchedule: links.liveUrl || (links.slug ? `https://schedule.ntxpllc.com/?project=${links.slug}` : ''),
  };
}
