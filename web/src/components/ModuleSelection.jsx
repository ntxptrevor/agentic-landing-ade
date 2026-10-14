import React, { useMemo, useState } from 'react';
import { JEV_MODULES, JEV_CLASSES } from '../data/jevTaxonomy.js';
import { CONSTRUCTION_PHASES } from '../data/constructionPhases.js';
import { MODULE_TASKS } from '../data/jevModuleTasks.js';
import { SCOPE_TIERS, SECTORS, CONSTRAINTS } from '../data/jevOverlap.js';
import { OWNER_PROFILES } from '../data/jevCalibration.js';

// Trade groups a zone can carry (construction sub-phases; final clean / SC belong to the phase).
const TRADE_GROUPS = [...new Set(CONSTRUCTION_PHASES.find(p => p.id === 'construction').defaultTasks.map(t => t.sub))]
  .filter(sub => sub && !/final clean/i.test(sub));
const newZone = (n) => ({ name: `Zone ${String.fromCharCode(64 + n)}`, sf: '', subs: [...TRADE_GROUPS] });
const newPhase = (n) => ({ name: `Phase ${n}`, changeoverDays: 0, zones: [newZone(1)] });

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
  const zoned = !!scope.phasing;
  const zones = zoned ? scope.phasing.phases.flatMap(ph => ph.zones) : [];
  const zoneSf = zones.reduce((a, z) => a + (Number(z.sf) || 0), 0);
  const zonesReady = !zoned || zones.every(z => Number(z.sf) > 0 && z.subs.length && z.name.trim());
  const scopeReady = scope.tier && scope.sector && (zoned ? zoneSf > 0 : Number(scope.sf) > 0) && zonesReady && (scope.tier !== 'equipment' || Number(scope.units) > 0);
  const setPhasing = fn => setScope(x => ({ ...x, phasing: fn(JSON.parse(JSON.stringify(x.phasing))) }));
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
    })), {
      tier: scope.tier, sf: zoned ? zoneSf : Number(scope.sf), sector: scope.sector, constraints: scope.constraints,
      units: Number(scope.units) || 0,
      // Council audit #2 fields (all optional).
      contractValue: Number(scope.contractValue) || null, valueYear: Number(scope.valueYear) || null,
      ownerEquipmentValue: Number(scope.ownerEquipmentValue) || null,
      ownerProfile: scope.ownerProfile || 'default',
      contingencyWd: scope.contingencyWd === '' || scope.contingencyWd == null ? null : Number(scope.contingencyWd),
      ownerStoredItems: !!scope.ownerStoredItems, precast: !!scope.precast,
      wallLifts: Number(scope.wallLifts) || null, footprintSf: Number(scope.footprintSf) || null,
      weatherDays: scope.weatherDays === '' || scope.weatherDays == null ? null : Number(scope.weatherDays),
      phasing: zoned ? { phases: scope.phasing.phases.map(ph => ({ ...ph, changeoverDays: Number(ph.changeoverDays) || 0, zones: ph.zones.map(z => ({ ...z, sf: Number(z.sf) })) })) } : null,
    });
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
          {!zoned && <div className="form-group">
            <label>Affected area (SF)</label>
            <input type="number" min="1" value={scope.sf} onChange={e => setScope(x => ({ ...x, sf: e.target.value }))} placeholder="e.g. 6000" />
          </div>}
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
        <div className="form-row">
          <div className="form-group">
            <label>Contract value ($, optional)</label>
            <input type="number" min="0" value={scope.contractValue || ''} onChange={e => setScope(x => ({ ...x, contractValue: e.target.value }))} placeholder="e.g. 175000" />
          </div>
          <div className="form-group">
            <label>Value year</label>
            <input type="number" min="2000" value={scope.valueYear || ''} onChange={e => setScope(x => ({ ...x, valueYear: e.target.value }))} placeholder={String(new Date().getFullYear())} />
          </div>
          <div className="form-group">
            <label>Owner-furnished equipment in value ($)</label>
            <input type="number" min="0" value={scope.ownerEquipmentValue || ''} onChange={e => setScope(x => ({ ...x, ownerEquipmentValue: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Inspection notice profile</label>
            <select value={scope.ownerProfile || 'default'} onChange={e => setScope(x => ({ ...x, ownerProfile: e.target.value }))}>
              {Object.entries(OWNER_PROFILES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Re-inspection contingency (WD, blank = profile)</label>
            <input type="number" min="0" value={scope.contingencyWd ?? ''} onChange={e => setScope(x => ({ ...x, contingencyWd: e.target.value }))} placeholder={String(OWNER_PROFILES[scope.ownerProfile || 'default'].contingencyWd)} />
          </div>
          <div className="form-group">
            <label>Weather days (blank = automatic)</label>
            <input type="number" min="0" value={scope.weatherDays ?? ''} onChange={e => setScope(x => ({ ...x, weatherDays: e.target.value }))} placeholder="auto" />
          </div>
        </div>
        {choice.below_grade_structural === 'yes' && (
          <div className="form-row">
            <div className="form-group">
              <label>Structure footprint (SF)</label>
              <input type="number" min="1" value={scope.footprintSf || ''} onChange={e => setScope(x => ({ ...x, footprintSf: e.target.value }))} placeholder="200" />
            </div>
            <div className="form-group">
              <label>CIP wall lifts</label>
              <select value={scope.wallLifts || 2} onChange={e => setScope(x => ({ ...x, wallLifts: e.target.value }))}>
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <label className={`constraint-chip ${scope.precast ? 'on' : ''}`}>
              <input type="checkbox" checked={!!scope.precast} onChange={e => setScope(x => ({ ...x, precast: e.target.checked }))} /> Prefabricated / precast vault (crane set)
            </label>
          </div>
        )}
        <label className={`constraint-chip ${scope.ownerStoredItems ? 'on' : ''}`} style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={!!scope.ownerStoredItems} onChange={e => setScope(x => ({ ...x, ownerStoredItems: e.target.checked }))} /> Owner-stored FF&amp;E / equipment to transport to site
        </label>
        <label className="constraint-chip" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={zoned} onChange={e => setScope(x => ({ ...x, phasing: e.target.checked ? { phases: [newPhase(1)] } : null, constraints: e.target.checked && !x.constraints.includes('phased') ? [...x.constraints, 'phased'] : x.constraints }))} />
          {zoned ? '☑' : '☐'} Phased / zoned work — each phase and each zone is completed before the next starts
        </label>
        {zoned && (
          <div className="phasing-editor">
            {scope.phasing.phases.map((ph, pi) => (
              <div key={pi} className="phase-block">
                <div className="phase-head">
                  <input value={ph.name} onChange={e => setPhasing(p => { p.phases[pi].name = e.target.value; return p; })} />
                  <label>Owner change-over after (WD)
                    <input type="number" min="0" value={ph.changeoverDays} onChange={e => setPhasing(p => { p.phases[pi].changeoverDays = e.target.value; return p; })} style={{ width: 70 }} />
                  </label>
                  {scope.phasing.phases.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => setPhasing(p => { p.phases.splice(pi, 1); return p; })}>Remove phase</button>}
                </div>
                {ph.zones.map((z, zi) => (
                  <div key={zi} className="zone-block">
                    <div className="zone-head">
                      <input value={z.name} onChange={e => setPhasing(p => { p.phases[pi].zones[zi].name = e.target.value; return p; })} />
                      <input type="number" min="1" placeholder="SF" value={z.sf} onChange={e => setPhasing(p => { p.phases[pi].zones[zi].sf = e.target.value; return p; })} style={{ width: 90 }} />
                      {ph.zones.length > 1 && <button className="btn btn-secondary btn-sm" onClick={() => setPhasing(p => { p.phases[pi].zones.splice(zi, 1); return p; })}>Remove</button>}
                    </div>
                    <div className="constraint-row">
                      {TRADE_GROUPS.map(g => (
                        <label key={g} className={`constraint-chip ${z.subs.includes(g) ? 'on' : ''}`}>
                          <input type="checkbox" checked={z.subs.includes(g)} onChange={() => setPhasing(p => { const zz = p.phases[pi].zones[zi]; zz.subs = zz.subs.includes(g) ? zz.subs.filter(x => x !== g) : [...zz.subs, g]; return p; })} /> {g}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setPhasing(p => { p.phases[pi].zones.push(newZone(p.phases[pi].zones.length + 1)); return p; })}>+ Zone</button>
              </div>
            ))}
            <div className="btn-group" style={{ marginTop: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPhasing(p => { p.phases.push(newPhase(p.phases.length + 1)); return p; })}>+ Phase</button>
              <span className="input-hint" style={{ margin: 0 }}>Total {zoneSf.toLocaleString()} SF across {zones.length} zone(s). Each zone only carries the trade groups selected; it hands over before the next zone starts, and each phase ends with its own clean, punch and owner turnover.</span>
            </div>
          </div>
        )}
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
