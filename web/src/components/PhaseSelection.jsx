import React, { useState } from 'react';
import { CONSTRUCTION_PHASES } from '../data/constructionPhases.js';

export default function PhaseSelection({ selectedIds, onDone, onBack }) {
  const [selected, setSelected] = useState(new Set(selectedIds));

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(CONSTRUCTION_PHASES.map(p => p.id)));
  };

  const handleDone = () => {
    if (selected.size === 0) return;
    // Preserve the order from CONSTRUCTION_PHASES
    const ordered = CONSTRUCTION_PHASES.filter(p => selected.has(p.id)).map(p => p.id);
    onDone(ordered);
  };

  return (
    <div className="card">
      <h2>Select Construction Phases</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 16 }}>
        Choose the phases that apply to your project. Tasks within each phase can be customized next.
      </p>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={selectAll}>
          Select All
        </button>
      </div>
      <div className="phase-grid">
        {CONSTRUCTION_PHASES.map(phase => (
          <div
            key={phase.id}
            className={`phase-card ${selected.has(phase.id) ? 'selected' : ''}`}
            onClick={() => toggle(phase.id)}
          >
            <div className="phase-name">{phase.name}</div>
            <div className="phase-count">{phase.defaultTasks.length} default tasks</div>
          </div>
        ))}
      </div>
      <div className="btn-group">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button
          className="btn btn-primary"
          onClick={handleDone}
          disabled={selected.size === 0}
        >
          Continue with {selected.size} phase{selected.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
