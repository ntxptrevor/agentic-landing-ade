import React, { useState } from 'react';
import { MODEL_REGISTRY, ACTIONS, routeAction, modelScores } from '../utils/modelRouter.js';
import { CODA_FIELDS, CODA_MAX_CHARS, buildCodaBlock, codaFromLinks, codaHash } from '../utils/codaBackup.js';

const BACKUP_COLOR = { written: 'var(--success)', unchanged: 'var(--success)', pending: 'var(--warning)', never: 'var(--text-dim)', mismatch: 'var(--critical)', failed: 'var(--critical)' };

const FIELDS = [
  ['model', 'Host model'], ['skills', 'Skills / plugins'], ['council', 'Model council'],
  ['projectFile', 'Project file'], ['jobtread', 'JobTread job'], ['drive', 'Google Drive project folder'],
  ['quickbooks', 'QuickBooks project'], ['kb', 'Knowledge base'], ['coda', 'Project Coda'],
];

export default function EnvironmentPanel({ meta, projectName, onConfirm, onLinks, onCoda }) {
  const last = meta.optimizationChain[meta.optimizationChain.length - 1] || {};
  const [draft, setDraft] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, last[k] || ''])));
  const [links, setLinks] = useState(meta.links);
  const [named, setNamed] = useState('');
  const hasCoda = meta.coda && (meta.coda.version || meta.coda.kb || meta.coda.jobtread);
  const [coda, setCoda] = useState(() => (hasCoda ? meta.coda : codaFromLinks(meta.links, projectName)));
  const backup = meta.sync?.codaBackup || { status: 'never' };
  const preview = buildCodaBlock({ ...coda, version: meta.coda?.version || 0 }, { event: 'preview', canonicalVersion: meta.version, lastChange: meta.changelog.slice(-1)[0]?.id });
  const dirty = codaHash({ ...coda, version: meta.coda?.version || 0 }) !== codaHash(meta.coda || {});

  return (
    <div>
      <div className="card">
        <h3>Optimization chain — confirm what this schedule is tied to</h3>
        <p className="input-hint">The agent fills these at initialization (host model, discovered skills, council seats, Project Coda selections). Confirming writes a dated entry here and to the project knowledge base.</p>
        <div className="form-row">
          {FIELDS.map(([k, label]) => (
            <div className="form-group" key={k}>
              <label>{label}</label>
              <input value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} placeholder="not located" />
            </div>
          ))}
        </div>
        <div className="btn-group"><button className="btn btn-primary" onClick={() => onConfirm(draft)}>Confirm optimization</button></div>
        {meta.optimizationChain.length > 0 && (
          <table className="task-table" style={{ marginTop: 16 }}>
            <thead><tr><th>Date</th>{FIELDS.slice(0, 5).map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>{[...meta.optimizationChain].reverse().map((o, i) => (
              <tr key={i}><td>{o.at.slice(0, 16).replace('T', ' ')}</td>{FIELDS.slice(0, 5).map(([k]) => <td key={k} style={{ fontSize: '0.75rem' }}>{o[k] || <span style={{ color: 'var(--critical)' }}>not located</span>}</td>)}</tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Project Coda — backed up to JobTread "Notes" on every sync</h3>
        <p className="input-hint">
          The project knowledge base holds the primary Coda. Every sync event (SYNC, daily JobTread pull, publish, Coda change) rewrites
          only the delimited Coda block at the end of the JobTread job's <b>Notes</b> custom field; the team's own notes above it are preserved.
          The agent performs the write and verifies it by reading the field back.
        </p>
        <div className="coda-status">
          <span>Backup: <b style={{ color: BACKUP_COLOR[backup.status] || 'var(--text)' }}>{backup.status}</b></span>
          {backup.lastAt && <span>last {backup.lastAt.slice(0, 16).replace('T', ' ')}</span>}
          {backup.lastHash && <span>sha {backup.lastHash}{backup.lastHash !== codaHash(meta.coda || {}) ? ' (stale)' : ''}</span>}
          {backup.failures > 0 && <span style={{ color: 'var(--critical)' }}>{backup.failures} failure(s): {backup.error}</span>}
          <span>Coda v{meta.coda?.version || 0}</span>
        </div>
        <div className="form-row">
          {CODA_FIELDS.map(([k, label]) => (
            <div className="form-group" key={k}>
              <label>{label}</label>
              <input value={coda[k] || ''} onChange={e => setCoda(c => ({ ...c, [k]: e.target.value }))} placeholder="not located" />
            </div>
          ))}
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" disabled={!dirty} onClick={() => onCoda(coda)}>{dirty ? 'Save Coda (backup on next sync)' : 'Coda saved'}</button>
          <button className="btn btn-secondary" onClick={() => setCoda(codaFromLinks(meta.links, projectName))}>Reset from sync targets</button>
          <button className="btn btn-secondary" onClick={() => { try { navigator.clipboard.writeText(preview); } catch { /* clipboard unavailable */ } }}>Copy Notes block</button>
        </div>
        <pre className="coda-preview">{preview}</pre>
        <p className="input-hint">{preview.length} / {CODA_MAX_CHARS} characters{preview.includes('· compact') ? ' — compact form (values truncated to fit)' : ''}.</p>
      </div>

      <div className="card">
        <h3>Canonical sync targets</h3>
        <div className="form-row">
          {[['jobtreadJobId', 'JobTread job ID'], ['driveFolderId', 'Drive project folder ID'], ['driveFolderName', 'Drive folder name'], ['quickbooksProjectId', 'QuickBooks project'], ['kbPath', 'Knowledge base path'], ['hostUrl', 'Hosted URL']].map(([k, l]) => (
            <div className="form-group" key={k}><label>{l}</label><input value={links[k] || ''} onChange={e => setLinks(x => ({ ...x, [k]: e.target.value }))} /></div>
          ))}
        </div>
        <div className="btn-group"><button className="btn btn-secondary" onClick={() => onLinks(links)}>Save links</button></div>
      </div>

      <div className="card">
        <h3>Model routing (mini-JEV)</h3>
        <div className="form-group" style={{ maxWidth: 360 }}>
          <label>Model named in an instruction (read as intent, not a hard pick)</label>
          <input value={named} onChange={e => setNamed(e.target.value)} placeholder="e.g. sonnet, opus, luna" />
        </div>
        <table className="task-table">
          <thead><tr><th>Action</th><th>Impact</th><th>Intel</th><th>Executor</th><th>Effort</th></tr></thead>
          <tbody>{ACTIONS.map(a => { const r = routeAction(a.id, { namedModel: named }); return (
            <tr key={a.id}><td>{a.label}</td><td>{a.impact}</td><td>{a.intel}</td><td><b>{r.executor}</b></td><td>{r.effort || '—'}</td></tr>
          ); })}</tbody>
        </table>
        <h3 style={{ marginTop: 16 }}>Model registry</h3>
        <table className="task-table">
          <thead><tr><th>Model</th><th>Provider</th><th>Cutting-edge</th><th>Cost-efficient</th><th>Efforts</th></tr></thead>
          <tbody>{MODEL_REGISTRY.map(m => { const s = modelScores(m); return (
            <tr key={m.id}><td>{m.label}{m.restricted ? ' *' : ''}</td><td>{m.provider}</td><td>{s.cuttingEdge}</td><td>{s.costEfficient}</td><td>{m.efforts.join(', ')}</td></tr>
          ); })}</tbody>
        </table>
        <p className="input-hint">* Restricted seat: never sees owner, bid, pricing or personnel content (council rule). Scores are relative; live prices come from the ntxp-model-router registry.</p>
      </div>
    </div>
  );
}
