import React from 'react';

// Header project selector: the knowledge-base list of active projects and pursuits.
export default function ProjectBar({ projects, currentSlug, onSelect, onInstant, onSave, saving, dirty, user, onLogout, serverVersion, status, onAward }) {
  return (
    <div className="project-bar">
      <select aria-label="Project" value={currentSlug || ''} onChange={e => onSelect(e.target.value)}>
        <option value="">Select a project…</option>
        {['active', 'bid'].map(st => {
          const group = projects.filter(p => (p.status || 'active') === st);
          return group.length ? (
            <optgroup key={st} label={st === 'bid' ? 'Pursuits (bid)' : 'Active projects'}>
              {group.map(p => <option key={p.slug} value={p.slug}>{p.number ? `${p.number} · ` : ''}{p.name}{p.version ? ` (v${p.version})` : ''}</option>)}
            </optgroup>
          ) : null;
        })}
      </select>
      <button className="btn btn-primary btn-sm" onClick={onInstant}>+ Instant schedule</button>
      {onSave && (
        <button className="btn btn-secondary btn-sm" onClick={onSave} disabled={saving || !dirty} title={serverVersion != null ? `Server holds v${serverVersion}` : 'New project'}>
          {saving ? 'Saving…' : dirty ? 'Save version' : 'Saved'}
        </button>
      )}
      {onAward && status !== 'active' && (
        <button className="btn btn-secondary btn-sm" onClick={onAward} title="Project awarded: status → active, schedule routes to !Active Projects/<name>/06 - Schedule">Mark awarded</button>
      )}
      {status === 'active' && currentSlug && <span className="project-user" title="Awarded — saves route to the project folder">Awarded</span>}
      {user && <span className="project-user" title={user.method}>{user.email || user.name}</span>}
      {onLogout && <button className="btn btn-secondary btn-sm" onClick={onLogout}>Sign out</button>}
    </div>
  );
}
