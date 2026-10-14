// Project Coda backup block for the JobTread job custom field "Notes".
// The block is appended to whatever the team already wrote in Notes and is the only
// part ever rewritten; text outside the markers is preserved byte-for-byte.
// Shared by the web app and skills/bidforge-schedules/scripts/coda_backup.mjs.

export const CODA_START = '=== NTXP PROJECT CODA (BidForge backup) ';
export const CODA_END = '=== END NTXP PROJECT CODA ===';
export const CODA_FIELD_NAME = 'Notes';
// Soft budget: keeps room for the team's own notes in a plain text custom field.
export const CODA_MAX_CHARS = 1800;

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
    instructions: 'Open the Live schedule link for the current version. Change dates only through /bidforge-schedules (sync, input, or the live page then SYNC). Ask schedule questions with schedule_query.mjs. Never edit Drive or JobTread copies.',
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

export function buildCodaBlock(coda, { event = 'sync', at = new Date().toISOString(), canonicalVersion = 0, lastChange = '' } = {}) {
  const lines = CODA_FIELDS.map(([k, label]) => `${label}: ${clean(coda[k]) || 'not located'}`);
  const head = `${CODA_START}v${coda.version || 0} · ${at.slice(0, 16)}Z · sha:${codaHash(coda)} ===`;
  const foot = [
    `Last sync: ${at.slice(0, 16)}Z (${event}) · schedule v${canonicalVersion}${lastChange ? ` · ${lastChange}` : ''}`,
    'Regenerated on every BidForge sync — edit the Coda in the project KB, not here.',
    CODA_END,
  ];
  let block = [head, ...lines, ...foot].join('\n');
  if (block.length > CODA_MAX_CHARS) {
    // Compact form: truncate each value, keep every label so a restore still works.
    const per = Math.max(24, Math.floor((CODA_MAX_CHARS - head.length - foot.join('\n').length) / CODA_FIELDS.length) - 20);
    block = [head.replace(' ===', ' · compact ==='), ...CODA_FIELDS.map(([k, label]) => `${label}: ${(clean(coda[k]) || 'not located').slice(0, per)}`), ...foot].join('\n');
  }
  return block;
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
