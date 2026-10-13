// Canonical Project Schedule — one source of truth that the knowledge base, the
// Google Drive folder and JobTread are all derived from. Every mutation goes
// through logChange so the changelog stays complete and auditable.

export const CANONICAL_SCHEMA = 'bidforge.canonical.v1';

export function slugify(name) {
  return String(name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

export function emptyMeta() {
  return {
    schema: CANONICAL_SCHEMA,
    version: 0,
    links: { jobtreadJobId: '', driveFolderId: '', driveFolderName: '', quickbooksProjectId: '', kbPath: '', hostUrl: '' },
    requirements: { status: 'pending', documents: [], specText: '', acknowledgement: null },
    modules: [],
    trackers: { rfis: [], submittals: [], asis: [], payApps: [], subInvoices: [], payAppCycleDay: 25 },
    changelog: [],
    inputs: [],
    optimizationChain: [],
    memory: [],
    sync: { lastSyncAt: null, lastJobtreadPullAt: null },
  };
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
    wbs: project.wbs,
    dependencies: project.dependencies,
    trackers: meta.trackers,
    changelog: meta.changelog,
    inputs: meta.inputs,
    optimizationChain: meta.optimizationChain,
    memory: meta.memory,
    sync: meta.sync,
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
  for (const k of ['requirements', 'modules', 'trackers', 'changelog', 'inputs', 'optimizationChain', 'memory', 'sync']) {
    if (doc[k]) meta[k] = doc[k];
  }
  meta.version = doc.version || 0;
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
    });
  }
  return { project: { ...project, wbs, dependencies: deps }, meta: { ...m, trackers, sync: { ...m.sync, lastSyncAt: now() } } };
}
