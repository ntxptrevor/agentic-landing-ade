import React, { useState } from 'react';
import { parseProcurementImport, buildProcurementTasks, deduplicateEntries } from '../utils/procurementAudit.js';

const SOURCES = [
  { key: 'jobtread', label: 'JobTread', desc: 'POs, vendor orders, invoices, bills', primary: true },
  { key: 'gdrive', label: 'Google Drive', desc: 'Submittals, approvals, contracts', primary: false },
  { key: 'lightfield', label: 'Lightfield CRM', desc: 'Opportunities, tasks, meetings', primary: false },
  { key: 'gmail', label: 'Gmail', desc: 'PO confirmations, approval emails', primary: false },
  { key: 'gcal', label: 'Google Calendar', desc: 'Pre-install meetings, inspections', primary: false },
];

export default function ProcurementPanel({ project, onImport }) {
  const [jsonInput, setJsonInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(false);

  const collectProcurement = (tasks) => {
    const result = [];
    for (const t of tasks) {
      if (t.category === 'procurement') result.push(t);
      if (t.children) result.push(...collectProcurement(t.children));
    }
    return result;
  };
  const existingProcurement = (project.wbs || []).flatMap(p =>
    collectProcurement(p.children || [])
  );
  const syncedCount = existingProcurement.filter(t => t.jobTreadTaskId).length;

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
    const { accepted, skipped } = deduplicateEntries(preview.entries, project.wbs);
    if (skipped.length > 0) {
      setPreview(prev => ({
        ...prev,
        entries: accepted,
        skipped: [...(prev.skipped || []), ...skipped],
      }));
    }
    if (accepted.length === 0) {
      setError('All entries are already in the schedule');
      return;
    }
    const tasks = buildProcurementTasks(accepted, phaseId, existingCount + 1);
    onImport(phaseId, tasks);
    setImported(true);
  };

  return (
    <div className="procurement-panel">
      <h2>Procurement Audit</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16 }}>
        Auto-audit connected platforms for procurement documents, approvals, and events.
        All entries are written to <strong style={{ color: 'var(--accent)' }}>JobTread</strong> as the
        source of truth, then visualized here as{' '}
        <strong style={{ color: 'var(--procurement)' }}>Procurement:</strong> tasks.
      </p>

      <div className="card">
        <h3>Source of Truth</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.8rem' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: 'var(--procurement)'
          }} />
          <strong>JobTread</strong>
          <span style={{ color: 'var(--text-dim)' }}>— primary record for all procurement data</span>
        </div>
        <div className="procurement-sources">
          {SOURCES.map(s => (
            <div key={s.key} className={`source-badge ${s.primary ? 'connected' : ''}`} title={s.desc}>
              {s.label}
              {s.primary && <span style={{ fontSize: '0.6rem', marginLeft: 4 }}>PRIMARY</span>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8 }}>
          Run the <strong>procurement-audit</strong> skill in Claude to query all sources.
          The skill writes entries to JobTread first, then outputs JSON for this view.
        </p>
      </div>

      {existingProcurement.length > 0 && (
        <div className="card">
          <h3>
            Current Procurement Tasks
            <span className="procurement-count">{existingProcurement.length}</span>
          </h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
            {syncedCount > 0 && (
              <span style={{ color: 'var(--procurement)' }}>
                {syncedCount} synced to JobTread
              </span>
            )}
            {syncedCount > 0 && syncedCount < existingProcurement.length && ' | '}
            {syncedCount < existingProcurement.length && (
              <span style={{ color: 'var(--warning)' }}>
                {existingProcurement.length - syncedCount} local only (not in JobTread)
              </span>
            )}
          </div>
          <table className="procurement-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>Task</th>
                <th>Duration</th>
                <th>Start</th>
                <th>End</th>
                <th>Sync</th>
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
                  <td>
                    {t.jobTreadTaskId
                      ? <span style={{ color: 'var(--procurement)', fontSize: '0.7rem' }}>Synced</span>
                      : <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>Local</span>
                    }
                  </td>
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
            placeholder='{"project":"...","jobId":"...","syncStatus":"synced","entries":[{"name":"Procurement: PO Received","date":"2025-09-24","source":"JobTread","documentType":"vendorOrder","jobTreadTaskId":"abc123","duration":1}]}'
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

          {preview.syncStatus === 'synced' && (
            <div style={{
              fontSize: '0.75rem', padding: '6px 12px', borderRadius: 'var(--radius)',
              background: 'rgba(16, 185, 129, 0.1)', color: 'var(--procurement)',
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span style={{ fontSize: '1rem' }}>&#10003;</span>
              All entries written to JobTread{preview.jobId && ` (Job: ${preview.jobId})`}
            </div>
          )}
          {preview.syncStatus === 'partial' && (
            <div style={{
              fontSize: '0.75rem', padding: '6px 12px', borderRadius: 'var(--radius)',
              background: 'rgba(240, 173, 78, 0.1)', color: 'var(--warning)',
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span style={{ fontSize: '1rem' }}>&#9888;</span>
              Partial sync — some entries written to JobTread, others pending
            </div>
          )}
          {preview.syncStatus === 'local-only' && (
            <div style={{
              fontSize: '0.75rem', padding: '6px 12px', borderRadius: 'var(--radius)',
              background: 'rgba(240, 173, 78, 0.1)', color: 'var(--warning)',
              marginBottom: 12
            }}>
              Not synced to JobTread — run the procurement-audit skill to write these to the project record
            </div>
          )}

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
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {preview.entries.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--procurement)', fontWeight: 700 }}>{e.name}</td>
                  <td>{e.date || '—'}</td>
                  <td>{e.source}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{e.documentType}</td>
                  <td>
                    {e.jobTreadTaskId
                      ? <span style={{ color: 'var(--procurement)', fontSize: '0.7rem' }}>Synced</span>
                      : <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }}>Local</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.skipped && preview.skipped.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Skipped ({preview.skipped.length} already tracked)
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {preview.skipped.map((s, i) => (
                  <div key={i} style={{ padding: '2px 0' }}>
                    {s.name} — <em>{s.reason}</em>
                  </div>
                ))}
              </div>
            </div>
          )}

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
