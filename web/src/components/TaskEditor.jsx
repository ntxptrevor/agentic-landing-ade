import React, { useState } from 'react';

export default function TaskEditor({ wbs: initialWbs, dependencies: initialDeps, onDone, onBack }) {
  const [wbs, setWbs] = useState(JSON.parse(JSON.stringify(initialWbs)));
  const [deps, setDeps] = useState(JSON.parse(JSON.stringify(initialDeps)));
  const [activePhase, setActivePhase] = useState(0);

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
    setWbs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const removed = next[phaseIdx].children.splice(taskIdx, 1)[0];
      // Clean up dependencies referencing removed task
      for (const phase of next) {
        for (const task of phase.children) {
          task.predecessors = task.predecessors.filter(id => id !== removed.id);
        }
      }
      // Re-number tasks in this phase
      next[phaseIdx].children.forEach((t, i) => {
        t.id = `${next[phaseIdx].id}.${i + 1}`;
        t.wbsCode = t.id;
      });
      return next;
    });
    setDeps(prev => prev.filter(d => d.from !== wbs[phaseIdx].children[taskIdx]?.id && d.to !== wbs[phaseIdx].children[taskIdx]?.id));
  };

  const updatePredecessors = (phaseIdx, taskIdx, value) => {
    const predIds = value.split(',').map(s => s.trim()).filter(Boolean);
    setWbs(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[phaseIdx].children[taskIdx].predecessors = predIds;
      return next;
    });

    // Rebuild deps from scratch based on current WBS
    setDeps(() => {
      const newDeps = [];
      const updated = JSON.parse(JSON.stringify(wbs));
      updated[phaseIdx].children[taskIdx].predecessors = predIds;
      for (const phase of updated) {
        for (const task of phase.children) {
          for (const predId of task.predecessors) {
            newDeps.push({ from: predId, to: task.id, type: 'FS', lag: 0, lagUnit: 'days' });
          }
        }
      }
      return newDeps;
    });
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
                        value={task.predecessors.join(', ')}
                        onChange={e => updatePredecessors(activePhase, ti, e.target.value)}
                        placeholder="e.g. 1.1, 1.2"
                        title="Comma-separated WBS codes of predecessor tasks"
                      />
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
