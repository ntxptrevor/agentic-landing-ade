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
];

export function emptyCoda() {
  return {
    version: 0, updatedAt: null,
    canonicalSchedule: '', kb: '', drive: '', jobtread: '', quickbooks: '', hosted: '',
    meetingSources: 'Plaud / Gemini Meetings folder / Google Calendar',
    models: 'orchestrator per mini-JEV router; logistics low tier; judgment frontier',
    syncCadence: 'daily JobTread pull 6:47 CT Mon-Sat; full sync on SYNC',
    council: '',
  };
}

// FNV-1a over the Coda content lines only (not timestamps), so the hash changes only
// when the Coda itself changes.
export function codaHash(coda) {
  const s = CODA_FIELDS.map(([k]) => `${k}=${coda?.[k] ?? ''}`).join('\n') + `\nv=${coda?.version ?? 0}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

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

// Replace the previous block (if any) and keep everything the team wrote.
export function mergeNotes(existing, block) {
  const text = String(existing ?? '');
  const s = text.indexOf(CODA_START);
  const e = s >= 0 ? text.indexOf(CODA_END, s) : -1;
  const human = s >= 0 && e >= 0
    ? (text.slice(0, s) + text.slice(e + CODA_END.length)).replace(/\n{3,}/g, '\n\n').trim()
    : text.trim();
  return human ? `${human}\n\n${block}` : block;
}

export function humanNotes(existing) {
  return mergeNotes(existing, '').trim();
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
  };
}
