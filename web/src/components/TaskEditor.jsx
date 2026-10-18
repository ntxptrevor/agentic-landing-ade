import React, { useState } from 'react';

export default function TaskEditor({ wbs: initialWbs, dependencies: initialDeps, onDone, onBack }) {
  const [wbs, setWbs] = useState(JSON.parse(JSON.stringify(initialWbs)));
  const [deps, setDeps] = useState(JSON.parse(JSON.stringify(initialDeps)));
  const [activePhase, setActivePhase] = useState(0);
  // Predecessor text is edited as a draft and committed on blur / Enter (no partial ids).
  const [drafts, setDrafts] = useState({});

  const allTasks = wbs.flatMap(p => p.children.map(t => ({ ...t, phaseName: p.name })));

  const updateTask = (phaseIdx, taskIdx, field, value) => {
    setWbs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[phaseIdx].children[taskIdx][field] = value;
      return next;
    });
  };

  const addTask = (phaseIdx) => {
    setWbs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const phase = next[phaseIdx];
      const newIdx = phase.children.length + 1;
      phase.children.push({
        id: `${phase.id}.${newIdx}`,
        type: 'task',
        name: 'New Task',
        wbsCode: `${phase.id}.${newIdx}`,
        duration: 5,
        durationUnit: 'days',
        trade: 'General',
        predecessors: [],
        successors: [],
        isMilestone: false,
        isCritical: false,
        notes: '',
        children: [],
      });
      return next;
    });
  };

  const removeTask = (phaseIdx, taskIdx) => {
    // Work from the current state so the WBS and the dependency list are remapped together.
    const next = JSON.parse(JSON.stringify(wbs));
    const removed = next[phaseIdx].children.splice(taskIdx, 1)[0];
    if (!removed) return;
    // Old-to-new IDs for the tasks renumbered in this phase
    const idMap = new Map();
    next[phaseIdx].children.forEach((t, i) => {
      const newId = `${next[phaseIdx].id}.${i + 1}`;
      if (t.id !== newId) idMap.set(t.id, newId);
      t.id = newId;
      t.wbsCode = newId;
    });
    const remap = id => idMap.get(id) || id;
    // Drop links to the removed task and remap every remaining reference
    for (const phase of next) {
      for (const task of phase.children) {
        task.predecessors = (task.predecessors || []).filter(id => id !== removed.id).map(remap);
      }
    }
    setWbs(next);
    setDeps(prev => prev
      .filter(d => d.from !== removed.id && d.to !== removed.id)
      .map(d => ({ ...d, from: remap(d.from), to: remap(d.to) })));
  };

  // Only the edited task's incoming links change: links that stay keep their type and lag
  // (SS/FF/SF, lead/lag overlaps); only newly typed predecessors default to FS 0.
  const updatePredecessors = (phaseIdx, taskIdx, value) => {
    const predIds = [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];
    const taskId = wbs[phaseIdx].children[taskIdx].id;
    setWbs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[phaseIdx].children[taskIdx].predecessors = predIds;
      return next;
    });
    setDeps(prev => {
      const existing = new Map(prev.filter(d => d.to === taskId).map(d => [d.from, d]));
      const kept = predIds.map(from => existing.get(from) || { from, to: taskId, type: 'FS', lag: 0, lagUnit: 'days' });
      return prev.filter(d => d.to !== taskId).concat(kept);
    });
  };

  const commitPredecessors = (phaseIdx, taskIdx, taskId) => {
    const v = drafts[taskId];
    if (v == null) return;
    setDrafts(d => { const n = { ...d }; delete n[taskId]; return n; });
    updatePredecessors(phaseIdx, taskIdx, v);
  };

  const linkLabel = (task) => {
    const extra = deps.filter(d => d.to === task.id && ((d.type && d.type !== 'FS') || Number(d.lag)));
    return extra.map(d => `${d.from} ${d.type || 'FS'}${Number(d.lag) ? `${d.lag > 0 ? '+' : ''}${d.lag}d` : ''}`).join(', ');
  };

  const phase = wbs[activePhase];

  return (
    <div>
      <div className="card">
        <h2>Define Tasks & Dependencies</h2>
        <div className="tabs">
          {wbs.map((p, i) => (
            <button
              key={p.id}
              className={`tab ${i === activePhase ? 'active' : ''}`}
              onClick={() => setActivePhase(i)}
            >
              {p.name}
            </button>
          ))}
        </div>

        {phase && (
          <>
            <table className="task-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>WBS</th>
                  <th>Task Name</th>
                  <th style={{ width: 80 }}>Duration</th>
                  <th style={{ width: 120 }}>Trade</th>
                  <th style={{ width: 150 }}>Predecessors</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {phase.children.map((task, ti) => (
                  <tr key={task.id}>
                    <td style={{ color: 'var(--text-dim)' }}>{task.wbsCode}</td>
                    <td>
                      <input
                        value={task.name}
                        onChange={e => updateTask(activePhase, ti, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="task-input-dur"
                        type="number"
                        value={task.duration}
                        onChange={e => updateTask(activePhase, ti, 'duration', Number(e.target.value))}
                        min={1}
                      />
                    </td>
                    <td>
                      <input
                        value={task.trade}
                        onChange={e => updateTask(activePhase, ti, 'trade', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        value={drafts[task.id] ?? task.predecessors.join(', ')}
                        onChange={e => { const v = e.target.value; setDrafts(d => ({ ...d, [task.id]: v })); }}
                        onBlur={() => commitPredecessors(activePhase, ti, task.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitPredecessors(activePhase, ti, task.id); }}
                        placeholder="e.g. 1.1, 1.2"
                        title="Comma-separated WBS codes of predecessor tasks (existing link types and lags are kept; new links are FS 0)"
                      />
                      {linkLabel(task) && <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{linkLabel(task)}</div>}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeTask(activePhase, ti)}
                        title="Remove task"
                      >
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="btn-group">
              <button className="btn btn-secondary btn-sm" onClick={() => addTask(activePhase)}>
                + Add Task
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>All Tasks Reference</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
          Use these WBS codes when defining predecessors.
        </p>
        <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font)', columns: 2, columnGap: 24 }}>
          {allTasks.map(t => (
            <div key={t.id} style={{ padding: '2px 0' }}>
              <span style={{ color: 'var(--accent)' }}>{t.wbsCode}</span> {t.name}
              <span style={{ color: 'var(--text-dim)' }}> ({t.phaseName})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={() => onDone(wbs, deps)}>
          Continue to Review
        </button>
      </div>
    </div>
  );
}
