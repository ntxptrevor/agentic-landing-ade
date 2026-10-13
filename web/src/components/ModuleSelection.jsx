import React, { useMemo, useState } from 'react';
import { JEV_MODULES, JEV_CLASSES } from '../data/jevTaxonomy.js';
import { CONSTRUCTION_PHASES } from '../data/constructionPhases.js';
import { MODULE_TASKS } from '../data/jevModuleTasks.js';
import { SCOPE_TIERS, SECTORS, CONSTRAINTS } from '../data/jevOverlap.js';

// Modules that remove NTXP backbone tasks when declined must be answered explicitly.
const BACKBONE_MODULES = new Set(CONSTRUCTION_PHASES.flatMap(p => p.defaultTasks.flatMap(t => t.module || [])));

export default function ModuleSelection({ detected = [], initial = [], initialScope = null, requirementsStatus, onDone, onBack }) {
  const detMap = useMemo(() => Object.fromEntries(detected.map(d => [d.id, d])), [detected]);
  const [choice, setChoice] = useState(() => {
    const c = {};
    for (const m of JEV_MODULES) {
      const prior = initial.find(x => x.id === m.id);
      if (prior) c[m.id] = prior.status === 'confirmed' ? 'yes' : 'no';
      else if (detMap[m.id]?.strength === 'strong') c[m.id] = 'yes';
      else if (detMap[m.id] || BACKBONE_MODULES.has(m.id)) c[m.id] = null;
      else c[m.id] = 'no';
    }
    return c;
  });

  const [scope, setScope] = useState(() => initialScope || {
    tier: '', sf: '', units: '',
    sector: detMap.icra || detMap.medical_specific ? 'healthcare' : detMap.secured_building ? 'secured' : detMap.isd_college ? 'isd' : '',
    constraints: [detMap.occupied_phasing && 'occupied', detMap.icra && 'icra'].filter(Boolean),
  });
  const scopeReady = scope.tier && scope.sector && Number(scope.sf) > 0 && (scope.tier !== 'equipment' || Number(scope.units) > 0);
  const toggleConstraint = c => setScope(x => ({ ...x, constraints: x.constraints.includes(c) ? x.constraints.filter(y => y !== c) : [...x.constraints, c] }));
  const pending = JEV_MODULES.filter(m => choice[m.id] === null);
  const set = (id, v) => setChoice(prev => ({ ...prev, [id]: v }));

  const submit = () => {
    if (pending.length || !scopeReady) return;
    onDone(JEV_MODULES.map(m => ({
      id: m.id,
      status: choice[m.id] === 'yes' ? 'confirmed' : 'declined',
      evidence: detMap[m.id] ? `documents: ${detMap[m.id].hits.map(h => h.keyword).join(', ')}` : 'user conversation',
      confirmedBy: 'user',
      at: new Date().toISOString(),
    })), { tier: scope.tier, sf: Number(scope.sf), sector: scope.sector, constraints: scope.constraints, units: Number(scope.units) || 0 });
  };

  return (
    <div className="card">
      <h2>Scope Modules</h2>
      <p className="input-hint">
        The NTXP 3-phase backbone (Preconstruction → Construction → Closeout) is always included. Each module below
        is only added once documents or you confirm it. {requirementsStatus === 'acknowledged_none' && 'No requirements were uploaded, so every module is confirmed by you.'}
      </p>
      <div className="scope-card">
        <h3>Scope profile — sets which backbone rows apply and how durations scale</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Scope tier</label>
            <select value={scope.tier} onChange={e => setScope(x => ({ ...x, tier: e.target.value }))}>
              <option value="">Select…</option>
              {Object.entries(SCOPE_TIERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Affected area (SF)</label>
            <input type="number" min="1" value={scope.sf} onChange={e => setScope(x => ({ ...x, sf: e.target.value }))} placeholder="e.g. 6000" />
          </div>
          <div className="form-group">
            <label>Owner sector</label>
            <select value={scope.sector} onChange={e => setScope(x => ({ ...x, sector: e.target.value }))}>
              <option value="">Select…</option>
              {Object.entries(SECTORS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </div>
          {scope.tier === 'equipment' && (
            <div className="form-group">
              <label>Units being replaced</label>
              <input type="number" min="1" value={scope.units} onChange={e => setScope(x => ({ ...x, units: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="constraint-row">
          {Object.entries(CONSTRAINTS).map(([k, c]) => (
            <label key={k} className={`constraint-chip ${scope.constraints.includes(k) ? 'on' : ''}`}>
              <input type="checkbox" checked={scope.constraints.includes(k)} onChange={() => toggleConstraint(k)} /> {c.label}
            </label>
          ))}
        </div>
        <p className="input-hint">Rows a tier removes are removed by your decision and logged. Size, sector and constraints scale trade durations (fixed-time items such as inspections, reviews and tests never scale); no construction activity exceeds 10 working days.</p>
      </div>
      {pending.length > 0 && <div className="gate-banner warn">{pending.length} module{pending.length > 1 ? 's' : ''} need a yes/no answer before continuing.</div>}
      <div className="module-grid">
        {JEV_MODULES.map(m => {
          const det = detMap[m.id];
          const cls = JEV_CLASSES.find(c => c.id === m.cls);
          const count = (MODULE_TASKS[m.id] || []).length + CONSTRUCTION_PHASES.flatMap(p => p.defaultTasks).filter(t => (t.module || []).includes(m.id)).length;
          return (
            <div key={m.id} className={`module-card ${choice[m.id] === 'yes' ? 'yes' : choice[m.id] === 'no' ? 'no' : 'pending'}`}>
              <div className="module-head">
                <span className="module-cls" style={{ background: cls?.color }}>{cls?.label}</span>
                {det && <span className={`detect-chip ${det.strength}`}>{det.strength} evidence</span>}
              </div>
              <div className="module-name">{m.label}</div>
              <div className="module-q">{m.confirm}</div>
              {det && <div className="module-ev">Found: {det.hits.slice(0, 4).map(h => h.keyword).join(', ')}</div>}
              <div className="module-foot">
                <span className="module-count">{count} tasks</span>
                <div className="yn">
                  <button className={`btn btn-sm ${choice[m.id] === 'yes' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set(m.id, 'yes')}>Yes</button>
                  <button className={`btn btn-sm ${choice[m.id] === 'no' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set(m.id, 'no')}>No</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="btn-group">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={pending.length > 0 || !scopeReady} onClick={submit}>{scopeReady ? 'Build Schedule from Confirmed Modules' : 'Complete the scope profile'}</button>
      </div>
    </div>
  );
}
