import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseDate, getMonthName } from '../utils/dateUtils.js';
import { JEV_CLASSES } from '../data/jevTaxonomy.js';
import { runPreflight } from '../utils/preflight.js';

export const CANON_CSS = `
.canon-page{--navy:#1B2A4E;--accent:#C8102E;--signal:#D0353C;--blue:#2F6FD6;--green:#0E9F6E;--coral:#E07A5F;
  background:#fff;color:#000;font-family:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:9pt;line-height:1.25;
  min-width:1100px;position:relative;border-radius:6px;overflow:hidden}
.canon-page *{box-sizing:border-box;font-family:inherit}
.canon-band{background:var(--navy);height:1in;position:relative;display:flex;align-items:center}
.canon-logo{width:1.55in;height:1in;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.canon-logo img{height:.82in;width:auto;display:block}
.canon-title{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:20pt;font-weight:800;font-style:italic;letter-spacing:.06em;pointer-events:none}
.canon-sync{position:absolute;right:.3in;top:50%;transform:translateY(-50%);background:#fff;color:var(--navy);
  font-weight:800;font-size:10pt;letter-spacing:.08em;border:0;border-radius:999px;padding:8px 20px;cursor:pointer;
  box-shadow:0 1px 4px rgba(0,0,0,.3)}
.canon-sync:hover{background:#F6F3EF}
.canon-sync .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-right:8px;vertical-align:middle}
.canon-pin{height:.085in;background:linear-gradient(90deg,rgba(200,16,46,.1) 0%,#C8102E 100%),#182746}
.canon-meta{display:flex;flex-wrap:wrap;gap:6px 22px;padding:8px 14px;border-bottom:1px solid #000;font-size:8.5pt}
.canon-meta b{font-weight:700}
.canon-legend{display:flex;flex-wrap:wrap;gap:6px 16px;padding:6px 14px;font-size:8pt;border-bottom:1px solid #000}
.canon-legend i{display:inline-block;width:18px;height:8px;border-radius:4px;margin-right:5px;vertical-align:middle}
.canon-legend i.ms{width:8px;height:8px;border-radius:1px;transform:rotate(45deg)}
.canon-table{width:100%;border-collapse:collapse;table-layout:fixed}
.canon-table th,.canon-table td{border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;vertical-align:middle}
.canon-table th:last-child,.canon-table td:last-child{border-right:0}
.canon-table thead th{background:#fff;font-weight:700;font-size:8pt;text-align:left}
.canon-table td.num,.canon-table th.num{text-align:center;white-space:nowrap}
.canon-table .tl{padding:0;position:relative}
.canon-months{position:relative;height:16px;border-bottom:1px solid #000}
.canon-months span{position:absolute;top:0;height:16px;line-height:16px;font-size:7.5pt;font-weight:700;padding:0 4px;
  border-left:1px solid #000;overflow:hidden;white-space:nowrap}
.canon-weeks{position:relative;height:12px}
.canon-weeks span{position:absolute;top:0;height:12px;line-height:12px;font-size:6.5pt;padding:0 3px;border-left:1px solid #9aa;color:#333;white-space:nowrap}
.canon-grid{position:absolute;inset:0;pointer-events:none}
.canon-grid b{position:absolute;top:0;bottom:0;width:0;border-left:1px dotted #c8ccd4}
.canon-grid b.m{border-left:1px solid #9aa0aa}
.canon-row-phase td{background:#000;color:#fff;font-weight:800;font-style:italic;font-size:9.5pt;border-color:#000}
.canon-row-sub td{font-weight:700;background:#fff}
.canon-row-sub td.name{padding-left:18px}
.canon-row-task td.name{padding-left:30px}
.canon-bar{position:absolute;top:50%;height:10px;transform:translateY(-50%);border-radius:5px;min-width:3px}
.canon-bar.sum{height:6px;border-radius:3px;background:#3a3f4a}
.canon-row-phase .canon-bar.sum{background:#fff}
.canon-bar .prog{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:rgba(0,0,0,.35)}
.canon-ms{position:absolute;top:50%;width:10px;height:10px;margin-left:-5px;transform:translateY(-50%) rotate(45deg);background:var(--signal);border-radius:1px}
.canon-contract{position:absolute;top:2px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #000;margin-left:-5px}
.canon-window{position:absolute;top:50%;height:14px;transform:translateY(-50%);border:1.5px dashed #D0353C;border-radius:4px;background:rgba(208,53,60,.06)}
.canon-today{position:absolute;top:0;bottom:0;border-left:1.5px dashed var(--signal)}
.canon-flag{color:var(--signal);font-weight:700}
.canon-foot{height:.5in;border-top:1px solid #000;display:flex;align-items:center;justify-content:space-between;padding:0 14px;
  background:transparent;font-size:9pt;color:#000;margin-top:10px}
.canon-foot span{padding:0 4px}
.canon-tfoot{display:none}
@media print{
  @page{size:17in 11in;margin:.35in .35in .3in .35in}
  .canon-page{min-width:0;border-radius:0}
  .canon-sync,[data-export="omit"]{display:none!important}
  .canon-table thead{display:table-header-group}
  .canon-table tr{break-inside:avoid;page-break-inside:avoid}
  .canon-foot{position:fixed;left:0;right:0;bottom:0;margin:0;background:#fff}
  .canon-tfoot{display:table-footer-group}
  .canon-tfoot td{height:.62in;border:0!important;padding:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

const DAY = 86400000;
const CLASS_COLOR = Object.fromEntries(JEV_CLASSES.map(c => [c.id, c.color]));

export function barColor(t) {
  if (t.isCritical || t.isMilestone) return '#D0353C';
  if (t.category === 'delivery' || /submittal/i.test(t.name)) return '#2F6FD6';
  if (t.category === 'procurement') return '#0E9F6E';
  if (t.category === 'deliverable') return '#E07A5F';
  return CLASS_COLOR[t.cls] || '#46567D';
}

function buildRows(wbs) {
  const rows = [];
  for (const phase of wbs) {
    rows.push({ kind: 'phase', item: phase, key: `p${phase.id}` });
    let sub = null;
    for (const t of phase.children || []) {
      if (t.sub && t.sub !== sub) {
        sub = t.sub;
        const kids = phase.children.filter(c => c.sub === sub);
        rows.push({ kind: 'sub', key: `s${phase.id}-${sub}`, item: {
          name: sub,
          startDate: kids.map(k => k.startDate).filter(Boolean).sort()[0],
          endDate: kids.map(k => k.endDate).filter(Boolean).sort().pop(),
          duration: null,
        } });
      }
      rows.push({ kind: 'task', item: t, key: t.id });
    }
  }
  return rows;
}

export default function CanonicalSchedule({ project, meta, onSync, onPreflight }) {
  const ref = useRef(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const rows = useMemo(() => buildRows(project.wbs), [project.wbs]);

  const scale = useMemo(() => {
    const s = parseDate(project.startDate);
    const e = parseDate(project.endDate || project.startDate);
    const startMonday = new Date(s.getTime() - ((s.getDay() + 6) % 7) * DAY);
    const total = Math.max(7, Math.round((e - startMonday) / DAY) + 7);
    const pct = d => ((parseDate(d) - startMonday) / DAY / total) * 100;
    const months = [];
    let c = new Date(startMonday.getFullYear(), startMonday.getMonth(), 1);
    while (c <= e) {
      const next = new Date(c.getFullYear(), c.getMonth() + 1, 1);
      const l = Math.max(0, ((c - startMonday) / DAY / total) * 100);
      const r = Math.min(100, ((next - startMonday) / DAY / total) * 100);
      if (r - l > 2.2) months.push({ label: `${getMonthName(c.getMonth()).slice(0, 3)} ${String(c.getFullYear()).slice(2)}`, left: l, width: r - l });
      c = next;
    }
    const weeks = [];
    const step = total > 300 ? 28 : total > 110 ? 14 : 7;
    for (let d = 0; d < total; d += step) {
      const dt = new Date(startMonday.getTime() + d * DAY);
      weeks.push({ left: (d / total) * 100, label: `${dt.getMonth() + 1}/${dt.getDate()}` });
    }
    return { pct, months, weeks, total, startMonday };
  }, [project.startDate, project.endDate]);

  useEffect(() => {
    if (!onPreflight) return;
    const id = requestAnimationFrame(() => onPreflight(runPreflight(project, meta, ref.current)));
    return () => cancelAnimationFrame(id);
  }, [project, meta, onPreflight]);

  const tasks = project.wbs.flatMap(p => p.children);
  const version = `v${meta.version}`;
  const docDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const todayPct = scale.pct(today);

  const bar = (t, kind) => {
    if (!t.startDate || !t.endDate) return null;
    const left = scale.pct(t.startDate);
    const width = Math.max(0.25, ((parseDate(t.endDate) - parseDate(t.startDate)) / DAY + 1) / scale.total * 100);
    // State / AHJ inspections are requested as a one-week window, not a fixed date.
    const win = kind === 'task' && t.windowDays
      ? <span className="canon-window" title="Requested inspection week" style={{ left: `${left}%`, width: `${Math.max(width, (7 / scale.total) * 100)}%` }} />
      : null;
    if (kind === 'task' && (t.isMilestone || t.duration === 0)) return <>{win}<span className="canon-ms" style={{ left: `${left + width / 2}%` }} /></>;
    if (kind !== 'task') return <span className="canon-bar sum" style={{ left: `${left}%`, width: `${width}%` }} />;
    const prog = t.actualFinish ? 100 : (t.percentComplete || 0);
    return (
      <>
        {win}
        <span className="canon-bar" style={{ left: `${left}%`, width: `${width}%`, background: barColor(t) }}>
          {prog > 0 && <span className="prog" style={{ width: `${prog}%` }} />}
        </span>
      </>
    );
  };

  return (
    <div className="canon-page" ref={ref} id="canonical-schedule">
      <style>{CANON_CSS}</style>
      <div className="canon-band">
        <div className="canon-logo"><img src="./ntxp-logo-reversed.png" alt="NTXP" /></div>
        <div className="canon-title">PROJECT SCHEDULE</div>
        {onSync && (
          <button className="canon-sync" data-export="omit" onClick={onSync} title={meta.sync?.lastSyncAt ? `Last sync ${meta.sync.lastSyncAt}` : 'Never synced'}>
            <span className="dot" style={{ background: meta.sync?.lastSyncAt ? '#0E9F6E' : '#B45309' }} />SYNC
          </button>
        )}
      </div>
      <div className="canon-pin" />
      <div className="canon-meta">
        <span><b>Start:</b> {project.startDate}</span>
        <span><b>Finish:</b> {project.endDate}</span>
        <span><b>Duration:</b> {project.workingDuration} working days</span>
        <span><b>Critical path:</b> {project.criticalPathDuration} days</span>
        <span><b>Activities:</b> {tasks.length}</span>
        <span><b>Data date:</b> {meta.sync?.lastSyncAt ? meta.sync.lastSyncAt.slice(0, 10) : today}</span>
        {tasks.some(t => t.milestoneVariance > 0) && <span className="canon-flag">Milestone variance — see flagged rows</span>}
      </div>
      <div className="canon-legend">
        <span><i style={{ background: '#D0353C' }} />Critical path</span>
        <span><i className="ms" style={{ background: '#D0353C' }} />Milestone</span>
        <span><i style={{ background: '#2F6FD6' }} />Delivery / Submittal</span>
        <span><i style={{ background: '#0E9F6E' }} />Procurement</span>
        <span><i style={{ background: '#E07A5F' }} />Deliverable</span>
        <span><i style={{ background: 'rgba(208,53,60,.06)', border: '1.5px dashed #D0353C' }} />Requested inspection week</span>
        {JEV_CLASSES.filter(c => tasks.some(t => t.cls === c.id && !t.isCritical)).map(c => (
          <span key={c.id}><i style={{ background: c.color }} />{c.label}</span>
        ))}
      </div>
      <table className="canon-table">
        <colgroup>
          <col style={{ width: '0.62in' }} /><col style={{ width: '3.5in' }} /><col style={{ width: '0.5in' }} />
          <col style={{ width: '0.82in' }} /><col style={{ width: '0.82in' }} /><col />
        </colgroup>
        <thead>
          <tr>
            <th className="num" rowSpan={2} data-pf="text">WBS</th>
            <th rowSpan={2} data-pf="text">Task Name</th>
            <th className="num" rowSpan={2} data-pf="text">Dur</th>
            <th className="num" rowSpan={2} data-pf="text">Start</th>
            <th className="num" rowSpan={2} data-pf="text">Finish</th>
            <th className="tl">
              <div className="canon-months">{scale.months.map((m, i) => <span key={i} style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</span>)}</div>
            </th>
          </tr>
          <tr>
            <th className="tl"><div className="canon-weeks">{scale.weeks.map((w, i) => <span key={i} style={{ left: `${w.left}%` }}>{w.label}</span>)}</div></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const t = r.item;
            const late = r.kind === 'task' && t.milestoneVariance > 0;
            return (
              <tr key={r.key} className={`canon-row-${r.kind}`}>
                <td className="num" data-pf="text">{r.kind === 'sub' ? '' : t.wbsCode || t.id}</td>
                <td className="name" data-pf="text">
                  {t.name}{late && <span className="canon-flag"> · +{t.milestoneVariance}d vs contract</span>}
                </td>
                <td className="num" data-pf="text">{r.kind === 'task' ? `${t.duration}d` : ''}</td>
                <td className="num" data-pf="text">{t.startDate ? t.startDate.slice(5).replace('-', '/') + '/' + t.startDate.slice(2, 4) : ''}</td>
                <td className="num" data-pf="text">{t.endDate ? t.endDate.slice(5).replace('-', '/') + '/' + t.endDate.slice(2, 4) : ''}</td>
                <td className="tl">
                  <div className="canon-grid">{scale.months.map((m, i) => <b key={i} className="m" style={{ left: `${m.left}%` }} />)}</div>
                  {todayPct > 0 && todayPct < 100 && <span className="canon-today" style={{ left: `${todayPct}%` }} />}
                  {bar(t, r.kind)}
                  {r.kind === 'task' && t.contractDate && <span className="canon-contract" style={{ left: `${scale.pct(t.contractDate)}%` }} title={`Contract ${t.contractDate}`} />}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="canon-tfoot"><tr><td colSpan={6} /></tr></tfoot>
      </table>
      <div className="canon-foot">
        <span data-pf="text">{project.name}</span>
        <span data-pf="text">{version} · {docDate}</span>
      </div>
    </div>
  );
}

// Standalone HTML (logo inlined, SYNC removed) for Drive, JobTread and hosting fallback.
export async function exportCanonicalHTML(project, meta) {
  const node = document.getElementById('canonical-schedule');
  if (!node) return null;
  const clone = node.cloneNode(true);
  clone.querySelectorAll('[data-export="omit"]').forEach(n => n.remove());
  clone.querySelectorAll('style').forEach(n => n.remove());
  const img = clone.querySelector('.canon-logo img');
  try {
    const blob = await (await fetch('./ntxp-logo-reversed.png')).blob();
    img.src = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch { /* keep relative src */ }
  const title = `${project.name} — Project Schedule ${'v' + meta.version}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title><style>body{margin:0;background:#fff}${CANON_CSS}</style></head><body>${clone.outerHTML}</body></html>`;
}
