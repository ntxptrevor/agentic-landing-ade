// JEV schedule builder: backbone (NTXP canon) + confirmed gated modules -> WBS.
// Pure and deterministic: same inputs always give the same schedule.
import { CONSTRUCTION_PHASES } from '../data/constructionPhases.js';
import { MODULE_TASKS } from '../data/jevModuleTasks.js';
import { MODULE_BY_ID, classifyLineItem } from '../data/jevTaxonomy.js';
import { OVERLAP_LINKS, HARD_GATES, SCOPE_TIERS, SECTORS, CONSTRAINTS, DURATION_MODEL, FIXED_TIME_RE } from '../data/jevOverlap.js';

const PHASE_ORDER = ['preconstruction', 'construction', 'closeout'];
const BACKBONE_ORDER = CONSTRUCTION_PHASES.flatMap(p => p.defaultTasks.map(t => t.name));

function included(task, confirmed, tier, phaseId) {
  if (task.tiers && !(tier && task.tiers.includes(tier))) return false;
  if (tier && SCOPE_TIERS[tier]) {
    const t = SCOPE_TIERS[tier];
    if (t.keep && phaseId === 'construction' && !t.keep.includes(task.name)) return false;
    if (t.drop && t.drop.includes(task.name)) return false;
  }
  if (!task.module) return true;
  const mods = Array.isArray(task.module) ? task.module : [task.module];
  return mods.some(m => confirmed.has(m));
}

// Returns ordered task definitions per phase, with module rows spliced after anchors.
export function composeSequence(confirmedIds, tier) {
  const confirmed = new Set(confirmedIds);
  const overrides = SCOPE_TIERS[tier]?.override || {};
  const phases = CONSTRUCTION_PHASES.map(p => ({
    id: p.id,
    name: p.name,
    rows: p.defaultTasks.filter(t => included(t, confirmed, tier, p.id)).map(t => ({ ...t, ...(overrides[t.name] || {}), baseName: t.name, source: 'backbone' })),
  }));
  const unplaced = [];
  for (const modId of confirmedIds) {
    const rows = MODULE_TASKS[modId] || [];
    const label = MODULE_BY_ID[modId]?.label || modId;
    // Insert in reverse so several rows after the same anchor keep their order.
    const placedAfter = new Map();
    for (const row of rows) {
      // Anchor dropped with a declined module -> nearest preceding backbone task present.
      let anchorName = row.after;
      const present = name => phases.some(p => p.rows.some(r => r.name === name));
      if (anchorName && !present(anchorName)) {
        const k = BACKBONE_ORDER.indexOf(anchorName);
        anchorName = BACKBONE_ORDER.slice(0, Math.max(k, 0)).reverse().find(present) || null;
      }
      let phase = phases.find(p => p.id === row.phase) || phases[1];
      let idx = anchorName ? phase.rows.findIndex(r => r.name === anchorName) : -1;
      if (idx < 0 && anchorName) {
        for (const p of phases) {
          const j = p.rows.findIndex(r => r.name === anchorName);
          if (j >= 0) { phase = p; idx = j; break; }
        }
      }
      const key = `${phase.id}:${anchorName}`;
      const offset = placedAfter.get(key) || 0;
      const insertAt = idx >= 0 ? idx + 1 + offset : phase.rows.length;
      if (idx < 0) unplaced.push({ module: modId, task: row.name, anchor: anchorName });
      const anchorSub = idx >= 0 ? phase.rows[idx].sub : label;
      phase.rows.splice(insertAt, 0, { ...row, sub: row.sub || anchorSub, module: [modId], moduleLabel: label, source: `module:${modId}` });
      placedAfter.set(key, offset + 1);
    }
  }
  return { phases, unplaced };
}

// Duration factor from the scope profile (affected SF, sector, damped constraints).
export function scopeFactor(scope = {}) {
  if (!scope.sf) return 1;
  const m = DURATION_MODEL;
  const size = Math.pow(scope.sf / m.perTask.baseSf, m.perTask.exp);
  const sector = SECTORS[scope.sector]?.factor || 1;
  const raw = (scope.constraints || []).reduce((k, c) => k * (CONSTRAINTS[c]?.factor || 1), 1);
  const k = Math.min(m.constraintCap, Math.pow(raw, m.constraintDamping));
  return size * sector * k;
}

// Parametric construction-WD envelope (ntxp-gantt-schedule formula), used by the sanity gate.
export function envelopeWd(scope = {}) {
  if (!scope.sf) return null;
  const e = DURATION_MODEL.envelope;
  const sector = SECTORS[scope.sector]?.factor || 1;
  const raw = (scope.constraints || []).reduce((k, c) => k * (CONSTRAINTS[c]?.factor || 1), 1);
  const k = Math.min(DURATION_MODEL.constraintCap, Math.pow(raw, DURATION_MODEL.constraintDamping));
  return Math.round(e.coef * Math.pow(scope.sf, e.exp) * (e.tier[scope.tier] ?? 1) * sector * k);
}

function scaleRows(phases, scope) {
  const f = scopeFactor(scope);
  const { min, max } = DURATION_MODEL.perTask;
  for (const p of phases) {
    if (p.id === 'preconstruction') continue;
    const out = [];
    for (const r of p.rows) {
      let d = r.duration;
      const labor = d > 0 && !r.milestone && !FIXED_TIME_RE.test(r.name) && !(r.cls && ['inspection', 'permit', 'oac', 'design'].includes(r.cls));
      if (scope.tier === 'equipment' && /hvac|mechanical/i.test(r.trade || '') && /set|install|replace|disconnect|curb/i.test(r.name)) {
        d = Math.max(DURATION_MODEL.equipment.minSet, Math.ceil((scope.units || 1) * DURATION_MODEL.equipment.setDaysPerUnit));
      } else if (labor && scope.sf) {
        d = Math.max(min, Math.round(d * f));
      }
      // DISD 01 32 16: no construction activity over 10 WD — split by area instead of clamping.
      if (labor && d > max) {
        const n = Math.ceil(d / max);
        const each = Math.ceil(d / n);
        for (let k = 1; k <= n; k++) out.push({ ...r, duration: each, name: `${r.name} — Area ${k}`, splitOf: r.name, splitIndex: k, splitCount: n });
        continue;
      }
      out.push({ ...r, duration: d });
    }
    p.rows = out;
  }
}

export function buildWbs(confirmedIds, scope = null) {
  const { phases, unplaced } = composeSequence(confirmedIds, scope?.tier);
  if (scope) scaleRows(phases, scope);
  const deps = [];
  const wbs = phases.map((p, pi) => {
    const pid = `${pi + 1}`;
    return {
      id: pid, type: 'phase', name: p.name, wbsCode: pid, phaseKey: p.id,
      children: p.rows.map((t, ti) => {
        const c = classifyLineItem({ ...t, phase: p.id, milestone: t.milestone ?? (t.duration === 0 ? true : undefined) });
        return {
          id: `${pid}.${ti + 1}`, type: 'task', name: t.name, wbsCode: `${pid}.${ti + 1}`,
          duration: t.duration, durationUnit: 'days', trade: t.trade || c.trade,
          category: t.category || 'activity', sub: t.sub || '', module: t.module || null,
          cls: t.cls || c.cls, csi: t.csi || c.csi, hasSubmittal: t.hasSubmittal ?? c.hasSubmittal,
          leadDays: t.leadDays || c.leadDays, isMilestone: !!(t.milestone ?? c.milestone),
          protected: !!t.critical, parallel: !!t.parallel, noGate: !!t.noGate, lesson: t.lesson || null, predOffset: t.predOffset,
          source: t.source, predecessors: [], successors: [], isCritical: false, notes: '', children: [],
          baseName: t.baseName || t.splitOf || t.name, splitIndex: t.splitIndex || null, splitCount: t.splitCount || null,
          windowDays: /state|tdlr|hhsc|fire marshal|\baru\b|jail standards|ras inspection/i.test(t.name) ? 5 : null,
        };
      }),
    };
  });

  // Module rows in construction/closeout run as their own trade flow beside the backbone
  // (council audit 2026-10-13, root cause: modules spliced in series). Precon rows keep
  // their existing parallel flag.
  for (const phase of wbs) {
    if (phase.phaseKey === 'preconstruction') continue;
    for (const t of phase.children) {
      if (t.source?.startsWith('module:') && !t.isMilestone) { t.parallel = true; t.moduleFlow = true; }
    }
  }

  // Sequential wiring; parallel rows hang off their anchor and are skipped as predecessors.
  const gateNames = new Set(HARD_GATES);
  const link = (task, from, type = 'FS', lag = 0) => {
    task.predecessors.push(from.id);
    deps.push({ from: from.id, to: task.id, type, lag, lagUnit: 'days' });
  };
  let lastOfPrevPhase = null;
  for (const phase of wbs) {
    let lastSeq = null;
    phase.children.forEach((task, i) => {
      const prev = phase.children[i - 1];
      if (i === 0) {
        if (lastOfPrevPhase) link(task, lastOfPrevPhase);
      } else if (task.predOffset === null) {
        // unlinked reference milestone
      } else if (task.moduleFlow && prev?.moduleFlow && prev.source === task.source) {
        link(task, prev); // same module, same anchor group: the trade's own sequence
      } else if (task.moduleFlow) {
        const anchor = lastSeq || prev;
        if (gateNames.has(anchor.baseName)) link(task, anchor);
        else link(task, anchor, 'SS', 1);
      } else if (task.parallel) {
        link(task, lastSeq || prev);
      } else if (typeof task.predOffset === 'number' && phase.children[i + task.predOffset]) {
        link(task, phase.children[i + task.predOffset]);
      } else if (lastSeq) {
        link(task, lastSeq);
      }
      // Unlinked reference milestones (e.g. contract SC date) never carry the chain.
      const reference = i > 0 && task.predOffset === null;
      if (reference) task.isReference = true;
      if (!task.parallel && !reference) lastSeq = task;
    });
    lastOfPrevPhase = lastSeq || lastOfPrevPhase;
  }
  applyOverlap(wbs, deps);

  // Parallel rows feed the next protected gate/milestone in their phase, so a late
  // permit or submittal pushes the schedule instead of dead-ending with false float.
  for (const phase of wbs) {
    phase.children.forEach((task, i) => {
      if (!task.parallel || task.noGate || task.moduleFlow) return;
      const gate = phase.children.slice(i + 1).find(t => t.protected && t.isMilestone && !t.isReference)
        || phase.children.slice(i + 1).reverse().find(t => !t.parallel && !t.isReference);
      if (gate && !gate.predecessors.includes(task.id)) {
        gate.predecessors.push(task.id);
        deps.push({ from: task.id, to: gate.id, type: 'FS', lag: 0, lagUnit: 'days' });
      }
    });
  }
  feedDeadEnds(wbs, deps);
  for (const phase of wbs) for (const t of phase.children) { delete t.predOffset; }
  return { wbs, dependencies: deps, unplaced };
}

// Council overlap links replace the plain sequential FS link into a task. Links into a
// task from a hard gate stay FS, so nothing overlaps an inspection or a release.
function applyOverlap(wbs, deps) {
  const all = wbs.flatMap(p => p.children);
  const byBase = new Map();
  for (const t of all) { if (!byBase.has(t.baseName)) byBase.set(t.baseName, []); byBase.get(t.baseName).push(t); }
  const pick = (name, end) => { const xs = byBase.get(name); return xs ? (end === 'last' ? xs[xs.length - 1] : xs[0]) : null; };
  const order = new Map(all.map((t, i) => [t.id, i]));
  const incoming = new Map();
  for (const l of OVERLAP_LINKS) {
    const from = pick(l.from, l.type === 'SS' ? 'first' : 'last');
    const to = pick(l.to, l.type === 'FF' ? 'last' : 'first');
    if (!from || !to || from === to || order.get(from.id) > order.get(to.id)) continue;
    if (!incoming.has(to.id)) incoming.set(to.id, []);
    // An SS lag can never exceed the predecessor's own duration (it would really be FS).
    const lag = l.type === 'SS' ? Math.min(l.lag, Math.max((from.duration || 1) - 1, 0)) : l.lag;
    incoming.get(to.id).push({ from: from.id, to: to.id, type: l.type, lag, lagUnit: 'days', source: 'council' });
  }
  const gateIds = new Set(all.filter(t => HARD_GATES.includes(t.baseName)).map(t => t.id));
  for (const [toId, links] of incoming) {
    const task = all.find(t => t.id === toId);
    const keep = task.predecessors.filter(p => gateIds.has(p) || links.some(l => l.from === p));
    for (let i = deps.length - 1; i >= 0; i--) {
      if (deps[i].to === toId && !keep.includes(deps[i].from)) deps.splice(i, 1);
      else if (deps[i].to === toId && links.some(l => l.from === deps[i].from)) deps.splice(i, 1);
    }
    task.predecessors = [...new Set([...keep, ...links.map(l => l.from)])];
    deps.push(...links);
    task.overlapped = true;
  }
}

// Every activity needs a successor (DISD 01 32 16): a task left dangling after rewiring
// feeds the next hard gate (or the last task) in its phase.
function feedDeadEnds(wbs, deps) {
  const hasSucc = new Set(deps.map(d => d.from));
  const lastPhase = wbs[wbs.length - 1];
  const lastTask = lastPhase?.children[lastPhase.children.length - 1];
  for (const phase of wbs) {
    phase.children.forEach((t, i) => {
      if (hasSucc.has(t.id) || t.isReference || t.noGate || t === lastTask) return;
      const later = phase.children.slice(i + 1).filter(x => !x.isReference);
      const target = later.find(x => HARD_GATES.includes(x.baseName)) || later[later.length - 1];
      if (!target) return;
      target.predecessors.push(t.id);
      deps.push({ from: t.id, to: target.id, type: 'FS', lag: 0, lagUnit: 'days', source: 'dead-end' });
      hasSucc.add(t.id);
    });
  }
}

// Submittal register seeded from every task that has a submittal or lead time.
export function seedSubmittals(wbs) {
  const out = [];
  for (const p of wbs) {
    for (const t of p.children) {
      if (t.hasSubmittal && p.phaseKey !== 'preconstruction') {
        out.push({ id: `SUB-${String(out.length + 1).padStart(3, '0')}`, title: t.name, linkedTaskId: t.id, trade: t.trade, csi: t.csi, leadDays: t.leadDays || 14, status: 'not_submitted' });
      }
    }
  }
  return out;
}

export { PHASE_ORDER };
