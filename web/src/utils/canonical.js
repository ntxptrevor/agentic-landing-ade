// Canonical Project Schedule — one source of truth that the knowledge base, the
// Google Drive folder and JobTread are all derived from. Every mutation goes
// through logChange so the changelog stays complete and auditable.

import { emptyCoda, codaHash } from './codaBackup.js';

export const CANONICAL_SCHEMA = 'bidforge.canonical.v1';

export function slugify(name) {
  return String(name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

export function emptyMeta() {
  return {
    schema: CANONICAL_SCHEMA,
    version: 0,
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
    sync: { lastSyncAt: null, lastJobtreadPullAt: null, codaBackup: { status: 'never', lastAt: null, lastHash: null, failures: 0 } },
  };
}

// Project Coda edits (KB is primary; the JobTread "Notes" block is the backup).
export function updateCoda(meta, coda, source = 'environment') {
  const next = { ...coda, version: (meta.coda?.version || 0) + 1, updatedAt: now() };
  const m = logChange({ ...meta, coda: next }, { type: 'coda_updated', source, after: { version: next.version, hash: codaHash(next) }, reason: 'Project Coda changed — JobTread Notes backup due on next sync', jevRating: 2 });
  return markCodaBackupPending(m);
}

export function markCodaBackupPending(meta) {
  const cb = meta.sync?.codaBackup || {};
  return { ...meta, sync: { ...meta.sync, codaBackup: { ...cb, status: 'pending' } } };
}

// Result reported by the agent (or carried in a sync bundle) after writing Notes.
export function recordCodaBackup(meta, result) {
  const cb = meta.sync?.codaBackup || {};
  // A result only counts as a verified backup when it is for the Coda as it stands now;
  // a stale bundle or a result without a hash is recorded as a mismatch.
  if ((result.status === 'written' || result.status === 'unchanged') && result.hash !== codaHash(meta.coda || {})) {
    result = { ...result, status: 'mismatch', error: result.hash ? `backup sha ${result.hash} is not the current Coda (sha ${codaHash(meta.coda || {})})` : 'backup result has no hash' };
  }
  const ok = result.status === 'written' || result.status === 'unchanged';
  const failures = ok ? 0 : (cb.failures || 0) + 1;
  const m = { ...meta, sync: { ...meta.sync, codaBackup: { status: result.status, lastAt: result.at || now(), lastHash: result.hash || cb.lastHash, failures, error: ok ? null : result.error || 'unknown' } } };
  return logChange(m, {
    type: 'coda_backup', source: `JobTread job custom field "Notes"${result.event ? ` (${result.event})` : ''}`, actor: 'sync',
    after: { status: result.status, hash: result.hash, chars: result.chars },
    reason: ok ? 'Project Coda backed up to JobTread' : `Coda backup failed (${failures} in a row): ${result.error || 'unknown'}`,
    jevRating: ok ? 1 : failures >= 3 ? 4 : 3,
  });
}

const now = () => new Date().toISOString();

export function logChange(meta, entry) {
  const e = {
    id: `CHG-${String(meta.changelog.length + 1).padStart(4, '0')}`,
    at: now(),
    actor: 'user',
    jevRating: 1,
    ...entry,
  };
  return { ...meta, version: meta.version + 1, changelog: [...meta.changelog, e] };
}

// Every changelog entry carries its context sources: [{type, title, url, date}]. A source
// without a link still names where the change came from and when.
export function sourceRef(type, title, url = '', date = new Date().toISOString().slice(0, 10)) {
  return { type, title, url, date };
}

// The project KB activity stream (NTXP Plans-Atlas activity-stream schema): one entry per
// changelog entry, newest first, with provenance links.
export function toActivityEntries(meta, slug = '') {
  return [...meta.changelog].reverse().map(e => ({
    ts: e.at,
    source: 'schedule',
    kind: 'event',
    text: `${e.id} ${e.type}${e.target ? ` · ${e.target}` : ''}: ${e.reason || ''}`.slice(0, 400),
    link: (e.sources || []).find(s => s.url)?.url || (slug ? `/?project=${slug}` : ''),
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

export function addMemory(meta, text, scope = 'project') {
  const entry = { at: now(), text, scope, status: 'pending_kb_write' };
  return logChange({ ...meta, memory: [...meta.memory, entry] }, { type: 'memory', source: 'user directive', after: text, reason: `Memory directive (${scope})` });
}

export function addOptimizationEntry(meta, entry) {
  return logChange(
    { ...meta, optimizationChain: [...meta.optimizationChain, { at: now(), ...entry }] },
    { type: 'optimization_confirmed', source: 'initialization', after: entry, reason: 'Environment optimization confirmed by user' },
  );
}

export function buildCanonicalDocument(project, meta) {
  return {
    schema: CANONICAL_SCHEMA,
    generatedAt: now(),
    version: meta.version,
    status: meta.status || 'bid',
    folder: routeFolder(project.name, meta.status),
    project: {
      name: project.name,
      slug: slugify(project.name),
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
    activity: toActivityEntries(meta, slugify(project.name)).slice(0, 200),
  };
}

export function saveLocal(project, meta) {
  try {
    localStorage.setItem(`bidforge.canonical.${slugify(project.name)}`, JSON.stringify(buildCanonicalDocument(project, meta)));
    localStorage.setItem('bidforge.canonical.last', slugify(project.name));
  } catch { /* storage unavailable: canonical JSON export is the durable path */ }
}

export function loadLocal() {
  try {
    const slug = localStorage.getItem('bidforge.canonical.last');
    if (!slug) return null;
    const raw = localStorage.getItem(`bidforge.canonical.${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Split a canonical document back into app state.
export function fromCanonicalDocument(doc) {
  const meta = emptyMeta();
  for (const k of ['requirements', 'modules', 'scope', 'trackers', 'changelog', 'inputs', 'optimizationChain', 'memory', 'coda', 'sync']) {
    if (doc[k]) meta[k] = doc[k];
  }
  meta.version = doc.version || 0;
  if (doc.status) meta.status = doc.status;
  const { name, startDate, endDate, workingDays, holidays, hoursPerDay, ...links } = doc.project || {};
  for (const k of Object.keys(meta.links)) if (links[k]) meta.links[k] = links[k];
  const project = { name, startDate, endDate, workingDays, holidays: holidays || [], hoursPerDay: hoursPerDay || 8, wbs: doc.wbs || [], dependencies: doc.dependencies || [], milestones: [] };
  return { project, meta };
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

function findTask(wbs, id) {
  for (const p of wbs) for (const t of p.children) if (t.id === id) return { phase: p, task: t };
  return null;
}

function nextId(phase) {
  const nums = phase.children.map(t => Number(String(t.id).split('.').pop()) || 0);
  return `${phase.id}.${Math.max(0, ...nums) + 1}`;
}

export function applySyncItems(project, meta, items) {
  const wbs = project.wbs.map(p => ({ ...p, children: p.children.map(t => ({ ...t })) }));
  let deps = [...(project.dependencies || [])];
  let m = meta;
  const trackers = JSON.parse(JSON.stringify(meta.trackers));
  for (const it of items) {
    const found = it.taskId ? findTask(wbs, it.taskId) : null;
    const before = found ? { start: found.task.startDate, end: found.task.endDate, duration: found.task.duration } : null;
    switch (it.type) {
      case 'actual_dates':
        if (found) {
          if (it.actualStart) found.task.actualStart = it.actualStart;
          if (it.actualFinish) found.task.actualFinish = it.actualFinish;
          if (it.percentComplete != null) found.task.percentComplete = it.percentComplete;
        }
        break;
      case 'duration_change':
      case 'jobtread_manual_edit':
        if (found) {
          if (it.duration != null) found.task.duration = it.duration;
          if (it.startDate) found.task.constraintStart = it.startDate;
          if (it.percentComplete != null) found.task.percentComplete = it.percentComplete;
        }
        break;
      case 'resequence':
        if (found && Array.isArray(it.predecessors)) {
          found.task.predecessors = it.predecessors;
          deps = deps.filter(d => d.to !== found.task.id).concat(it.predecessors.map(from => ({ from, to: found.task.id, type: 'FS', lag: 0, lagUnit: 'days' })));
        }
        break;
      case 'milestone_move':
        if (found && it.approved) {
          found.task.contractDate = it.newDate;
          found.task.constraintStart = it.newDate;
        }
        break;
      case 'add_event': {
        const phase = wbs.find(p => p.phaseKey === (it.phase || 'construction')) || wbs[1] || wbs[0];
        if (phase) {
          const id = nextId(phase);
          phase.children.push({
            id, wbsCode: id, type: 'task', name: it.name, duration: it.duration ?? 1, durationUnit: 'days',
            trade: it.trade || 'GC', category: it.category || 'deliverable', sub: it.sub || 'Backfilled Events',
            cls: it.cls || 'oac', isMilestone: !!it.milestone, actualStart: it.date, actualFinish: it.date,
            constraintStart: it.date, predecessors: [], successors: [], isCritical: false,
            notes: it.summary || '', source: `sync:${it.source}`, children: [],
          });
        }
        break;
      }
      case 'tracker_update': {
        const list = trackers[it.tracker] || (trackers[it.tracker] = []);
        const idx = list.findIndex(x => x.id === it.record?.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...it.record };
        else if (it.record) list.push(it.record);
        break;
      }
      default:
        break;
    }
    m = logChange(m, {
      type: it.type, source: it.source, actor: it.approved ? 'user (approved)' : 'sync',
      target: it.taskId || it.tracker || it.name, before,
      after: it.type === 'milestone_move' ? it.newDate : (it.record || it.duration || it.actualFinish || it.actualStart || it.name),
      reason: it.summary, jevRating: it.jevRating || 1, priority: it.priority,
      sources: it.sources || (it.url ? [sourceRef(it.source || 'sync', it.summary || it.type, it.url, (it.date || '').slice(0, 10) || undefined)] : []),
    });
  }
  // Every sync event backs the Coda up to JobTread; the agent performs the write.
  // Items the user has not acknowledged yet (rating >= 4 held back by the popup) stay pending;
  // the OAC gate refuses to run while any remain.
  const t = now();
  const applied = new Set(items.map(i => i.id).filter(Boolean));
  const pending = (m.sync?.pending || []).filter(p => !applied.has(p.id));
  return { project: { ...project, wbs, dependencies: deps }, meta: markCodaBackupPending({ ...m, trackers, sync: { ...m.sync, lastSyncAt: t, lastFullSyncAt: t, pending } }) };
}

// Held-back sync items (rating >= 4 waiting for acknowledgement).
export function holdSyncItems(meta, items) {
  const pending = [...(meta.sync?.pending || [])];
  for (const it of items) if (!pending.some(p => p.id === it.id)) pending.push({ id: it.id, type: it.type, summary: it.summary, jevRating: it.jevRating, acknowledged: false, heldAt: now() });
  return { ...meta, sync: { ...meta.sync, pending } };
}

// A version saved to the hosted site / knowledge base is the published version the OAC gate compares.
export function markPublished(meta, target = 'schedule.ntxpllc.com') {
  return { ...meta, sync: { ...meta.sync, publishedVersion: meta.version, lastPublish: { version: meta.version, at: now(), target } } };
}
