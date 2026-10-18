// Drag a row up or down in the canonical schedule to move its dates.
//
//   moveTaskAfter(project, taskId, targetId, opts)  — the task follows the drop row (FS 0) and
//     takes over the drop row's FS successors (their lag is kept).
//   moveTaskBefore(project, taskId, targetId, opts) — the task takes the drop row's predecessors
//     (type/lag kept) and the drop row follows it (FS 0). targetId may be a phase id, meaning
//     "first row of that phase"; this is how a task becomes the first row of a phase/sub-phase.
//
// The chain the task leaves is closed: each old successor is re-linked to each old predecessor,
// composing the two links (same type → that type with the lags summed; different types → the
// successor's link type with lag 0, flagged typeConflict). No duplicate pred→succ pairs are made.
// Constraints and actuals are never deleted; a task with an approved milestone constraint
// (contractDate / constraintStart) or with actuals is refused unless opts.allowConstrained /
// opts.allowActuals. Ids never change (they are global); a cross-phase move sets
// moved.phaseChanged. CPM runs once on the single clone, and `changes` lists every task whose
// dates moved so the caller can log them.
//
// Returns null for unusable ids, { error, message } when refused, otherwise
// { project, task, target, before, moved, relinked, removed, changes, projectEndBefore, projectEndAfter }.

import { calculateSchedule, wouldCreateCycle, findDependencyCycles } from './scheduler.js';

export function moveTaskAfter(project, taskId, targetId, opts = {}) {
  return relocate(project, taskId, targetId, 'after', opts);
}

export function moveTaskBefore(project, taskId, targetId, opts = {}) {
  return relocate(project, taskId, targetId, 'before', opts);
}

const pairKey = (from, to) => `${from}\u0000${to}`;
const clean = d => ({ from: d.from, to: d.to, type: d.type || 'FS', lag: Number(d.lag) || 0 });

function relocate(project, taskId, targetId, mode, opts) {
  if (!project || !taskId || !targetId || taskId === targetId) return null;
  const srcTasks = (project.wbs || []).flatMap(ph => ph.children || []);
  const srcTask = srcTasks.find(t => t.id === taskId);
  if (!srcTask) return null;
  const targetPhaseOnly = mode === 'before' && (project.wbs || []).some(ph => ph.id === targetId) && !srcTasks.some(t => t.id === targetId);
  if (!targetPhaseOnly && !srcTasks.some(t => t.id === targetId)) return null;

  if ((srcTask.contractDate || srcTask.constraintStart) && !opts.allowConstrained) {
    return {
      error: 'constrained',
      message: `"${srcTask.name}" has an approved date constraint (${srcTask.contractDate ? `contract date ${srcTask.contractDate}` : `start no earlier than ${srcTask.constraintStart}`}). Moving it needs milestone-move approval.`,
    };
  }
  if ((srcTask.actualStart || srcTask.actualFinish) && !opts.allowActuals) {
    return {
      error: 'has_actuals',
      message: `"${srcTask.name}" has recorded actual dates (${[srcTask.actualStart && `started ${srcTask.actualStart}`, srcTask.actualFinish && `finished ${srcTask.actualFinish}`].filter(Boolean).join(', ')}); re-sequencing it would not move it.`,
    };
  }

  // "Before" dates: use the computed dates already on the project; compute on a clone only if missing.
  let beforeDates = new Map(srcTasks.map(t => [t.id, [t.startDate, t.endDate]]));
  let projectEndBefore = project.endDate || null;
  if (srcTasks.some(t => !t.startDate || !t.endDate)) {
    const c = calculateSchedule(JSON.parse(JSON.stringify(project)));
    const ct = c.wbs.flatMap(ph => ph.children || []);
    beforeDates = new Map(ct.map(t => [t.id, [t.startDate, t.endDate]]));
    projectEndBefore = c.endDate;
  }

  const p = JSON.parse(JSON.stringify(project)); // the only deep clone
  const all = p.wbs.flatMap(ph => ph.children || []);
  const byId = new Map(all.map(t => [t.id, t]));
  const task = byId.get(taskId);
  const phaseOf = id => p.wbs.find(ph => (ph.children || []).some(t => t.id === id));
  const fromPhase = phaseOf(taskId);
  let target;
  let tPhase;
  if (targetPhaseOnly) {
    tPhase = p.wbs.find(ph => ph.id === targetId);
    target = (tPhase.children || []).find(t => t.id !== taskId) || null;
  } else {
    target = byId.get(targetId);
    tPhase = phaseOf(targetId);
  }
  const before = { start: task.startDate, end: task.endDate, preds: [...(task.predecessors || [])] };

  // Effective links: explicit dependencies plus implicit FS0 links for predecessor ids
  // that have no dependency record.
  const deps = (p.dependencies || []).filter(Boolean).map(d => ({ ...d }));
  const pairs = new Set(deps.map(d => pairKey(d.from, d.to)));
  for (const t of all) {
    for (const pid of t.predecessors || []) {
      if (!pairs.has(pairKey(pid, t.id)) && (pid === taskId || t.id === taskId || pid === target?.id || t.id === target?.id)) {
        deps.push({ from: pid, to: t.id, type: 'FS', lag: 0, lagUnit: 'days', source: 'implicit' });
        pairs.add(pairKey(pid, t.id));
      }
    }
  }

  const removed = [];
  const relinked = [];
  const oldPreds = deps.filter(d => d.to === taskId);
  const oldSuccs = deps.filter(d => d.from === taskId);
  let out = deps.filter(d => d.to !== taskId && d.from !== taskId);
  for (const d of [...oldPreds, ...oldSuccs]) removed.push(clean(d));
  const live = new Set(out.map(d => pairKey(d.from, d.to)));
  const addLink = (link, reason) => {
    const k = pairKey(link.from, link.to);
    if (link.from === link.to || live.has(k)) return false;
    live.add(k);
    const full = { lagUnit: 'days', ...link, source: 'reorder' };
    out.push(full);
    relinked.push({ ...clean(full), reason, ...(link.typeConflict ? { typeConflict: true } : {}) });
    delete full.typeConflict;
    return true;
  };

  // 1) Close the gap the task leaves.
  for (const s of oldSuccs) {
    for (const pr of oldPreds) {
      const pT = pr.type || 'FS';
      const sT = s.type || 'FS';
      const same = pT === sT;
      addLink({
        from: pr.from, to: s.to, type: sT,
        lag: same ? (Number(pr.lag) || 0) + (Number(s.lag) || 0) : 0,
        ...(same ? {} : { typeConflict: true }),
      }, 'close_gap');
    }
  }

  // 2) Insert at the new position.
  if (mode === 'after') {
    // The rows that followed the target (FS) now follow the moved task, keeping type and lag.
    const repoint = out.filter(d => d.from === targetId && (d.type || 'FS') === 'FS');
    out = out.filter(d => !repoint.includes(d));
    for (const d of repoint) { live.delete(pairKey(d.from, d.to)); removed.push(clean(d)); }
    for (const d of repoint) addLink({ ...d, from: taskId }, 'repoint_target_successor');
    addLink({ from: targetId, to: taskId, type: 'FS', lag: 0 }, 'insert_after');
  } else if (target) {
    // The task takes over the target's predecessors (all types, lag kept); the target follows it.
    const tid = target.id;
    const repoint = out.filter(d => d.to === tid);
    out = out.filter(d => !repoint.includes(d));
    for (const d of repoint) { live.delete(pairKey(d.from, d.to)); removed.push(clean(d)); }
    for (const d of repoint) addLink({ ...d, to: taskId }, 'repoint_target_predecessor');
    addLink({ from: taskId, to: tid, type: 'FS', lag: 0 }, 'insert_before');
  }

  // 3) Write links back; predecessors change only for pairs that were removed or added.
  p.dependencies = out;
  const removedPairs = new Set(removed.map(d => pairKey(d.from, d.to)));
  const addedTo = new Map();
  for (const r of relinked) { if (!addedTo.has(r.to)) addedTo.set(r.to, []); addedTo.get(r.to).push(r.from); }
  for (const t of all) {
    const keep = (t.predecessors || []).filter(pid => !removedPairs.has(pairKey(pid, t.id)) || live.has(pairKey(pid, t.id)));
    const next = [...new Set([...keep, ...(addedTo.get(t.id) || [])])];
    if (t.id === taskId || next.length !== (t.predecessors || []).length || next.some((x, i) => x !== t.predecessors[i])) t.predecessors = next;
  }

  // 4) Reject loops (explicit links plus every predecessor id; the project is a private clone).
  const virtual = all.map(t => ({ id: t.id, predecessors: t.predecessors || [] }));
  const insertLink = relinked.find(r => r.reason === 'insert_after' || r.reason === 'insert_before');
  const withoutInsert = insertLink ? out.filter(d => !(d.from === insertLink.from && d.to === insertLink.to)) : out;
  const preInsert = insertLink ? virtual.map(t => (t.id === insertLink.to ? { ...t, predecessors: t.predecessors.filter(x => x !== insertLink.from) } : t)) : virtual;
  if ((insertLink && wouldCreateCycle({ wbs: [{ id: '__', children: preInsert }], dependencies: withoutInsert }, insertLink.from, insertLink.to))
    || findDependencyCycles(virtual, out).some(c => c.includes(taskId))) {
    return { error: 'cycle', message: 'That move would create a dependency loop — drop the row somewhere else.' };
  }

  // 5) Move the row so the list order matches the new sequence. Ids never change.
  for (const ph of p.wbs) if (ph.children) ph.children = ph.children.filter(t => t.id !== taskId);
  if (!tPhase.children) tPhase.children = [];
  if (target) {
    const idx = tPhase.children.findIndex(t => t.id === target.id);
    task.sub = target.sub;
    tPhase.children.splice(mode === 'after' ? idx + 1 : idx, 0, task);
  } else {
    tPhase.children.push(task);
  }
  const moved = { id: taskId, fromPhase: fromPhase?.id ?? null, toPhase: tPhase.id, phaseChanged: (fromPhase?.id ?? null) !== tPhase.id, mode };

  // 6) Recompute once and report every task whose dates moved.
  const computed = calculateSchedule(p);
  const changes = [];
  for (const t of computed.wbs.flatMap(ph => ph.children || [])) {
    const [sb, eb] = beforeDates.get(t.id) || [];
    if (sb !== t.startDate || eb !== t.endDate) {
      changes.push({ id: t.id, name: t.name, startBefore: sb ?? null, startAfter: t.startDate, endBefore: eb ?? null, endAfter: t.endDate });
    }
  }

  return {
    project: computed,
    task,
    target: target || tPhase,
    before,
    moved,
    relinked,
    removed,
    changes,
    projectEndBefore,
    projectEndAfter: computed.endDate,
  };
}
