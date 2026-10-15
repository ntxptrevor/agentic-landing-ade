import React, { useState } from 'react';
import { KINDS, classifyFile, extractText, analyzeIntake } from '../utils/fileIntake.js';
import { JEV_MODULES } from '../data/jevTaxonomy.js';
import { SCOPE_TIERS, SECTORS, CONSTRAINTS } from '../data/jevOverlap.js';
import { matchProjects } from '../utils/canonical.js';

const nextMonday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
};

// Upload anything (specs, schedules, quotes, plans, photos, emails) → the skill's deterministic
// logic reads it → an instant canonical schedule ready to review and save.
export default function InstantSchedule({ initialName = '', projects = [], currentSlug = '', onBuild, onCancel }) {
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('bid');
  const [startDate, setStartDate] = useState(nextMonday);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [mods, setMods] = useState({});
  const [scope, setScope] = useState(null);
  const [ackNone, setAckNone] = useState(false);
  const [useImport, setUseImport] = useState(true);
  const [drag, setDrag] = useState(false);
  // Existing KB project chosen for this build ('' = undecided, '__new__' = create a new one).
  const [target, setTarget] = useState(currentSlug || '');
  const matches = currentSlug ? [] : matchProjects(projects, { name, number });
  const chosen = projects.find(p => p.slug === (currentSlug || target));
  const awarded = chosen?.status === 'active';
  const identityOk = !!currentSlug || !matches.length || !!target;

  const addFiles = async fileList => {
    const files = [...fileList];
    setBusy(true);
    const added = [];
    for (const f of files) {
      const ex = await extractText(f);
      added.push({ file: f, name: f.name, size: f.size, kind: classifyFile(f, ex.text), text: ex.text, note: ex.error || ex.note || (ex.truncated ? `First 150 of ${ex.pages} pages read` : ''), pages: ex.pages });
    }
    setItems(prev => [...prev, ...added]);
    setBusy(false);
    setAnalysis(null);
  };

  const analyze = () => {
    const a = analyzeIntake(items, name);
    setAnalysis(a);
    setMods(Object.fromEntries(a.modules.map(m => [m.id, m.strength === 'strong'])));
    setScope({ tier: a.tier, sf: a.sf || '', sector: a.sector || '', constraints: a.constraints, contractValue: a.contractValue || '', ownerProfile: a.ownerProfile });
    setUseImport(a.schedules.some(s => s.wbs?.length));
  };

  const imported = analysis?.schedules.find(s => s.wbs?.length);
  const hasReq = (analysis?.requirementsDocs || []).length > 0;
  const unread = analysis?.unreadSpecs || [];
  const ready = name.trim() && identityOk && analysis && scope && (hasReq || ackNone) && (useImport && imported ? true : scope.tier && scope.sector && Number(scope.sf) > 0);

  const build = () => onBuild({
    name: name.trim(), number: number.trim(), status: awarded ? 'active' : status,
    existingSlug: currentSlug || (target && target !== '__new__' ? target : ''), startDate: (useImport && imported?.startDate) || startDate,
    modules: Object.entries(mods).filter(([, v]) => v).map(([k]) => k),
    scope: { ...scope, sf: Number(scope.sf) || 0, contractValue: Number(scope.contractValue) || null, valueYear: new Date().getFullYear() },
    imported: useImport ? imported : null,
    analysis, items, ackNone: !hasReq && ackNone,
  });

  return (
    <div className="card instant">
      <h2>Instant schedule</h2>
      <p className="input-hint">Drop specs, existing schedules (MS Project XML / CSV), quotes, plans, site photos and emails. The skill reads them in your browser, proposes the scope and builds a canonical schedule you can edit and save.</p>
      <div className="form-row">
        <div className="form-group"><label>Project name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. UNT Union Starbucks Ph 3" /></div>
        <div className="form-group"><label>Job / bid number</label><input value={number} onChange={e => setNumber(e.target.value)} placeholder="optional" /></div>
        <div className="form-group"><label>Status</label>
          <select value={awarded ? 'active' : status} disabled={awarded} title={awarded ? 'This project is awarded — it stays in its project folder' : ''} onChange={e => setStatus(e.target.value)}><option value="bid">Pursuit (bid folder)</option><option value="active">Awarded (project folder)</option></select>
        </div>
        <div className="form-group"><label>Planned start</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      </div>

      {matches.length > 0 && (
        <div className={`req-gate ${target ? 'ok' : ''}`} role="group" aria-label="Existing project match">
          <b>This looks like an existing knowledge-base project.</b> Pick it so the schedule is added as its next version instead of a second canonical:
          <div className="constraint-row" style={{ marginTop: 6 }}>
            {matches.map(p => (
              <label key={p.slug} className={`constraint-chip ${target === p.slug ? 'on' : ''}`}>
                <input type="radio" name="kb-target" checked={target === p.slug} onChange={() => setTarget(p.slug)} />
                {p.number ? `${p.number} · ` : ''}{p.name} <span className="input-hint">({p.slug}{p.status ? `, ${p.status}` : ''}{p.version ? `, v${p.version}` : ''} — {p.why})</span>
              </label>
            ))}
            <label className={`constraint-chip ${target === '__new__' ? 'on' : ''}`}>
              <input type="radio" name="kb-target" checked={target === '__new__'} onChange={() => setTarget('__new__')} /> No — create a new project
            </label>
          </div>
        </div>
      )}

      <label className={`dropzone ${drag ? 'over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
        <input type="file" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
          accept=".pdf,.xml,.mpp,.csv,.xlsx,.xls,.docx,.doc,.txt,.md,.eml,.msg,.png,.jpg,.jpeg,.heic,.webp,.gif,.tif,.tiff,.dwg,.json" />
        <b>{busy ? 'Reading files…' : 'Drop files here or click to choose'}</b>
        <span>PDF, Word, MS Project XML, CSV, email, plans, photos</span>
      </label>

      {items.length > 0 && (
        <table className="task-table intake-table">
          <thead><tr><th>File</th><th>Type</th><th>Read</th><th /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.name} <span className="input-hint">{Math.round(it.size / 1024)} KB</span></td>
                <td><select value={it.kind} onChange={e => setItems(prev => prev.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>
                  {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></td>
                <td className="input-hint">{it.text ? `${it.text.length.toLocaleString()} chars` : ''} {it.note}</td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => { setItems(prev => prev.filter((_, j) => j !== i)); setAnalysis(null); }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="btn-group" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={analyze} disabled={!items.length || busy}>Read files</button>
        {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>

      {analysis && scope && (
        <div className="instant-result">
          {imported && (
            <label className="constraint-chip on" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={useImport} onChange={e => setUseImport(e.target.checked)} />
              Start from the uploaded schedule "{imported.file}" ({imported.taskCount} tasks, {imported.linkCount} links)
            </label>
          )}
          <h3>Scope read from your files</h3>
          <div className="form-row">
            <div className="form-group"><label>Scope tier</label>
              <select value={scope.tier} onChange={e => setScope(s => ({ ...s, tier: e.target.value }))}>{Object.entries(SCOPE_TIERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
            </div>
            <div className="form-group"><label>Affected SF {analysis.sfCandidates.length > 1 && <span className="input-hint">(found {analysis.sfCandidates.join(', ')})</span>}</label>
              <input type="number" value={scope.sf} onChange={e => setScope(s => ({ ...s, sf: e.target.value }))} />
            </div>
            <div className="form-group"><label>Owner sector</label>
              <select value={scope.sector} onChange={e => setScope(s => ({ ...s, sector: e.target.value }))}><option value="">Select…</option>{Object.entries(SECTORS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
            </div>
            <div className="form-group"><label>Contract value ($)</label>
              <input type="number" value={scope.contractValue} onChange={e => setScope(s => ({ ...s, contractValue: e.target.value }))} />
            </div>
          </div>
          <div className="constraint-row">
            {Object.entries(CONSTRAINTS).map(([k, c]) => (
              <label key={k} className={`constraint-chip ${scope.constraints.includes(k) ? 'on' : ''}`}>
                <input type="checkbox" checked={scope.constraints.includes(k)} onChange={() => setScope(s => ({ ...s, constraints: s.constraints.includes(k) ? s.constraints.filter(x => x !== k) : [...s.constraints, k] }))} /> {c.label}
              </label>
            ))}
          </div>
          <h3>Modules detected <span className="input-hint">(strong signals pre-checked — confirm each)</span></h3>
          <div className="constraint-row">
            {JEV_MODULES.filter(m => m.id in mods).map(m => (
              <label key={m.id} className={`constraint-chip ${mods[m.id] ? 'on' : ''}`}>
                <input type="checkbox" checked={!!mods[m.id]} onChange={() => setMods(x => ({ ...x, [m.id]: !x[m.id] }))} /> {m.label}
              </label>
            ))}
            {!Object.keys(mods).length && <span className="input-hint">No module keywords found — the backbone schedule will be used.</span>}
          </div>
          {analysis.leadItems.length > 0 && (
            <>
              <h3>Lead times found in quotes</h3>
              <ul className="input-hint">{analysis.leadItems.map((l, i) => <li key={i}>{l.item} — {l.days} days</li>)}</ul>
            </>
          )}
          {(analysis.contractDays || analysis.ntpText) && <p className="input-hint">Contract terms found: {analysis.contractDays ? `${analysis.contractDays} calendar days` : ''} {analysis.ntpText ? `· start ${analysis.ntpText}` : ''}</p>}
          {unread.length > 0 && (
            <div className="req-gate">
              No text could be read from {unread.join(', ')} (scanned or image-only). It does not count as read requirements — upload a readable (OCR'd) copy{hasReq ? '' : ', or confirm below that no schedule requirements exist'}.
            </div>
          )}
          <div className={`req-gate ${hasReq ? 'ok' : ''}`}>
            {hasReq
              ? <>Schedule requirements read: {analysis.requirementsDocs.join(', ')}</>
              : <label><input type="checkbox" checked={ackNone} onChange={e => setAckNone(e.target.checked)} /> No project manual, specifications or UGC with schedule requirements exist for this project (required to continue without one).</label>}
          </div>
          <div className="btn-group" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={build} disabled={!ready}>Build instant schedule</button>
            {!identityOk && <span className="input-hint">Choose the matching project (or "create a new project") above first.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
