// Drag a row up or down in the canonical schedule to move its dates: the task is
// re-sequenced to follow the row it was dropped under (FS 0). Its old successors are
// re-linked to its old predecessors so the chain it left stays closed, and CPM then
// recomputes every date. Pure: returns a new project plus a changelog description.

export function moveTaskAfter(project, taskId, targetId) {
  if (!taskId || !targetId || taskId === targetId) return null;
  const p = JSON.parse(JSON.stringify(project));
  const all = p.wbs.flatMap(ph => ph.children);
  const task = all.find(t => t.id === taskId);
  const target = all.find(t => t.id === targetId);
  if (!task || !target) return null;
  const before = { start: task.startDate, end: task.endDate, preds: [...(task.predecessors || [])] };
  const oldPreds = (p.dependencies || []).filter(d => d.to === taskId);
  const oldSuccs = (p.dependencies || []).filter(d => d.from === taskId);
  let deps = (p.dependencies || []).filter(d => d.to !== taskId && d.from !== taskId);
  // Close the gap: each old successor now follows the task's old predecessors.
  for (const s of oldSuccs) {
    for (const pr of oldPreds) {
      if (pr.from === s.to || deps.some(d => d.from === pr.from && d.to === s.to)) continue;
      deps.push({ from: pr.from, to: s.to, type: 'FS', lag: 0, lagUnit: 'days', source: 'reorder' });
    }
  }
  // The rows that followed the target now follow the moved task (it is inserted, not stacked).
  const targetSuccs = deps.filter(d => d.from === targetId && d.type === 'FS' && d.to !== taskId);
  deps = deps.filter(d => !(d.from === targetId && d.type === 'FS' && d.to !== taskId));
  for (const ts of targetSuccs) deps.push({ ...ts, from: taskId, source: 'reorder' });
  deps.push({ from: targetId, to: taskId, type: 'FS', lag: 0, lagUnit: 'days', source: 'reorder' });
  // Reject if the result has a cycle.
  if (hasCycle(all.map(t => t.id), deps)) return { error: 'That move would create a dependency loop — drop the row somewhere else.' };
  p.dependencies = deps;
  for (const t of all) t.predecessors = [...new Set(deps.filter(d => d.to === t.id).map(d => d.from))];
  delete task.constraintStart;
  // Move the row itself so the list order matches the new sequence.
  for (const ph of p.wbs) ph.children = ph.children.filter(t => t.id !== taskId);
  const tPhase = p.wbs.find(ph => ph.children.some(t => t.id === targetId));
  const idx = tPhase.children.findIndex(t => t.id === targetId);
  task.sub = target.sub;
  tPhase.children.splice(idx + 1, 0, task);
  return { project: p, task, target, before };
}

function hasCycle(ids, deps) {
  const out = new Map(ids.map(i => [i, []]));
  for (const d of deps) if (out.has(d.from)) out.get(d.from).push(d.to);
  const state = new Map();
  const visit = n => {
    state.set(n, 1);
    for (const m of out.get(n) || []) {
      if (state.get(m) === 1) return true;
      if (!state.get(m) && visit(m)) return true;
    }
    state.set(n, 2);
    return false;
  };
  return ids.some(i => !state.get(i) && visit(i));
}
