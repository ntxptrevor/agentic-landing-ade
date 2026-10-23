import React, { useEffect, useMemo, useState } from 'react';
import { JEV_RATINGS } from '../utils/trackers.js';
import { SYNC_PRIORITIES, slugify, safeHref, openHeld, tasksChangedSince, isEarlierEdit, sourceRef } from '../utils/canonical.js';

const SOURCE_LABELS = {
  jobtread: 'JobTread', jobtread_daily: 'JobTread Daily Report', plaud: 'Plaud', gemini_notes: 'Gemini Meeting Notes',
  calendar: 'Google Calendar', gmail: 'Gmail', drive: 'Google Drive', chat: 'Google Chat', manual: 'Manual Input',
};
const TYPE_LABELS = {
  actual_dates: 'Record actual dates', add_event: 'Backfill event', duration_change: 'Duration change',
  resequence: 'Resequence', milestone_move: 'Move milestone', tracker_update: 'Tracker update',
  jobtread_manual_edit: 'JobTread manual edit (one-way back)', note: 'Note only',
};
const UNASSIGNED = '__unassigned__';

// Held-item actions (acknowledge / apply / dismiss) are handled by App, which listens for
// this event, so the popup stays open while meta updates.
export const HELD_EVENT = 'bidforge:held';
const heldAction = (action, ids, note = '') => window.dispatchEvent(new CustomEvent(HELD_EVENT, { detail: { action, ids, note } }));

const Link = ({ href, children }) => {
  const h = safeHref(href);
  return h ? <a href={h} target="_blank" rel="noreferrer noopener">{children}</a> : <span>{children}</span>;
};

// The project slug currently open (cloud mode puts it in ?project=).
const urlSlug = () => { try { return new URLSearchParams(location.search).get('project') || ''; } catch { return ''; } };

// Sync bundle: produced by the agent sync run (skill `--sync`). In cloud mode only a pasted /
// uploaded bundle or ./projects/<slug>/sync-bundle.json is read — never the shared root file
// while a project is open. Schema: skills/ntxp-cpm-gantt-schedules/schemas/sync-bundle.schema.json
export default function SyncModal({ project, meta, onApply, onClose }) {
  const [bundle, setBundle] = useState(null);
  const [check, setCheck] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [selected, setSelected] = useState({});
  const [acks, setAcks] = useState({});
  const [heldNote, setHeldNote] = useState('');

  const openSlug = urlSlug() || meta.slug || slugify(project.name);
  const okSlugs = useMemo(() => new Set([openSlug, meta.slug, slugify(project.name)].filter(Boolean)), [openSlug, meta.slug, project.name]);
  const applied = useMemo(() => new Set(meta.sync?.appliedItemIds || []), [meta.sync?.appliedItemIds]);
  const held = openHeld(meta);
  const allTasks = useMemo(() => project.wbs.flatMap(p => p.children), [project.wbs]);
  const taskById = id => allTasks.find(t => t.id === id);

  useEffect(() => {
    const qs = urlSlug();
    const path = qs ? `./projects/${encodeURIComponent(qs)}/sync-bundle.json` : './sync-bundle.json';
    fetch(`${path}?t=${Date.now()}`)
      .then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then(b => b && load(b, path))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (b) => {
    const bSlug = b.project?.slug || (b.project?.name ? slugify(b.project.name) : '');
    if (!bSlug) return { refuse: 'This bundle does not name its project (project.slug) — it cannot be applied to an open schedule.' };
    const nameSlug = b.project?.name ? slugify(b.project.name) : '';
    if (!okSlugs.has(bSlug) && !(nameSlug && okSlugs.has(nameSlug))) {
      return { refuse: `This bundle is for "${b.project?.name || bSlug}" (${bSlug}), not the open project "${project.name}" (${openSlug}). It cannot be applied here.` };
    }
    const cv = b.project?.canonicalVersion;
    if (cv != null && cv < meta.version) {
      const changed = tasksChangedSince(meta, cv);
      const conflicts = b.items.filter(i => i.taskId && changed.has(i.taskId));
      if (conflicts.length) {
        return { refuse: `This bundle was built against v${cv}; the schedule is now v${meta.version} and ${conflicts.length} item(s) target tasks changed since (${[...new Set(conflicts.map(i => i.taskId))].join(', ')}). Re-run the sync against v${meta.version}.`, conflicts: new Set(conflicts.map(i => i.id)) };
      }
      return { warn: `Built against v${cv}; the schedule is now v${meta.version}. None of its items target tasks changed since.` };
    }
    return {};
  };

  const load = (b, origin = 'pasted') => {
    if (!b || b.schema !== 'bidforge.sync.v1' || !Array.isArray(b.items)) { setError('Not a bidforge.sync.v1 bundle'); return; }
    setError('');
    const c = { ...validate(b), origin };
    setCheck(c);
    setViewOnly(false);
    setBundle(b);
    const known = new Set((b.sources || []).map(s => s.id));
    const sel = {};
    for (const it of b.items) {
      sel[it.id] = !c.refuse && !applied.has(it.id) && known.has(it.sourceId) && it.type !== 'milestone_move' && (it.jevRating || 1) < 4;
    }
    setSelected(sel);
    setAcks({});
  };

  const items = bundle?.items || [];
  const groups = useMemo(() => {
    if (!bundle) return [];
    const known = new Set((bundle.sources || []).map(s => s.id));
    const gs = (bundle.sources || []).map(s => ({ ...s, items: bundle.items.filter(i => i.sourceId === s.id) }));
    const orphan = bundle.items.filter(i => !known.has(i.sourceId));
    if (orphan.length) gs.push({ id: UNASSIGNED, kind: 'manual', title: 'Unassigned source (sourceId matches no bundle source)', items: orphan });
    return gs.filter(g => g.items.length || g.id !== UNASSIGNED)
      .sort((a, b) => Math.max(0, ...b.items.map(i => i.jevRating || 1)) - Math.max(0, ...a.items.map(i => i.jevRating || 1)));
  }, [bundle]);

  const locked = !!check?.refuse;
  const canPick = it => !locked && !applied.has(it.id);
  const chosen = items.filter(i => selected[i.id] && canPick(i));
  const needsAck = chosen.filter(i => i.type !== 'milestone_move' && (i.jevRating || 1) >= 4 && !acks[i.id]);
  const counts = [1, 2, 3, 4, 5].map(r => items.filter(i => (i.jevRating || 1) === r).length);
  const willHold = items.filter(i => canPick(i) && !selected[i.id] && (i.jevRating || 1) >= 4 && i.type !== 'milestone_move');
  const willTrack = items.filter(i => canPick(i) && i.type === 'milestone_move' && !(selected[i.id] && acks[i.id]));

  const srcRefs = (it) => {
    const s = (bundle.sources || []).find(x => x.id === it.sourceId);
    const date = String(s?.date || it.date || bundle.generatedAt || '').slice(0, 10) || undefined;
    return s
      ? [sourceRef(s.kind || 'sync', s.title || s.id, s.link || '', date)]
      : [sourceRef('sync', `Sync bundle ${bundle.window?.from?.slice(0, 10) || ''} → ${bundle.window?.to?.slice(0, 10) || ''} (unassigned source ${it.sourceId || '—'})`, '', date)];
  };
  const prep = (it, extra = {}) => ({
    ...it,
    source: SOURCE_LABELS[(bundle.sources || []).find(s => s.id === it.sourceId)?.kind] || it.sourceId || 'sync bundle',
    sources: srcRefs(it),
    ...extra,
  });

  const apply = () => {
    if (locked || needsAck.length) return;
    const toApply = chosen.filter(i => i.type !== 'milestone_move').map(i => prep(i))
      // Milestone moves: applied only with explicit approval; otherwise tracked as variance (never moved).
      .concat(willTrack.map(i => prep(i, { approved: false })))
      .concat(chosen.filter(i => i.type === 'milestone_move' && acks[i.id]).map(i => prep(i, { approved: true })));
    onApply(toApply, bundle, willHold.map(i => prep(i)));
  };

  const heldSection = held.length > 0 && (
    <div className="sync-source" style={{ borderColor: 'var(--critical)' }}>
      <div className="sync-source-head">
        <span className="sync-kind">Held</span>
        <strong>{held.length} held sync item(s) waiting (rated 4+) — the OAC gate stays closed until each is applied, acknowledged or dismissed</strong>
      </div>
      <input type="text" style={{ width: '100%', margin: '6px 0', padding: '6px 8px', boxSizing: 'border-box' }} placeholder="Note for acknowledge / dismiss (optional)" value={heldNote} onChange={e => setHeldNote(e.target.value)} />
      {held.map(p => {
        const r = JEV_RATINGS[p.jevRating || 1] || JEV_RATINGS[1];
        return (
          <div key={p.id} className="sync-item" data-held-id={p.id} style={{ borderLeftColor: r.color, background: 'rgba(208,53,60,.06)' }}>
            <div className="sync-body">
              <div className="sync-line">
                <span className="rating-pill" style={{ background: r.color }}>{r.label}</span>
                <b>{TYPE_LABELS[p.type] || p.type}</b>
                {p.taskId && <span className="sync-task">{p.taskId} {taskById(p.taskId)?.name}</span>}
                <span className="sync-date">held {String(p.heldAt || '').slice(0, 10)}</span>
              </div>
              <div>{p.summary}</div>
              {(p.sources || []).length > 0 && (
                <div className="sync-constraint">Sources: {p.sources.map((s, i) => <span key={i}>{i > 0 && ' · '}<Link href={s.url}>{s.title}</Link></span>)}</div>
              )}
              <div className="btn-group" style={{ marginTop: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={() => heldAction('acknowledge', [p.id], heldNote)}>Acknowledge</button>
                <button className="btn btn-sm btn-secondary" disabled={!p.item} title={p.item ? 'Apply this change to the schedule' : 'The original item was not kept — re-run the sync'} onClick={() => heldAction('apply', [p.id])}>Apply</button>
                <button className="btn btn-sm btn-secondary" onClick={() => heldAction('dismiss', [p.id], heldNote)}>Dismiss</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} aria-label="Schedule sync review">
        <div className="modal-head">
          <h2>Schedule Sync Review</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>

        {heldSection}

        {!bundle && (
          <div>
            <p className="input-hint">
              A full sync scans JobTread (dates, manual edits, daily reports and photos), Plaud, Gemini notes in the Meetings folder,
              Google Calendar, Gmail and Drive since the last sync ({meta.sync?.lastSyncAt?.slice(0, 10) || 'never'}).
              The agent writes the results as a sync bundle for <code>{openSlug}</code>. Ask Claude to <code>sync {project.name || 'this schedule'}</code>, or load the bundle file below.
            </p>
            <input type="file" accept=".json" onChange={async e => { const f = e.target.files[0]; if (f) { try { load(JSON.parse(await f.text()), f.name); } catch { setError('Invalid JSON'); } } }} />
            <textarea className="text-input" rows={6} style={{ marginTop: 8 }} placeholder="…or paste sync-bundle JSON" value={paste} onChange={e => setPaste(e.target.value)} />
            <div className="btn-group"><button className="btn btn-primary" disabled={!paste.trim()} onClick={() => { try { load(JSON.parse(paste)); } catch { setError('Invalid JSON'); } }}>Load Bundle</button></div>
            {error && <p style={{ color: 'var(--critical)' }}>{error}</p>}
          </div>
        )}

        {bundle && locked && !viewOnly && (
          <div className="gate-banner warn" role="alert">
            <b>Bundle refused.</b> {check.refuse}
            <div className="btn-group" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewOnly(true)}>View only</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setBundle(null); setCheck(null); }}>Load different bundle</button>
            </div>
          </div>
        )}

        {bundle && (!locked || viewOnly) && (
          <>
            {locked && <div className="gate-banner warn" role="alert"><b>View only — nothing can be applied.</b> {check.refuse}</div>}
            {check?.warn && <div className="gate-banner warn">{check.warn}</div>}
            <div className="sync-summary">
              <span>Window: <b>{bundle.window?.from?.slice(0, 10)} → {bundle.window?.to?.slice(0, 10)}</b></span>
              <span>Project: <b>{bundle.project?.slug || bundle.project?.name}</b>{bundle.project?.canonicalVersion != null && ` (built on v${bundle.project.canonicalVersion})`}</span>
              <span><b>{groups.length}</b> sources · <b>{items.length}</b> items</span>
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
            {groups.map(src => (
              <div key={src.id} className="sync-source">
                <div className="sync-source-head">
                  <span className="sync-kind">{src.id === UNASSIGNED ? 'Unassigned' : SOURCE_LABELS[src.kind] || src.kind}</span>
                  <strong>{src.title}</strong>
                  <span className="sync-date">{src.date?.slice(0, 10)}</span>
                  {src.link && safeHref(src.link) && <Link href={src.link}>open</Link>}
                </div>
                {src.summary && <div className="sync-source-sum">{src.summary}</div>}
                {!src.items.length && <div className="input-hint">No items from this source.</div>}
                {src.items.map(it => {
                  const r = JEV_RATINGS[it.jevRating || 1] || JEV_RATINGS[1];
                  const ms = it.type === 'milestone_move';
                  const task = it.taskId ? taskById(it.taskId) : null;
                  const done = applied.has(it.id);
                  const conflict = check?.conflicts?.has(it.id);
                  return (
                    <div key={it.id} className="sync-item" style={{ borderLeftColor: r.color, background: (it.jevRating || 1) >= 4 ? 'rgba(208,53,60,.06)' : undefined, opacity: done ? 0.6 : 1 }}>
                      <label className="sync-check">
                        <input type="checkbox" disabled={!canPick(it)} checked={!!selected[it.id] && canPick(it)} onChange={e => setSelected(s => ({ ...s, [it.id]: e.target.checked }))} />
                      </label>
                      <div className="sync-body">
                        <div className="sync-line">
                          <span className="rating-pill" style={{ background: r.color }}>{r.label}</span>
                          <span className="sync-prio">P{it.priority || 1}</span>
                          <b>{TYPE_LABELS[it.type] || it.type}</b>
                          {it.taskId && <span className="sync-task">{it.taskId} {task?.name || <i>(task not found — will be logged as skipped)</i>}</span>}
                          {it.tag && <span className="sync-tag">{it.tag}</span>}
                          {done && <span className="sync-tag">already applied</span>}
                          {conflict && <span className="sync-tag">task changed since bundle</span>}
                        </div>
                        <div>{it.summary}</div>
                        {it.constraint && <div className="sync-constraint">Constraint: {it.constraint}</div>}
                        {isEarlierEdit(it, task) && (
                          <div className="sync-constraint">JobTread start {it.startDate} is earlier than the CPM start {task?.startDate || '—'}: predecessors prevent an earlier start. It is recorded as a requested start only — the schedule dates do not move.</div>
                        )}
                        {ms && <div className="sync-constraint">Milestone {it.taskId}: {it.oldDate} → {it.newDate}. Moved only with your explicit approval below; otherwise logged as tracked variance (not moved).</div>}
                        {!locked && !done && selected[it.id] && (ms || (it.jevRating || 1) >= 4) && (
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
            {!locked && (willHold.length > 0 || willTrack.length > 0) && (
              <p className="input-hint">
                {willHold.length > 0 && `${willHold.length} unselected item(s) rated 4+ will be held for acknowledgement. `}
                {willTrack.length > 0 && `${willTrack.length} milestone move(s) without approval will be logged as tracked variance (not moved).`}
              </p>
            )}
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={() => { setBundle(null); setCheck(null); }}>Load different bundle</button>
              {!locked && (
                <button className="btn btn-primary" disabled={needsAck.length > 0} onClick={apply}>
                  {needsAck.length ? `${needsAck.length} item(s) need acknowledgement` : `Apply ${chosen.length} change(s) to canonical schedule`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
