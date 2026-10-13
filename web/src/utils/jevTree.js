// JEV schedule builder: backbone (NTXP canon) + confirmed gated modules -> WBS.
// Pure and deterministic: same inputs always give the same schedule.
import { CONSTRUCTION_PHASES } from '../data/constructionPhases.js';
import { MODULE_TASKS } from '../data/jevModuleTasks.js';
import { MODULE_BY_ID, classifyLineItem } from '../data/jevTaxonomy.js';

const PHASE_ORDER = ['preconstruction', 'construction', 'closeout'];
const BACKBONE_ORDER = CONSTRUCTION_PHASES.flatMap(p => p.defaultTasks.map(t => t.name));

function included(task, confirmed) {
  if (!task.module) return true;
  const mods = Array.isArray(task.module) ? task.module : [task.module];
  return mods.some(m => confirmed.has(m));
}

// Returns ordered task definitions per phase, with module rows spliced after anchors.
export function composeSequence(confirmedIds) {
  const confirmed = new Set(confirmedIds);
  const phases = CONSTRUCTION_PHASES.map(p => ({
    id: p.id,
    name: p.name,
    rows: p.defaultTasks.filter(t => included(t, confirmed)).map(t => ({ ...t, source: 'backbone' })),
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

export function buildWbs(confirmedIds) {
  const { phases, unplaced } = composeSequence(confirmedIds);
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
        };
      }),
    };
  });

  // Sequential wiring; parallel rows hang off their anchor and are skipped as predecessors.
  let lastOfPrevPhase = null;
  for (const phase of wbs) {
    let lastSeq = null;
    phase.children.forEach((task, i) => {
      if (i === 0) {
        if (lastOfPrevPhase) task.predecessors = [lastOfPrevPhase.id];
      } else if (task.predOffset === null) {
        task.predecessors = [];
      } else if (task.parallel) {
        const anchor = lastSeq || phase.children[i - 1];
        task.predecessors = [anchor.id];
      } else if (typeof task.predOffset === 'number' && phase.children[i + task.predOffset]) {
        task.predecessors = [phase.children[i + task.predOffset].id];
      } else if (lastSeq) {
        task.predecessors = [lastSeq.id];
      }
      for (const from of task.predecessors) deps.push({ from, to: task.id, type: 'FS', lag: 0, lagUnit: 'days' });
      // Unlinked reference milestones (e.g. contract SC date) never carry the chain.
      const reference = i > 0 && task.predOffset === null;
      if (reference) task.isReference = true;
      if (!task.parallel && !reference) lastSeq = task;
    });
    lastOfPrevPhase = lastSeq || lastOfPrevPhase;
  }
  // Parallel rows feed the next protected gate/milestone in their phase, so a late
  // permit or submittal pushes the schedule instead of dead-ending with false float.
  for (const phase of wbs) {
    phase.children.forEach((task, i) => {
      if (!task.parallel || task.noGate) return;
      const gate = phase.children.slice(i + 1).find(t => t.protected && t.isMilestone && !t.isReference)
        || phase.children.slice(i + 1).reverse().find(t => !t.parallel && !t.isReference);
      if (gate && !gate.predecessors.includes(task.id)) {
        gate.predecessors.push(task.id);
        deps.push({ from: task.id, to: gate.id, type: 'FS', lag: 0, lagUnit: 'days' });
      }
    });
  }
  for (const phase of wbs) for (const t of phase.children) { delete t.predOffset; }
  return { wbs, dependencies: deps, unplaced };
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
