import React, { useMemo, useState } from 'react';
import { rateAll, JEV_RATINGS, SUBMITTAL_STAGES } from '../utils/trackers.js';

const TABS = [
  { id: 'submittals', label: 'Submittals & Lead Times' },
  { id: 'rfis', label: 'RFIs' },
  { id: 'asis', label: 'ASI / Change Orders' },
  { id: 'payApps', label: 'Owner Pay Apps (AR)' },
  { id: 'subInvoices', label: 'Sub Invoices (AP)' },
];

const Pill = ({ r }) => <span className="rating-pill" style={{ background: JEV_RATINGS[r].color }}>{r} · {JEV_RATINGS[r].label}</span>;

export default function TrackersPanel({ project, meta }) {
  const [tab, setTab] = useState('submittals');
  const today = new Date().toISOString().slice(0, 10);
  const rated = useMemo(() => rateAll(meta.trackers, project.wbs, today), [meta.trackers, project.wbs, today]);
  const list = rated[tab] || [];
  const flagged = Object.values(rated).flat().filter(x => (x.rating || 0) >= 4).length;

  return (
    <div>
      <div className="tracker-head">
        <p className="input-hint" style={{ margin: 0 }}>
          JEV impact rating: 1 Log · 2 Note · 3 Watch (highlight) · 4 Flag (acknowledge at sync) · 5 Gate (explicit permission + notification).
          Trackers update from sync bundles and the agent's JobTread / Drive checks.
        </p>
        {flagged > 0 && <span className="rating-pill" style={{ background: JEV_RATINGS[5].color }}>{flagged} flagged</span>}
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} ({(rated[t.id] || []).length})
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="empty-state" style={{ padding: 24 }}>No {TABS.find(t => t.id === tab).label.toLowerCase()} recorded yet.</div>}
      {list.length > 0 && (
        <table className="task-table">
          <thead>
            <tr>
              <th>ID</th><th>Item</th>
              {tab === 'submittals' && <><th>Stage</th><th>Lead</th><th>Need by</th><th>Projected</th></>}
              {tab === 'subInvoices' && <><th>Vendor</th><th>Accept?</th></>}
              <th>Rating</th><th>Issues</th>
            </tr>
          </thead>
          <tbody>
            {list.sort((a, b) => b.rating - a.rating).map(x => (
              <tr key={x.id} style={{ background: x.rating >= 4 ? 'rgba(208,53,60,.08)' : x.rating === 3 ? 'rgba(180,83,9,.08)' : undefined }}>
                <td>{x.id}</td>
                <td>{x.title || x.subject || x.number || x.vendor}</td>
                {tab === 'submittals' && <>
                  <td><div className="stage-track">{SUBMITTAL_STAGES.map(s => <span key={s} className={x[`${s}Date`] ? 'on' : ''} title={s} />)}</div><small>{x.stage}</small></td>
                  <td>{x.leadDays}d</td><td>{x.needBy || '—'}</td><td>{x.projected || '—'}</td>
                </>}
                {tab === 'subInvoices' && <><td>{x.vendor}</td><td>{x.acceptable ? 'Yes' : 'No'}</td></>}
                <td><Pill r={x.rating} /></td>
                <td style={{ fontSize: '0.75rem' }}>{(x.issues || []).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'subInvoices' && rated.unbilled.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Scheduled work complete with no saved sub bill</h3>
          {rated.unbilled.map(u => <div key={u.taskId} style={{ fontSize: '0.8rem' }}><Pill r={2} /> {u.taskId} {u.name} — {u.trade}</div>)}
        </div>
      )}
    </div>
  );
}
