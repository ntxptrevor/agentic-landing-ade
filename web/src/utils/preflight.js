// Deterministic pre-flight checks run before every canonical output. Their results
// are the input to the model-council inspection and the final integrity audit.

const SEQUENCE_RULES = [
  { id: 'ntp_before_mob', before: /notice to proceed/i, after: /^mobilization$/i, msg: 'NTP must precede Mobilization' },
  { id: 'coverup_before_drywall', before: /cover-?up inspection/i, after: /drywall/i, msg: 'Cover-up inspection must precede drywall' },
  { id: 'abovecl_before_tile', before: /above.?ceiling/i, after: /ceiling tile/i, msg: 'Above-ceiling inspection must precede ceiling tile' },
  { id: 'ug_insp_before_pourback', before: /underground mep inspection/i, after: /pourback — interior/i, msg: 'Underground inspection must precede interior pourback' },
  { id: 'prime_before_floor', before: /prime coat/i, after: /install flooring/i, msg: 'Prime coat before flooring' },
  { id: 'abatement_before_demo', before: /abatement|asbestos|lead/i, after: /selective & interior trench demo/i, msg: 'Abatement and clearance must precede demolition' },
  { id: 'moisture_before_floor', before: /moisture/i, after: /install flooring/i, msg: 'Slab moisture/pH test before resilient flooring' },
  { id: 'fa_accept_before_sc', before: /fire alarm 100% acceptance/i, after: /substantial completion/i, msg: 'Fire alarm acceptance before substantial completion' },
  { id: 'icra_clear_before_removal', before: /icra barrier inspection/i, after: /hepa terminal clean/i, msg: 'ICRA barrier inspection precedes terminal clean & removal' },
  { id: 'final_clean_before_sc', before: /final clean/i, after: /substantial completion/i, msg: 'Final clean before owner punch / substantial completion' },
  { id: 'punch_before_turnover', before: /complete punch/i, after: /^turnover/i, msg: 'Punch complete before turnover' },
];

export function sequenceChecks(project) {
  const tasks = project.wbs.flatMap(p => p.children).filter(t => !t.isReference);
  const results = [];
  for (const r of SEQUENCE_RULES) {
    const a = tasks.find(t => r.before.test(t.name));
    const b = tasks.find(t => r.after.test(t.name));
    if (!a || !b) continue;
    const ok = a.endDate && b.startDate && a.endDate < b.startDate;
    results.push({ id: r.id, ok, msg: ok ? r.msg : `${r.msg} — ${a.name} ends ${a.endDate}, ${b.name} starts ${b.startDate}` });
  }
  return results;
}

export function dataChecks(project, meta) {
  const tasks = project.wbs.flatMap(p => p.children);
  const out = [];
  const undated = tasks.filter(t => !t.startDate || !t.endDate);
  out.push({ id: 'all_dated', ok: undated.length === 0, msg: undated.length ? `${undated.length} tasks have no dates` : 'Every task is dated' });
  const orphans = tasks.filter((t, i) => i > 0 && !t.isReference && !(t.predecessors || []).length && !t.actualStart && !String(t.source || '').startsWith('sync'));
  out.push({ id: 'no_orphans', ok: orphans.length === 0, msg: orphans.length ? `Unlinked tasks: ${orphans.slice(0, 5).map(t => t.id).join(', ')}` : 'Every task is linked' });
  out.push({ id: 'requirements_gate', ok: ['uploaded', 'acknowledged_none'].includes(meta.requirements?.status), msg: `Requirements: ${meta.requirements?.status || 'pending'}` });
  const late = tasks.filter(t => t.contractDate && t.milestoneVariance > 0);
  out.push({ id: 'milestones', ok: late.length === 0, msg: late.length ? `${late.length} milestone(s) projected past contract date — not moved without permission` : 'No milestone variance' });
  const links = meta.links || {};
  const missing = ['jobtreadJobId', 'driveFolderId', 'kbPath'].filter(k => !links[k]);
  out.push({ id: 'sync_links', ok: missing.length === 0, warnOnly: true, msg: missing.length ? `Sync links missing: ${missing.join(', ')}` : 'JobTread, Drive and KB links set' });
  return out;
}

// Layout checks against the rendered DOM: clipped text, text touching cell edges,
// font consistency.
export function layoutChecks(root) {
  if (!root) return [];
  const out = [];
  const cells = root.querySelectorAll('[data-pf="text"]');
  let clipped = 0; let touching = 0;
  const fonts = new Set();
  cells.forEach(el => {
    const cs = getComputedStyle(el);
    fonts.add(cs.fontFamily.split(',')[0].trim());
    if (el.scrollWidth > el.clientWidth + 1) clipped++;
    const pl = parseFloat(cs.paddingLeft) || 0; const pr = parseFloat(cs.paddingRight) || 0;
    if (pl < 3 || pr < 3) touching++;
  });
  out.push({ id: 'no_clipping', ok: clipped === 0, msg: clipped ? `${clipped} text cells clipped` : 'No clipped text' });
  out.push({ id: 'edge_spacing', ok: touching === 0, msg: touching ? `${touching} cells with text against a border` : 'All text clear of borders' });
  out.push({ id: 'font_consistency', ok: fonts.size <= 1, msg: `Font families in use: ${[...fonts].join(', ') || 'n/a'}` });
  return out;
}

export function runPreflight(project, meta, root) {
  const all = [...sequenceChecks(project), ...dataChecks(project, meta), ...layoutChecks(root)];
  const failures = all.filter(r => !r.ok && !r.warnOnly);
  return { results: all, pass: failures.length === 0, failures };
}
