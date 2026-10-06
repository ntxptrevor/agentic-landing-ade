import React, { useState } from 'react';
import { parseProcurementImport, buildProcurementTasks } from '../utils/procurementAudit.js';

const SOURCES = [
  { key: 'jobtread', label: 'JobTread', desc: 'POs, vendor orders, invoices, bills' },
  { key: 'gdrive', label: 'Google Drive', desc: 'Submittals, approvals, contracts' },
  { key: 'lightfield', label: 'Lightfield CRM', desc: 'Opportunities, tasks, meetings' },
  { key: 'gmail', label: 'Gmail', desc: 'PO confirmations, approval emails' },
  { key: 'gcal', label: 'Google Calendar', desc: 'Pre-install meetings, inspections' },
];

export default function ProcurementPanel({ project, onImport }) {
  const [jsonInput, setJsonInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(false);

  const existingProcurement = (project.wbs || []).flatMap(p =>
    (p.children || []).filter(t => t.category === 'procurement')
  );

  const handleParse = () => {
    try {
      setError('');
      const data = parseProcurementImport(jsonInput);
      setPreview(data);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target.result);
      try {
        setError('');
        const data = parseProcurementImport(ev.target.result);
        setPreview(data);
      } catch (err) {
        setError(err.message);
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleInject = () => {
    if (!preview || !onImport) return;
    const preConPhase = project.wbs.find(p =>
      p.name.toLowerCase().includes('pre-construction') || p.name.toLowerCase().includes('preconstruction')
    );
    const phaseId = preConPhase ? preConPhase.id : project.wbs[0]?.id || '1';
    const existingCount = preConPhase ? preConPhase.children.length : 0;
    const tasks = buildProcurementTasks(preview.entries, phaseId, existingCount + 1);
    onImport(phaseId, tasks);
    setImported(true);
  };

  return (
    <div className="procurement-panel">
      <h2>Procurement Audit</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16 }}>
        Auto-audit connected platforms for procurement documents, approvals, and events.
        Discovered items become <strong style={{ color: 'var(--procurement)' }}>Procurement:</strong> tasks
        in the Pre-Construction phase.
      </p>

      <div className="card">
        <h3>Connected Sources</h3>
        <div className="procurement-sources">
          {SOURCES.map(s => (
            <div key={s.key} className="source-badge" title={s.desc}>
              {s.label}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Run the <strong>procurement-audit</strong> skill in Claude to query these sources
          for your project and generate a procurement audit JSON.
        </p>
      </div>

      {existingProcurement.length > 0 && (
        <div className="card">
          <h3>Current Procurement Tasks <span className="procurement-count">{existingProcurement.length}</span></h3>
          <table className="procurement-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>Task</th>
                <th>Duration</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {existingProcurement.map(t => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--text-dim)' }}>{t.wbsCode}</td>
                  <td style={{ color: 'var(--procurement)', fontWeight: 700 }}>{t.name}</td>
                  <td>{t.duration}d</td>
                  <td style={{ color: 'var(--text-dim)' }}>{t.startDate || '—'}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{t.endDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Import Procurement Audit</h3>
        <div className="procurement-import-area">
          <div style={{ marginBottom: 8, color: 'var(--text-dim)' }}>
            Paste audit JSON or import a file
          </div>
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            style={{ marginBottom: 8 }}
          />
          <textarea
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder='{"project":"...","entries":[{"name":"Procurement: PO Received","date":"2025-09-24","source":"JobTread","documentType":"vendorOrder","duration":1}]}'
          />
        </div>
        {error && (
          <div style={{ color: 'var(--critical)', fontSize: '0.8rem', marginBottom: 8 }}>{error}</div>
        )}
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={handleParse} disabled={!jsonInput.trim()}>
            Preview
          </button>
        </div>
      </div>

      {preview && (
        <div className="card">
          <h3>
            Preview: {preview.entries.length} Procurement Entries
            {preview.project && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> — {preview.project}</span>}
          </h3>
          {preview.sources.length > 0 && (
            <div className="procurement-sources" style={{ marginBottom: 12 }}>
              {preview.sources.map(s => (
                <span key={s} className="source-badge connected">{s}</span>
              ))}
            </div>
          )}
          <table className="procurement-table">
            <thead>
              <tr>
                <th>Task Name</th>
                <th>Date</th>
                <th>Source</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {preview.entries.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--procurement)', fontWeight: 700 }}>{e.name}</td>
                  <td>{e.date || '—'}</td>
                  <td>{e.source}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{e.documentType}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-group">
            <button
              className="btn btn-primary"
              onClick={handleInject}
              disabled={imported}
            >
              {imported ? 'Injected into Schedule' : 'Add to Pre-Construction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
