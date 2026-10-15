// Canonical Project Schedule — one source of truth that the knowledge base, the
// Google Drive folder and JobTread are all derived from. Every mutation goes
// through logChange so the changelog stays complete and auditable.
//
// Changelog contract (shared with the skill scripts):
// - ids are CHG-<NNNN> from the counter meta.chgSeq (old ids are still read: the next id is
//   always above every existing CHG number and the changelog length);
// - every entry carries `sources` [{type,title,url,date}] and `version` (canonical version
//   after the entry);
// - schedule-affecting entries bump meta.version; bookkeeping entries (OAC report, Coda backup,
//   held/acknowledged/dismissed sync items, skipped/tracked sync items) carry `noVersion: true`
//   and leave the version alone.

import { emptyCoda, codaHash } from './codaBackup.js';

export const CANONICAL_SCHEMA = 'bidforge.canonical.v1';
export const APPLIED_ITEM_IDS_CAP = 2000;

export function slugify(name) {
  return String(name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

export function emptyMeta() {
  return {
    schema: CANONICAL_SCHEMA,
    version: 0,
    chgSeq: 0,
    slug: '',
    status: 'bid',
    links: { jobtreadJobId: '', jobNumber: '', driveFolderId: '', driveFolderName: '', quickbooksProjectId: '', lightfieldId: '', kbPath: '', hostUrl: '', liveUrl: '' },
    requirements: { status: 'pending', documents: [], specText: '', acknowledgement: null },
    modules: [],
    scope: null,
    trackers: { rfis: [], submittals: [], asis: [], payApps: [], subInvoices: [], payAppCycleDay: 25 },
    changelog: [],
    inputs: [],
    optimizationChain: [],
    memory: [],
    coda: emptyCoda(),
    sync: { lastSyncAt: null, lastJobtreadPullAt: null, pending: [], appliedItemIds: [], codaBackup: { status: 'never', lastAt: null, lastHash: null, failures: 0 } },
  };
}

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

// Every changelog entry carries its context sources: [{type, title, url, date}]. A source
// without a link still names where the change came from and when.
export function sourceRef(type, title, url = '', date = new Date().toISOString().slice(0, 10)) {
  return { type, title, url: url || '', date };
}

// Union of source lists, deduplicated by type + title + url.
export function unionSources(...lists) {
  const seen = new Set();
  const out = [];
  for (const s of lists.flat(Infinity)) {
    if (!s || typeof s !== 'object') continue;
    const k = `${s.type}|${s.title}|${s.url || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// Rendered links: only http(s), mailto and same-site relative URLs ('/…', './…'); anything
// else (javascript:, data:, protocol-relative //host) renders as plain text.
export function safeHref(u) {
  const s = String(u ?? '').trim();
  if (!s) return '';
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  if (s.startsWith('./')) return s;
  if (s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\')) return s;
  return '';
}

const chgNum = id => { const m = /^CHG-(\d+)$/.exec(String(id || '')); return m ? Number(m[1]) : 0; };

// Next CHG sequence number: above meta.chgSeq, every existing CHG-<n> id and the changelog length.
export function nextChgSeq(meta) {
  let seq = Number(meta.chgSeq) || 0;
  const log = meta.changelog || [];
  seq = Math.max(seq, log.length);
  for (const e of log) seq = Math.max(seq, chgNum(e?.id));
  return seq + 1;
}

export function logChange(meta, entry) {
  const seq = nextChgSeq(meta);
  const noVersion = !!entry.noVersion;
  const version = noVersion ? (meta.version || 0) : (meta.version || 0) + 1;
  const sources = Array.isArray(entry.sources) && entry.sources.length
    ? entry.sources
    : [sourceRef('app', entry.source || entry.type || 'BidForge app')];
  const e = { id: `CHG-${String(seq).padStart(4, '0')}`, at: now(), actor: 'user', jevRating: 1, ...entry, sources, version };
  if (noVersion) e.noVersion = true; else delete e.noVersion;
  return { ...meta, chgSeq: seq, version, changelog: [...(meta.changelog || []), e] };
}

// Bookkeeping entry that is not a schedule change: unique CHG id, no version bump.
export function logActivity(meta, entry) {
  return logChange(meta, { ...entry, noVersion: true });
}

// Changelog entries newer than canonical version v (legacy entries without `version` are
// placed by walking back from meta.version).
export function entriesSinceVersion(meta, v) {
  const log = meta.changelog || [];
  const out = [];
  let cur = meta.version || 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    const ev = e.version != null ? e.version : cur;
    if (ev <= v) break;
    out.unshift(e);
    if (e.version != null) cur = e.noVersion ? e.version : e.version - 1;
    else if (!e.noVersion) cur -= 1;
  }
  return out;
}

// Task ids whose schedule data changed after canonical version v.
export function tasksChangedSince(meta, v) {
  const ids = new Set();
  for (const e of entriesSinceVersion(meta, v)) {
    if (e.noVersion || !e.target) continue;
    for (const part of String(e.target).split(/,\s*/)) {
      const id = part.trim().split(/\s+/)[0];
      if (id) ids.add(id);
    }
  }
  return ids;
}

// Project Coda edits (KB is primary; the JobTread "Notes" block is the backup).
export function updateCoda(meta, coda, source = 'environment') {
  const next = { ...coda, version: (meta.coda?.version || 0) + 1, updatedAt: now() };
  const m = logChange({ ...meta, coda: next }, {
    type: 'coda_updated', source, after: { version: next.version, hash: codaHash(next) },
    reason: 'Project Coda changed — JobTread Notes backup due on next sync', jevRating: 2,
    sources: [sourceRef('environment', 'Project Coda editor (Environment tab)')],
  });
  return markCodaBackupPending(m);
}

export function markCodaBackupPending(meta) {
  const cb = meta.sync?.codaBackup || {};
  return { ...meta, sync: { ...meta.sync, codaBackup: { ...cb, status: 'pending' } } };
}

// Result reported by the agent (or carried in a sync bundle) after writing Notes.
// Bookkeeping only: it never bumps the canonical version (a publish is itself a backup event).
export function recordCodaBackup(meta, result, sources = []) {
  const cb = meta.sync?.codaBackup || {};
  // A result only counts as a verified backup when it is for the Coda as it stands now;
  // a stale bundle or a result without a hash is recorded as a mismatch.
  if ((result.status === 'written' || result.status === 'unchanged') && result.hash !== codaHash(meta.coda || {})) {
    result = { ...result, status: 'mismatch', error: result.hash ? `backup sha ${result.hash} is not the current Coda (sha ${codaHash(meta.coda || {})})` : 'backup result has no hash' };
  }
  const ok = result.status === 'written' || result.status === 'unchanged';
  const failures = ok ? 0 : (cb.failures || 0) + 1;
  const m = { ...meta, sync: { ...meta.sync, codaBackup: { status: result.status, lastAt: result.at || now(), lastHash: result.hash || cb.lastHash, failures, error: ok ? null : result.error || 'unknown' } } };
  return logActivity(m, {
    type: 'coda_backup', source: `JobTread job custom field "Notes"${result.event ? ` (${result.event})` : ''}`, actor: 'sync',
    after: { status: result.status, hash: result.hash, chars: result.chars },
    reason: ok ? 'Project Coda backed up to JobTread' : `Coda backup failed (${failures} in a row): ${result.error || 'unknown'}`,
    jevRating: ok ? 1 : failures >= 3 ? 4 : 3,
    sources: unionSources(sources, [sourceRef('jobtread', 'JobTread job custom field "Notes"', '', String(result.at || now()).slice(0, 10))]),
  });
}

// The project KB activity stream (NTXP Plans-Atlas activity-stream schema): one entry per
// changelog entry, newest first, with provenance links.
export function toActivityEntries(meta, slug = '') {
  return [...meta.changelog].reverse().map(e => ({
    ts: e.at,
    source: 'schedule',
    kind: 'event',
    text: `${e.id} ${e.type}${e.target ? ` · ${e.target}` : ''}: ${e.reason || ''}`.slice(0, 400),
    link: (e.sources || []).map(s => safeHref(s.url)).find(Boolean) || (slug ? `/?project=${slug}` : ''),
    rating: e.jevRating || 1,
    critical: (e.jevRating || 1) >= 3,
    sources: e.sources || [],
  }));
}

// Folder routing (ntxp-folder-system): a pursuit saves under its bid folder, an awarded job
// under its project folder. Versions are immutable v<NNN>-<date> files in that folder.
export function routeFolder(name, status = 'bid') {
  return status === 'bid'
    ? { kind: 'bid', path: `!Active Bids/${name}/Schedules` }
    : { kind: 'project', path: `!Active Projects/${name}/06 - Schedule` };
}

// An awarded project ('active') is never routed back to 'bid' by a rebuild or a stale save.
export function keepAwarded(status, ...known) {
  return [status, ...known].includes('active') ? 'active' : (status || 'bid');
}

export function markAwarded(meta, { name, by = 'user', url = '' } = {}) {
  if (meta.status === 'active') return meta;
  const folder = routeFolder(name, 'active');
  return logChange({ ...meta, status: 'active' }, {
    type: 'status_changed', actor: by, source: 'project bar (Mark awarded)', target: name,
    before: { status: meta.status || 'bid', folder: routeFolder(name, meta.status || 'bid').path },
    after: { status: 'active', folder: folder.path },
    reason: `Project awarded — schedule versions now route to ${folder.path}`, jevRating: 3,
    sources: [sourceRef('user', `Marked awarded by ${by}`, url)],
  });
}

export function recordInput(meta, input) {
  return { ...meta, inputs: [...meta.inputs, { at: now(), ...input, excerpt: String(input.text || '').slice(0, 500) }] };
}

// "remember this", "save this to memory", "from now on", "always", "never again"
const MEMORY_RE = /\b(remember (this|that)|save (this|that)? ?to memory|from now on|going forward|always (use|do|schedule|put)|never (again|use|schedule|put))\b/i;

export function extractMemoryDirectives(text) {
  return String(text || '')
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(s => MEMORY_RE.test(s));
}

export function addMemory(meta, text, scope = 'project', source = null) {
  const entry = { at: now(), text, scope, status: 'pending_kb_write' };
  return logChange({ ...meta, memory: [...meta.memory, entry] }, {
    type: 'memory', source: 'user directive', after: text, reason: `Memory directive (${scope})`,
    sources: [source || sourceRef('conversation', 'User directive (Inputs tab)')],
  });
}

export function addOptimizationEntry(meta, entry) {
  return logChange(
    { ...meta, optimizationChain: [...meta.optimizationChain, { at: now(), ...entry }] },
    { type: 'optimization_confirmed', source: 'initialization', after: entry, reason: 'Environment optimization confirmed by user', sources: [sourceRef('environment', 'Environment optimization (initialization)')] },
  );
}

// The canonical project.slug is the routing slug the project is saved under (not
// slugify(name) when they differ).
export function canonicalSlug(project, meta, slug = '') {
  return slug || meta?.slug || slugify(project?.name);
}

export function buildCanonicalDocument(project, meta, slug = '') {
  const s = canonicalSlug(project, meta, slug);
  return {
    schema: CANONICAL_SCHEMA,
    generatedAt: now(),
    version: meta.version,
    chgSeq: meta.chgSeq || 0,
    status: meta.status || 'bid',
    folder: routeFolder(project.name, meta.status),
    project: {
      name: project.name,
      slug: s,
      startDate: project.startDate,
      endDate: project.endDate,
      workingDays: project.workingDays,
      holidays: project.holidays,
      hoursPerDay: project.hoursPerDay,
      ...meta.links,
    },
    requirements: meta.requirements,
    modules: meta.modules,
    scope: meta.scope,
    wbs: project.wbs,
    dependencies: project.dependencies,
    trackers: meta.trackers,
    changelog: meta.changelog,
    inputs: meta.inputs,
    optimizationChain: meta.optimizationChain,
    memory: meta.memory,
    coda: meta.coda,
    sync: meta.sync,
    activity: toActivityEntries(meta, s).slice(0, 200),
  };
}

// Browser copy of the canonical. Callers debounce; identical content is not rewritten.
// Returns { ok, skipped?, quota?, error? } so the app can surface a full quota.
let lastLocal = { slug: '', body: '' };
export function saveLocal(project, meta, slug = '') {
  try {
    const s = canonicalSlug(project, meta, slug);
    const doc = buildCanonicalDocument(project, meta, s);
    const stamp = doc.generatedAt;
    doc.generatedAt = '';
    const body = JSON.stringify(doc);
    if (lastLocal.slug === s && lastLocal.body === body) return { ok: true, skipped: true };
    localStorage.setItem(`bidforge.canonical.${s}`, body.replace('"generatedAt":""', `"generatedAt":"${stamp}"`));
    localStorage.setItem('bidforge.canonical.last', s);
    lastLocal = { slug: s, body };
    return { ok: true };
  } catch (e) {
    const quota = !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message || ''));
    return { ok: false, quota, error: e?.message || 'browser storage unavailable' };
  }
}

export function loadLocal() {
  try {
    const slug = localStorage.getItem('bidforge.canonical.last');
    if (!slug) return null;
    const raw = localStorage.getItem(`bidforge.canonical.${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const taskTotal = wbs => (Array.isArray(wbs) ? wbs : []).reduce((n, p) => n + (Array.isArray(p?.children) ? p.children.length : 0), 0);

// Split a canonical document back into app state. Accepts the flat schema written by
// buildCanonicalDocument and the nested { meta: {...}, project: { wbs, ... } } shape.
// Throws (never returns an empty v0 schedule) when the document has no WBS activities.
export function fromCanonicalDocument(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Not a canonical schedule document.');
  const nested = doc.meta && typeof doc.meta === 'object' ? doc.meta : null;
  const get = k => (nested && nested[k] !== undefined ? nested[k] : doc[k]);
  const proj = doc.project && typeof doc.project === 'object' ? doc.project : {};
  const wbsRaw = Array.isArray(proj.wbs) && proj.wbs.length ? proj.wbs : (Array.isArray(doc.wbs) ? doc.wbs : []);
  if (!taskTotal(wbsRaw)) {
    const flatTasks = Array.isArray(doc.tasks) || Array.isArray(proj.tasks);
    throw new Error(`Canonical "${proj.name || doc.name || 'unnamed'}" (v${get('version') ?? '?'}) has no WBS activities${flatTasks ? ' — it holds a flat "tasks" list instead of the bidforge.canonical.v1 "wbs"' : ''}. It was not loaded, so it cannot be saved over the stored version.`);
  }
  const meta = emptyMeta();
  for (const k of ['requirements', 'modules', 'scope', 'trackers', 'changelog', 'inputs', 'optimizationChain', 'memory', 'coda', 'sync']) {
    const v = get(k);
    if (v) meta[k] = v;
  }
  meta.sync = { pending: [], appliedItemIds: [], ...meta.sync };
  meta.version = Number(get('version')) || 0;
  meta.chgSeq = Number(get('chgSeq')) || 0;
  const status = get('status');
  if (status) meta.status = status;
  const { name, slug, startDate, endDate, workingDays, holidays, hoursPerDay, wbs: _w, dependencies: _d, ...flatLinks } = proj;
  const links = { ...flatLinks, ...(doc.links && typeof doc.links === 'object' ? doc.links : {}), ...(nested?.links && typeof nested.links === 'object' ? nested.links : {}) };
  for (const k of Object.keys(meta.links)) if (links[k]) meta.links[k] = links[k];
  meta.slug = slug || get('slug') || '';
  const wbs = wbsRaw.map(p => ({ ...p, children: Array.isArray(p.children) ? p.children : [] }));
  const project = {
    name: name || doc.name, startDate, endDate, workingDays, holidays: holidays || [], hoursPerDay: hoursPerDay || 8,
    wbs, dependencies: proj.dependencies || doc.dependencies || [], milestones: [],
  };
  return { project, meta };
}

// Save reason: a summary of every changelog entry since the last save, with the union of
// their sources.
export function changesSinceSave(meta, savedAt) {
  return (meta.changelog || []).filter(e => !savedAt || e.at > savedAt);
}

export function summarizeChanges(entries, fallback = 'Saved from schedule.ntxpllc.com') {
  const n = entries.length;
  if (!n) return { reason: fallback, sources: [] };
  const shown = entries.slice(-12).map(e => `${e.id} ${e.type}${e.reason ? `: ${e.reason}` : ''}`.slice(0, 160));
  const reason = `${n} change${n === 1 ? '' : 's'}: ${n > shown.length ? `(${n - shown.length} earlier) ` : ''}${shown.join('; ')}`;
  return { reason: reason.slice(0, 2000), sources: unionSources(entries.map(e => e.sources || [])).slice(0, 100) };
}

// ── Project identity (instant schedule must not create a second canonical) ──
const JOB_PREFIX = /^\s*#?\s*(?:[a-z]{1,6}-?)?\d[\w.-]*\s*[-–—·:|]*\s+/i;

export function normalizeProjectName(name) {
  return String(name || '').toLowerCase().replace(JOB_PREFIX, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeJobNumber(n) {
  return String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const leadingNumber = name => { const m = String(name || '').match(/^\s*#?\s*((?:[a-z]{1,6}-?)?\d[\w.-]*)\s*[-–—·:|]*\s+/i); return m ? m[1] : ''; };

// Existing KB projects that plausibly are the project being created: same job number, same
// normalized name, one name contained in the other, or strong token overlap.
export function matchProjects(projects, { name, number } = {}) {
  const n = normalizeProjectName(name);
  const num = normalizeJobNumber(number || leadingNumber(name));
  const toks = new Set(n.split(' ').filter(t => t.length > 2));
  const out = [];
  for (const p of projects || []) {
    if (!p || !p.slug) continue;
    const pn = normalizeProjectName(p.name);
    const pnum = normalizeJobNumber(p.number || leadingNumber(p.name));
    let why = '';
    if (num && pnum && num === pnum) why = 'same job number';
    else if (n && pn && n === pn) why = 'same name';
    else if (n && pn) {
      const [a, b] = n.length <= pn.length ? [n, pn] : [pn, n];
      if (a.length >= 6 && ` ${b} `.includes(` ${a} `)) why = 'name contains the other';
      else {
        const pt = new Set(pn.split(' ').filter(t => t.length > 2));
        const inter = [...toks].filter(t => pt.has(t)).length;
        const uni = new Set([...toks, ...pt]).size;
        if (uni && inter >= 2 && inter / uni >= 0.6) why = 'similar name';
      }
    }
    if (!why && normalizeJobNumber(slugify(name)) === normalizeJobNumber(p.slug)) why = 'same slug';
    if (why) out.push({ ...p, why });
  }
  return out;
}

// ── OAC gate (mirrors scripts/oac_gate.mjs) ─────────────────────
// Passes only on a schedule synced in the last maxAgeHours, with no open held item rated 4+,
// published to the KB at the current version, and no newer site save waiting to be pulled.
export const isHeldOpen = p => !!p && !p.acknowledged && !p.dismissed && !['acknowledged', 'dismissed', 'applied', 'resolved'].includes(p.status);
export const openHeld = meta => (meta.sync?.pending || []).filter(isHeldOpen);

export function oacGateCheck(meta, maxAgeHours = 24, nowMs = Date.now()) {
  const reasons = [];
  const s = meta.sync || {};
  const last = [s.lastFullSyncAt, s.lastSyncAt].filter(Boolean).sort().pop();
  if (!last || nowMs - new Date(last).getTime() > maxAgeHours * 3600000) reasons.push(last ? `Last sync ${last.slice(0, 16).replace('T', ' ')} is older than ${maxAgeHours} h` : 'Never synced');
  const open = openHeld(meta).filter(p => (p.jevRating || 1) >= 4);
  if (open.length) reasons.push(`${open.length} held sync item(s) rated 4+ await acknowledgement (open SYNC)`);
  if (s.publishedVersion !== meta.version) reasons.push(`Published (knowledge base) v${s.publishedVersion ?? '—'} ≠ canonical v${meta.version} — save, then let the agent sync/publish to the KB`);
  else if (s.siteSavedVersion != null && s.siteSavedVersion > s.publishedVersion) reasons.push(`Site save v${s.siteSavedVersion} is newer than the published v${s.publishedVersion} — the agent must pull and publish it first`);
  return { ok: !reasons.length, reasons };
}

// ── Sync application ─────────────────────────────────────────────
// Priority 1: make the past accurate (actuals, backfilled meetings/inspections).
// Priority 2: necessary changes and confirmed unavoidable impact on remaining work.
// Priority 3: milestone effects — only moved with explicit permission.
export const SYNC_PRIORITIES = {
  1: 'Accurate to date',
  2: 'Necessary remaining changes',
  3: 'Milestone effects (permission required)',
};

const TASK_ITEM_TYPES = new Set(['actual_dates', 'duration_change', 'jobtread_manual_edit', 'resequence', 'milestone_move']);

function findTask(wbs, id) {
  for (const p of wbs) for (const t of p.children) if (t.id === id) return { phase: p, task: t };
  return null;
}

// Next free id in a phase, unique across the whole WBS.
function nextId(wbs, phase) {
  const used = new Set(wbs.flatMap(p => p.children.map(t => String(t.id))));
  let n = Math.max(0, ...phase.children.map(t => Number(String(t.id).split('.').pop()) || 0)) + 1;
  while (used.has(`${phase.id}.${n}`)) n += 1;
  return `${phase.id}.${n}`;
}

function itemSources(it) {
  if (Array.isArray(it.sources) && it.sources.length) return it.sources;
  const date = String(it.date || '').slice(0, 10) || today();
  if (it.url) return [sourceRef(it.source || 'sync', it.summary || it.type, it.url, date)];
  return [sourceRef('sync', it.source || 'sync bundle', '', date)];
}

// Is a JobTread manual edit asking for an earlier start than the CPM allows?
export function isEarlierEdit(it, task) {
  if (!it || it.type !== 'jobtread_manual_edit' || !it.startDate) return false;
  return it.direction === 'earlier' || (!!task?.startDate && it.startDate < task.startDate);
}

export function applySyncItems(project, meta, items) {
  const wbs = project.wbs.map(p => ({ ...p, children: p.children.map(t => ({ ...t })) }));
  let deps = [...(project.dependencies || [])];
  let m = meta;
  const trackers = JSON.parse(JSON.stringify(meta.trackers));
  const done = new Set(meta.sync?.appliedItemIds || []);
  const processed = [];
  const report = { applied: 0, skipped: 0, duplicates: 0, tracked: 0 };
  for (const it of items) {
    if (it.id && done.has(it.id)) { report.duplicates += 1; continue; }
    const sources = itemSources(it);
    const base = {
      source: it.source, actor: it.approved ? 'user (approved)' : 'sync', target: it.taskId || it.tracker || it.name,
      reason: it.summary, jevRating: it.jevRating || 1, priority: it.priority, sources, ...(it.id ? { syncItemId: it.id } : {}),
    };
    const found = it.taskId ? findTask(wbs, it.taskId) : null;
    if (TASK_ITEM_TYPES.has(it.type) && !found) {
      m = logActivity(m, { ...base, type: `${it.type}_skipped`, status: 'skipped', after: null, reason: `Skipped — task not found${it.taskId ? ` (${it.taskId})` : ''}: ${it.summary || ''}` });
      report.skipped += 1;
      continue;
    }
    const before = found ? { start: found.task.startDate, end: found.task.endDate, duration: found.task.duration } : null;
    let entry = null;
    switch (it.type) {
      case 'actual_dates':
        if (it.actualStart) found.task.actualStart = it.actualStart;
        if (it.actualFinish) found.task.actualFinish = it.actualFinish;
        if (it.percentComplete != null) found.task.percentComplete = it.percentComplete;
        entry = { after: { actualStart: it.actualStart, actualFinish: it.actualFinish, percentComplete: it.percentComplete } };
        break;
      case 'duration_change':
        if (it.duration != null) found.task.duration = it.duration;
        if (it.startDate) found.task.constraintStart = it.startDate;
        if (it.percentComplete != null) found.task.percentComplete = it.percentComplete;
        entry = { after: { duration: it.duration, startDate: it.startDate } };
        break;
      case 'jobtread_manual_edit': {
        const earlier = isEarlierEdit(it, found.task);
        const cpmStart = found.task.startDate;
        if (it.duration != null) found.task.duration = it.duration;
        if (it.percentComplete != null) found.task.percentComplete = it.percentComplete;
        if (it.startDate && earlier) {
          // A start-no-earlier-than constraint can only push later; record the request instead.
          found.task.requestedStart = it.startDate;
          entry = {
            after: { requestedStart: it.startDate, applied: false, duration: it.duration },
            reason: `${it.summary || 'JobTread manual edit'} — requested start ${it.startDate} is earlier than the CPM start ${cpmStart || '—'}; predecessors prevent an earlier start, so it is recorded as requestedStart only`,
          };
        } else {
          if (it.startDate) found.task.constraintStart = it.startDate;
          entry = { after: { duration: it.duration, startDate: it.startDate } };
        }
        break;
      }
      case 'resequence':
        if (Array.isArray(it.predecessors)) {
          const id = found.task.id;
          const keep = new Map(deps.filter(d => d.to === id).map(d => [d.from, d]));
          found.task.predecessors = it.predecessors;
          deps = deps.filter(d => d.to !== id).concat(it.predecessors.map(from => keep.get(from) || { from, to: id, type: 'FS', lag: 0, lagUnit: 'days' }));
        }
        entry = { after: { predecessors: it.predecessors } };
        break;
      case 'milestone_move':
        if (it.approved) {
          found.task.contractDate = it.newDate;
          found.task.constraintStart = it.newDate;
          entry = { after: it.newDate };
        } else {
          entry = {
            type: 'milestone_move_tracked', noVersion: true,
            after: { proposed: it.newDate, current: it.oldDate || found.task.contractDate || found.task.endDate || null, applied: false },
            reason: `Tracked as variance, not moved (milestone moves need explicit approval): ${it.summary || ''}`,
          };
          report.tracked += 1;
        }
        break;
      case 'add_event': {
        const all = wbs.flatMap(p => p.children);
        const dup = all.find(t => t.name === it.name && ((it.sourceId && t.syncSourceId === it.sourceId) || (it.date && (t.actualStart === it.date || t.constraintStart === it.date))));
        if (dup) {
          m = logActivity(m, { ...base, type: 'add_event_skipped', status: 'duplicate', target: dup.id, after: null, reason: `Skipped — "${it.name}" on ${it.date || '—'} already exists as ${dup.id}` });
          report.duplicates += 1;
          if (it.id) processed.push(it.id);
          continue;
        }
        const phase = wbs.find(p => p.phaseKey === (it.phase || 'construction')) || wbs[1] || wbs[0];
        if (!phase) {
          m = logActivity(m, { ...base, type: 'add_event_skipped', status: 'skipped', after: null, reason: `Skipped — no phase to hold "${it.name}"` });
          report.skipped += 1;
          continue;
        }
        const id = nextId(wbs, phase);
        phase.children.push({
          id, wbsCode: id, type: 'task', name: it.name, duration: it.duration ?? 1, durationUnit: 'days',
          trade: it.trade || 'GC', category: it.category || 'deliverable', sub: it.sub || 'Backfilled Events',
          cls: it.cls || 'oac', isMilestone: !!it.milestone, actualStart: it.date, actualFinish: it.date,
          constraintStart: it.date, predecessors: [], successors: [], isCritical: false,
          notes: it.summary || '', source: `sync:${it.source}`, syncSourceId: it.sourceId || null, syncItemId: it.id || null, children: [],
        });
        entry = { target: `${id} ${it.name}`, after: { id, name: it.name, date: it.date } };
        break;
      }
      case 'tracker_update': {
        const list = trackers[it.tracker] || (trackers[it.tracker] = []);
        const idx = list.findIndex(x => x.id === it.record?.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...it.record };
        else if (it.record) list.push(it.record);
        entry = { after: it.record };
        break;
      }
      case 'note':
        entry = { noVersion: true, after: null };
        break;
      default:
        m = logActivity(m, { ...base, type: `${it.type}_skipped`, status: 'skipped', after: null, reason: `Skipped — unsupported sync item type "${it.type}"` });
        report.skipped += 1;
        continue;
    }
    const { noVersion, ...rest } = entry;
    m = (noVersion ? logActivity : logChange)(m, { ...base, type: it.type, before, ...rest });
    if (!noVersion) report.applied += 1;
    if (it.id) processed.push(it.id);
  }
  // Every sync event backs the Coda up to JobTread; the agent performs the write.
  // Held items (rating >= 4 not applied) stay pending until applied, acknowledged or dismissed.
  const t = now();
  const gone = new Set(processed);
  const pending = (m.sync?.pending || []).filter(p => !gone.has(p.id));
  const appliedItemIds = [...(meta.sync?.appliedItemIds || []), ...processed].slice(-APPLIED_ITEM_IDS_CAP);
  return {
    project: { ...project, wbs, dependencies: deps },
    meta: markCodaBackupPending({ ...m, trackers, sync: { ...m.sync, lastSyncAt: t, lastFullSyncAt: t, pending, appliedItemIds } }),
    report,
  };
}

// Held-back sync items (rating >= 4 the user did not apply). The full item is kept so it can
// still be applied later from the SYNC popup.
export function holdSyncItems(meta, items) {
  const pending = [...(meta.sync?.pending || [])];
  const added = [];
  for (const it of items) {
    if (!it.id || pending.some(p => p.id === it.id)) continue;
    const p = {
      id: it.id, type: it.type, summary: it.summary, jevRating: it.jevRating, taskId: it.taskId || null, sourceId: it.sourceId || null,
      sources: itemSources(it), item: { ...it }, acknowledged: false, status: 'pending', heldAt: now(),
    };
    pending.push(p);
    added.push(p);
  }
  const m = { ...meta, sync: { ...meta.sync, pending } };
  if (!added.length) return m;
  return logActivity(m, {
    type: 'sync_held', actor: 'sync', target: added.map(p => p.taskId || p.id).join(', '), after: added.map(p => p.id),
    reason: `${added.length} sync item(s) rated 4+ held for acknowledgement: ${added.map(p => p.summary).join('; ')}`.slice(0, 600),
    jevRating: Math.max(...added.map(p => p.jevRating || 1)), sources: unionSources(added.map(p => p.sources)),
  });
}

function resolveHeld(meta, ids, patch, entry, { by = 'user', note = '', sources = [] } = {}) {
  const want = new Set([].concat(ids || []));
  const hit = [];
  const at = now();
  const pending = (meta.sync?.pending || []).map(p => {
    if (!want.has(p.id) || !isHeldOpen(p)) return p;
    const next = { ...p, ...patch(by, at, note) };
    hit.push(next);
    return next;
  });
  if (!hit.length) return meta;
  return logActivity({ ...meta, sync: { ...meta.sync, pending } }, {
    actor: by, target: hit.map(p => p.taskId || p.id).join(', '), after: hit.map(p => p.id),
    jevRating: 2, sources: unionSources(hit.map(p => p.sources || []), sources),
    ...entry(hit, note),
  });
}

// Acknowledge held items: the impact is known and accepted; the schedule is not changed.
export function acknowledgeHeld(meta, ids, opts = {}) {
  return resolveHeld(meta, ids,
    (by, at, note) => ({ acknowledged: true, status: 'acknowledged', ackBy: by, ackAt: at, ...(note ? { ackNote: note } : {}) }),
    (hit, note) => ({ type: 'held_acknowledged', reason: `Acknowledged ${hit.length} held sync item(s): ${hit.map(p => p.summary).join('; ')}${note ? ` — ${note}` : ''}`.slice(0, 600) }),
    opts);
}

// Dismiss held items: not applicable / wrong; kept in sync.pending with status 'dismissed'.
export function dismissHeld(meta, ids, opts = {}) {
  return resolveHeld(meta, ids,
    (by, at, note) => ({ dismissed: true, status: 'dismissed', dismissedBy: by, dismissedAt: at, ...(note ? { dismissNote: note } : {}) }),
    (hit, note) => ({ type: 'held_dismissed', reason: `Dismissed ${hit.length} held sync item(s): ${hit.map(p => p.summary).join('; ')}${note ? ` — ${note}` : ''}`.slice(0, 600) }),
    opts);
}

// A site save (schedule.ntxpllc.com) is not a KB publish: it records siteSavedVersion only.
export function markSiteSaved(meta, version = meta.version) {
  return { ...meta, sync: { ...meta.sync, siteSavedVersion: version, lastSiteSave: { version, at: now() } } };
}

// Agent side only: a version verified in the knowledge base / Drive / JobTread.
export function markPublished(meta, target = 'knowledge base') {
  return { ...meta, sync: { ...meta.sync, publishedVersion: meta.version, lastPublish: { version: meta.version, at: now(), target } } };
}
