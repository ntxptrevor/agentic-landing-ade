import React, { useState } from 'react';
import { detectModules, MODULE_BY_ID } from '../data/jevTaxonomy.js';

const DOC_TYPES = [
  { id: 'project_manual', label: 'Project Manual' },
  { id: 'specifications', label: 'Specifications (Div 01 Summary / Scheduling)' },
  { id: 'ugc', label: 'Owner Uniform General Conditions (UGC)' },
  { id: 'supplementary', label: 'Supplementary / Special Conditions' },
  { id: 'scope', label: 'Scope of Work / JOC Detailed Scope' },
  { id: 'plans', label: 'Plans / Drawings' },
];
const ACK_PHRASE = 'NO PROJECT SPECIFIC REQUIREMENTS';
const TEXT_EXT = /\.(txt|md|csv|eml|json|xml|html?)$/i;

export default function RequirementsGate({ requirements, onDone, onBack }) {
  const [docs, setDocs] = useState(requirements.documents || []);
  const [specText, setSpecText] = useState(requirements.specText || '');
  const [docType, setDocType] = useState('project_manual');
  const [ackMode, setAckMode] = useState(requirements.status === 'acknowledged_none');
  const [ackText, setAckText] = useState('');
  const [ackName, setAckName] = useState('');

  const addFiles = async (files) => {
    const added = [];
    for (const f of files) {
      const entry = { name: f.name, type: docType, size: f.size, addedAt: new Date().toISOString(), parsed: false };
      if (TEXT_EXT.test(f.name)) {
        try {
          const text = await f.text();
          entry.parsed = true;
          entry.chars = text.length;
          setSpecText(prev => `${prev}\n\n=== ${f.name} ===\n${text}`.trim());
        } catch { /* left unparsed */ }
      } else {
        entry.note = 'Binary document — the agent parses it (LandingAI ADE) and returns the scheduling requirements. Paste extracted sections below to apply them now.';
      }
      added.push(entry);
    }
    setDocs(prev => [...prev, ...added]);
  };

  const detected = detectModules(specText);
  const hasDocs = docs.length > 0 || specText.trim().length > 200;
  const ackValid = ackText.trim().toUpperCase() === ACK_PHRASE && ackName.trim().length > 1;
  const canContinue = ackMode ? ackValid : hasDocs;

  const submit = () => {
    if (!canContinue) return;
    onDone({
      status: ackMode ? 'acknowledged_none' : 'uploaded',
      documents: ackMode ? [] : docs,
      specText: ackMode ? '' : specText,
      detected: ackMode ? [] : detected,
      acknowledgement: ackMode ? { by: ackName.trim(), phrase: ACK_PHRASE, at: new Date().toISOString(), basis: 'NTXP standard sequence + skill rules + best practices' } : null,
    });
  };

  return (
    <div className="card">
      <h2>Project-Specific Schedule Requirements</h2>
      <div className="gate-banner">
        <strong>Required before any schedule is generated.</strong> Upload the Project Manual, Specifications
        (Division 01 summary of work, scheduling, phasing and submittal sections) or the public owner's
        Uniform General Conditions — or explicitly confirm that none exist.
      </div>

      <div className="tabs" style={{ marginTop: 16 }}>
        <button className={`tab ${!ackMode ? 'active' : ''}`} onClick={() => setAckMode(false)}>Upload Requirements</button>
        <button className={`tab ${ackMode ? 'active' : ''}`} onClick={() => setAckMode(true)}>None Exist</button>
      </div>

      {!ackMode && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Files</label>
              <input type="file" multiple onChange={e => addFiles([...e.target.files])} />
            </div>
          </div>
          {docs.length > 0 && (
            <table className="task-table" style={{ marginBottom: 16 }}>
              <thead><tr><th>Document</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr key={i}>
                    <td>{d.name}</td>
                    <td>{DOC_TYPES.find(t => t.id === d.type)?.label}</td>
                    <td style={{ fontSize: '0.75rem', color: d.parsed ? 'var(--success)' : 'var(--warning)' }}>
                      {d.parsed ? `Text read (${d.chars?.toLocaleString()} chars)` : d.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="form-group">
            <label>Requirement text (pasted or extracted sections)</label>
            <textarea className="text-input" rows={8} value={specText} onChange={e => setSpecText(e.target.value)}
              placeholder="Paste Division 01 scheduling, phasing, work-hour, submittal, inspection and closeout requirements here..." />
          </div>
          {detected.length > 0 && (
            <div className="detect-list">
              <h3>Scope modules detected in requirements</h3>
              {detected.map(d => (
                <span key={d.id} className={`detect-chip ${d.strength}`} title={d.hits.map(h => `${h.keyword} ×${h.count}`).join(', ')}>
                  {MODULE_BY_ID[d.id].label} · {d.strength}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {ackMode && (
        <div className="ack-box">
          <p>I confirm that this project has <strong>no Project Manual, Specifications or UGC scheduling requirements</strong>.
            The schedule will be built from the NTXP standard sequence, skill rules and best practices, and this
            acknowledgement is written to the canonical changelog.</p>
          <div className="form-row">
            <div className="form-group">
              <label>Type exactly: {ACK_PHRASE}</label>
              <input value={ackText} onChange={e => setAckText(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Acknowledged by</label>
              <input value={ackName} onChange={e => setAckName(e.target.value)} placeholder="Full name" />
            </div>
          </div>
        </div>
      )}

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={!canContinue} onClick={submit}>
          {canContinue ? 'Continue to Scope Modules' : ackMode ? 'Acknowledgement incomplete' : 'Upload requirements to continue'}
        </button>
      </div>
    </div>
  );
}
