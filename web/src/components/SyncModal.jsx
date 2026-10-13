import React, { useEffect, useMemo, useState } from 'react';
import { JEV_RATINGS } from '../utils/trackers.js';
import { SYNC_PRIORITIES } from '../utils/canonical.js';

const SOURCE_LABELS = {
  jobtread: 'JobTread', jobtread_daily: 'JobTread Daily Report', plaud: 'Plaud', gemini_notes: 'Gemini Meeting Notes',
  calendar: 'Google Calendar', gmail: 'Gmail', drive: 'Google Drive', chat: 'Google Chat', manual: 'Manual Input',
};
const TYPE_LABELS = {
  actual_dates: 'Record actual dates', add_event: 'Backfill event', duration_change: 'Duration change',
  resequence: 'Resequence', milestone_move: 'Move milestone', tracker_update: 'Tracker update',
  jobtread_manual_edit: 'JobTread manual edit (one-way back)', note: 'Note only',
};

// Sync bundle: produced by the agent sync run (skill `--sync`) or dropped next to the
// hosted page as ./sync-bundle.json. Schema: skills/bidforge-schedules/schemas/sync-bundle.schema.json
export default function SyncModal({ project, meta, onApply, onClose }) {
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [selected, setSelected] = useState({});
  const [acks, setAcks] = useState({});

  useEffect(() => {
    fetch(`./sync-bundle.json?t=${Date.now()}`).then(r => (r.ok ? r.json() : null)).then(b => b && load(b)).catch(() => {});
  }, []);

  const load = (b) => {
    if (!b || b.schema !== 'bidforge.sync.v1' || !Array.isArray(b.items)) { setError('Not a bidforge.sync.v1 bundle'); return; }
    setError('');
    setBundle(b);
    const sel = {};
    for (const it of b.items) sel[it.id] = it.type !== 'milestone_move' && (it.jevRating || 1) < 4;
    setSelected(sel);
  };

  const sources = useMemo(() => {
    if (!bundle) return [];
    return (bundle.sources || []).map(s => ({ ...s, items: bundle.items.filter(i => i.sourceId === s.id) }))
      .sort((a, b) => Math.max(0, ...b.items.map(i => i.jevRating || 1)) - Math.max(0, ...a.items.map(i => i.jevRating || 1)));
  }, [bundle]);

  const items = bundle?.items || [];
  const needsAck = items.filter(i => selected[i.id] && (i.jevRating || 1) >= 4 && !acks[i.id]);
  const counts = [1, 2, 3, 4, 5].map(r => items.filter(i => (i.jevRating || 1) === r).length);
  const taskName = id => project.wbs.flatMap(p => p.children).find(t => t.id === id)?.name;

  const apply = () => {
    if (needsAck.length) return;
    const chosen = items.filter(i => selected[i.id]).map(i => ({
      ...i,
      source: SOURCE_LABELS[(bundle.sources || []).find(s => s.id === i.sourceId)?.kind] || i.sourceId,
      approved: i.type === 'milestone_move' ? !!acks[i.id] : undefined,
    }));
    // Unapproved milestone effects stay tracked as variance notes, never applied.
    const tracked = items.filter(i => i.type === 'milestone_move' && !selected[i.id]).map(i => ({ ...i, type: 'note', summary: `Tracked (not applied): ${i.summary}` }));
    onApply([...chosen, ...tracked], bundle);
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Schedule Sync Review</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>

        {!bundle && (
          <div>
            <p className="input-hint">
              A full sync scans JobTread (dates, manual edits, daily reports and photos), Plaud, Gemini notes in the Meetings folder,
              Google Calendar, Gmail and Drive since the last sync ({meta.sync?.lastSyncAt?.slice(0, 10) || 'never'}).
              The agent writes the results as a sync bundle. Ask Claude to <code>sync {project.name || 'this schedule'}</code>, or load a bundle below.
            </p>
            <input type="file" accept=".json" onChange={async e => { const f = e.target.files[0]; if (f) { try { load(JSON.parse(await f.text())); } catch { setError('Invalid JSON'); } } }} />
            <textarea className="text-input" rows={6} style={{ marginTop: 8 }} placeholder="…or paste sync-bundle JSON" value={paste} onChange={e => setPaste(e.target.value)} />
            <div className="btn-group"><button className="btn btn-primary" disabled={!paste.trim()} onClick={() => { try { load(JSON.parse(paste)); } catch { setError('Invalid JSON'); } }}>Load Bundle</button></div>
            {error && <p style={{ color: 'var(--critical)' }}>{error}</p>}
          </div>
        )}

        {bundle && (
          <>
            <div className="sync-summary">
              <span>Window: <b>{bundle.window?.from?.slice(0, 10)} → {bundle.window?.to?.slice(0, 10)}</b></span>
              <span><b>{sources.length}</b> sources · <b>{items.length}</b> changes</span>
              {[5, 4, 3, 2, 1].map(r => counts[r - 1] > 0 && (
                <span key={r} className="rating-pill" style={{ background: JEV_RATINGS[r].color }}>{JEV_RATINGS[r].label} {counts[r - 1]}</span>
              ))}
            </div>
            <div className="sync-legend">
              <span>
                <b>Project Coda → JobTread "Notes":</b>{' '}
                {bundle.codaBackup
                  ? `${bundle.codaBackup.status}${bundle.codaBackup.hash ? ` (sha ${bundle.codaBackup.hash})` : ''}${bundle.codaBackup.error ? ` — ${bundle.codaBackup.error}` : ''}`
                  : 'will be written by the agent with this sync'}
              </span>
            </div>
            <div className="sync-legend">
              {Object.entries(SYNC_PRIORITIES).map(([k, v]) => <span key={k}><b>P{k}</b> {v}</span>)}
            </div>
            {sources.map(src => (
              <div key={src.id} className="sync-source">
                <div className="sync-source-head">
                  <span className="sync-kind">{SOURCE_LABELS[src.kind] || src.kind}</span>
                  <strong>{src.title}</strong>
                  <span className="sync-date">{src.date?.slice(0, 10)}</span>
                  {src.link && <a href={src.link} target="_blank" rel="noreferrer">open</a>}
                </div>
                {src.summary && <div className="sync-source-sum">{src.summary}</div>}
                {src.items.map(it => {
                  const r = JEV_RATINGS[it.jevRating || 1];
                  const ms = it.type === 'milestone_move';
                  return (
                    <div key={it.id} className="sync-item" style={{ borderLeftColor: r.color, background: (it.jevRating || 1) >= 4 ? 'rgba(208,53,60,.06)' : undefined }}>
                      <label className="sync-check">
                        <input type="checkbox" checked={!!selected[it.id]} onChange={e => setSelected(s => ({ ...s, [it.id]: e.target.checked }))} />
                      </label>
                      <div className="sync-body">
                        <div className="sync-line">
                          <span className="rating-pill" style={{ background: r.color }}>{r.label}</span>
                          <span className="sync-prio">P{it.priority || 1}</span>
                          <b>{TYPE_LABELS[it.type] || it.type}</b>
                          {it.taskId && <span className="sync-task">{it.taskId} {taskName(it.taskId)}</span>}
                          {it.tag && <span className="sync-tag">{it.tag}</span>}
                        </div>
                        <div>{it.summary}</div>
                        {it.constraint && <div className="sync-constraint">Constraint: {it.constraint}</div>}
                        {ms && <div className="sync-constraint">Milestone {it.taskId}: {it.oldDate} → {it.newDate}. Applied only with your explicit permission; otherwise tracked as variance.</div>}
                        {selected[it.id] && (it.jevRating || 1) >= 4 && (
                          <label className="sync-ack">
                            <input type="checkbox" checked={!!acks[it.id]} onChange={e => setAcks(a => ({ ...a, [it.id]: e.target.checked }))} />
                            {ms ? 'I approve moving this milestone' : 'I acknowledge this impact'}
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => setBundle(null)}>Load different bundle</button>
              <button className="btn btn-primary" disabled={needsAck.length > 0} onClick={apply}>
                {needsAck.length ? `${needsAck.length} item(s) need acknowledgement` : `Apply ${items.filter(i => selected[i.id]).length} change(s) to canonical schedule`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
