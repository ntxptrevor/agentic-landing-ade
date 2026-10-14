import React, { useState } from 'react';

// Critical recent context for the selected project, read from the project KB activity
// stream (JobTread logs, workspace and project files, schedule events). Nothing is
// rescanned here — the stream is maintained by the sync.
const ICON = { jobtread: 'JT', schedule: 'SCH', email: '@', meeting: 'MTG', rfi: 'RFI', submittal: 'SUB', ocr4: 'DOC', workspace_intel: 'WS', manual: 'NOTE', other: '•' };

export default function ContextPanel({ activity, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const critical = activity?.critical || [];
  const recent = activity?.recent || [];
  const list = showAll ? recent : critical;
  return (
    <aside className="context-panel" aria-label="Recent schedule context">
      <div className="context-head">
        <b>Schedule context</b>
        <div className="btn-group">
          <button className={`btn btn-sm ${!showAll ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowAll(false)}>Critical ({critical.length})</button>
          <button className={`btn btn-sm ${showAll ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowAll(true)}>Recent ({recent.length})</button>
          {onClose && <button className="btn btn-sm btn-secondary" onClick={onClose} aria-label="Close context">×</button>}
        </div>
      </div>
      <p className="input-hint" style={{ margin: '4px 0 8px' }}>From the project activity stream (JobTread, workspace and project files, schedule events) as of the last sync.</p>
      {!list.length && <p className="input-hint">No {showAll ? 'recent' : 'critical'} activity recorded for this project yet.</p>}
      <ul className="context-list">
        {list.map((e, i) => (
          <li key={i} className={e.critical || (e.rating || 0) >= 3 ? 'crit' : ''}>
            <span className="context-src" title={e.source}>{ICON[e.source] || '•'}</span>
            <div>
              <div className="context-text">{e.link ? <a href={e.link} target="_blank" rel="noreferrer">{e.text}</a> : e.text}</div>
              <div className="context-date">{String(e.ts || '').slice(0, 16).replace('T', ' ')}{e.kind ? ` · ${e.kind}` : ''}</div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
