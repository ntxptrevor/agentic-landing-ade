import React from 'react';
import { JEV_RATINGS } from '../utils/trackers.js';

const fmt = v => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function ChangelogPanel({ meta }) {
  const byDate = {};
  for (const e of [...meta.changelog].reverse()) (byDate[e.at.slice(0, 10)] ||= []).push(e);
  return (
    <div>
      <p className="input-hint">Canonical version <b>v{meta.version}</b> · {meta.changelog.length} entries · {meta.inputs.length} inputs recorded. Every change synced to the knowledge base, Drive and JobTread is derived from this log.</p>
      {Object.entries(byDate).map(([day, entries]) => (
        <div key={day} className="log-day">
          <div className="list-phase-header">{day}</div>
          <table className="task-table">
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ width: 80 }}>{e.id}</td>
                  <td style={{ width: 60 }}>{e.at.slice(11, 16)}</td>
                  <td style={{ width: 90 }}><span className="rating-pill" style={{ background: JEV_RATINGS[e.jevRating || 1].color }}>{JEV_RATINGS[e.jevRating || 1].label}</span></td>
                  <td style={{ width: 160 }}><b>{e.type}</b><div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{e.source} · {e.actor}</div></td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {e.target && <div><b>{e.target}</b></div>}
                    {e.before && <div>before: {fmt(e.before).slice(0, 160)}</div>}
                    {e.after && <div>after: {fmt(e.after).slice(0, 160)}</div>}
                    {e.reason && <div style={{ color: 'var(--text-dim)' }}>{e.reason}</div>}
                    {(e.sources || []).length > 0 && (
                      <div className="log-sources">Sources: {e.sources.map((src, i) => (
                        <span key={i}>{i > 0 && ' · '}{src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : src.title} <span style={{ color: 'var(--text-dim)' }}>({src.type}{src.date ? `, ${src.date}` : ''})</span></span>
                      ))}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
