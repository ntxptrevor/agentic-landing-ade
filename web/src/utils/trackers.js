// Deterministic trackers. Each item receives a JEV impact rating (1-5) that drives
// notification level, color, model escalation and user gating during sync.

export const JEV_RATINGS = {
  1: { label: 'Log', color: '#8A94A6', notify: 'changelog only', gate: false, intel: 'script' },
  2: { label: 'Note', color: '#2F529B', notify: 'listed in sync summary', gate: false, intel: 'low' },
  3: { label: 'Watch', color: '#B45309', notify: 'highlighted in sync + conversational note', gate: false, intel: 'mid' },
  4: { label: 'Flag', color: '#B92A32', notify: 'user must acknowledge during sync', gate: true, intel: 'high' },
  5: { label: 'Gate', color: '#D0353C', notify: 'explicit permission + council gate notification (email/text)', gate: true, intel: 'frontier' },
};

const DAY = 86400000;
const toDate = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`) : null);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
const clamp = r => Math.max(1, Math.min(5, r));

function findTask(wbs, id) {
  for (const p of wbs || []) {
    for (const t of p.children || []) {
      if (t.id === id) return t;
      for (const s of t.children || []) if (s.id === id) return s;
    }
  }
  return null;
}

export function rateRFI(rfi, wbs, today) {
  const issues = [];
  let r = 1;
  const task = findTask(wbs, rfi.linkedTaskId);
  if (rfi.status !== 'closed' && rfi.dueDate && daysBetween(rfi.dueDate, today) > 0) { r = 3; issues.push(`Response ${daysBetween(rfi.dueDate, today)}d overdue`); }
  if (rfi.status !== 'closed' && task?.startDate && daysBetween(today, task.startDate) <= 10) { r = Math.max(r, 4); issues.push(`Blocks ${task.name} starting ${task.startDate}`); }
  if (rfi.status === 'answered' && !(rfi.communicatedTo || []).length) { r = Math.max(r, 3); issues.push('Answer not yet sent to affected subcontractors'); }
  if (rfi.costImpact || rfi.timeImpact) { r = Math.max(r, 4); issues.push('Response carries cost/time impact'); }
  if (task?.isCritical && r >= 3) r += 1;
  if (rfi.affectsMilestone) r = 5;
  return { rating: clamp(r), issues };
}

// Submittal lifecycle: submitted -> approved -> ordered -> shipped -> delivered -> installed
export const SUBMITTAL_STAGES = ['submitted', 'approved', 'ordered', 'shipped', 'delivered', 'installed'];

export function rateSubmittal(sub, wbs, today, bufferDays = 5) {
  const issues = [];
  let r = 1;
  const task = findTask(wbs, sub.linkedTaskId);
  const needBy = task?.startDate ? new Date(toDate(task.startDate).getTime() - bufferDays * DAY) : null;
  const base = sub.orderedDate || sub.approvedDate || (sub.submittedDate ? new Date(toDate(sub.submittedDate).getTime() + 10 * DAY) : null);
  const projected = sub.deliveredDate ? toDate(sub.deliveredDate)
    : sub.shipEta ? toDate(sub.shipEta)
      : base ? new Date(toDate(base).getTime() + (sub.leadDays || 0) * DAY) : null;
  const stage = SUBMITTAL_STAGES.filter(s => sub[`${s}Date`]).pop() || 'not_submitted';
  // Procurement pull (council audit 2026-10-13): order-by = need-by − lead − architect review
  // (14 CD default; contract value when set). Past order-by with no order = release at risk.
  const reviewDays = sub.reviewDays ?? 14;
  const orderBy = needBy ? new Date(needBy.getTime() - ((sub.leadDays || 0) + reviewDays) * DAY) : null;
  const releaseAtRisk = !!(orderBy && !sub.orderedDate && toDate(today) > orderBy);
  if (releaseAtRisk) { r = Math.max(r, task?.isCritical ? 5 : 4); issues.push(`Release at risk: order-by ${orderBy.toISOString().slice(0, 10)} passed with no order`); }
  if (stage === 'not_submitted' && task?.startDate && daysBetween(today, task.startDate) < (sub.leadDays || 0) + 20) { r = 4; issues.push('Not submitted; lead time no longer fits before install'); }
  if (sub.status === 'revise_resubmit') { r = Math.max(r, 3); issues.push('Architect requested revise & resubmit'); }
  if (stage === 'approved' && !sub.orderedDate && daysBetween(sub.approvedDate, today) > 3) { r = Math.max(r, 3); issues.push(`Approved ${daysBetween(sub.approvedDate, today)}d ago but no confirmed order`); }
  if (stage === 'ordered' && !sub.trackingNumber && projected && daysBetween(today, projected) <= 7) { r = Math.max(r, 3); issues.push('Delivery due within 7 days with no shipping confirmation'); }
  let slip = 0;
  if (needBy && projected && projected > needBy) {
    slip = Math.round((projected - needBy) / DAY);
    r = Math.max(r, slip > (task?.float || 0) ? (task?.isCritical ? 5 : 4) : 3);
    issues.push(`Projected on site ${projected.toISOString().slice(0, 10)} — ${slip}d after need-by`);
  }
  return { rating: clamp(r), issues, stage, projected: projected?.toISOString().slice(0, 10) || null, needBy: needBy?.toISOString().slice(0, 10) || null, orderBy: orderBy?.toISOString().slice(0, 10) || null, releaseAtRisk, slip };
}

export function rateASI(asi) {
  const issues = [];
  let r = 2;
  const parties = ['owner', 'architect', 'gc', 'subs'];
  const missing = parties.filter(p => !(asi.distributedTo || []).includes(p));
  if (missing.length) { r = 3; issues.push(`Not distributed to: ${missing.join(', ')}`); }
  if (asi.type === 'change_order' && asi.status === 'pending' && asi.timeExtensionDays) { r = 4; issues.push(`Pending CO requests ${asi.timeExtensionDays}d extension`); }
  if (asi.affectsMilestone) { r = 5; issues.push('Changes a milestone / contract date'); }
  return { rating: clamp(r), issues };
}

// AR — owner pay applications. Cycle day comes from the contract (default 25th).
export function ratePayApp(app, today, cycleDay = 25) {
  const issues = [];
  let r = 1;
  const t = toDate(today);
  const due = new Date(t.getFullYear(), t.getMonth(), cycleDay);
  const daysToDue = Math.round((due - t) / DAY);
  if (app.status === 'not_started' && daysToDue <= 5 && daysToDue >= 0) { r = 4; issues.push(`Pay app due in ${daysToDue}d and not started`); }
  if (app.status === 'not_started' && daysToDue < 0) { r = 4; issues.push(`Pay app ${-daysToDue}d past the cycle day and not started`); }
  if (app.status === 'submitted' && app.submittedDate && daysBetween(app.submittedDate, today) > 30 && !app.paidDate) { r = Math.max(r, 3); issues.push('Submitted >30 days, unpaid'); }
  if (app.percentBilled != null && app.percentComplete != null && app.percentBilled < app.percentComplete - 10) { r = Math.max(r, 3); issues.push(`Underbilled: ${app.percentBilled}% billed vs ${app.percentComplete}% complete`); }
  return { rating: clamp(r), issues };
}

// AP — sub invoices. Due the 20th for payment the following month. Acceptance needs
// PM approval in JobTread + attached NTXP Purchase Order + Conditional Waiver.
export function rateSubInvoice(inv, today) {
  const issues = [];
  let r = 1;
  const t = toDate(today);
  const cutoff = new Date(t.getFullYear(), t.getMonth(), 20);
  if (!inv.hasPurchaseOrder) { r = 3; issues.push('NTXP Purchase Order not attached'); }
  if (!inv.hasConditionalWaiver) { r = Math.max(r, 3); issues.push('Conditional waiver not attached'); }
  if (inv.receivedDate && toDate(inv.receivedDate).getDate() > 20) { r = Math.max(r, 2); issues.push('Received after the 20th — rolls to next cycle'); }
  if (!inv.pmApproved && t > cutoff) { r = Math.max(r, 4); issues.push('Past the 20th and not PM-approved'); }
  if (inv.amount && inv.poBalance != null && inv.amount > inv.poBalance) { r = Math.max(r, 4); issues.push('Exceeds remaining PO balance'); }
  return { rating: clamp(r), issues, acceptable: !!(inv.pmApproved && inv.hasPurchaseOrder && inv.hasConditionalWaiver) };
}

// Tasks completed per schedule with no saved bill near month end -> nudge.
export function unbilledWork(wbs, invoices, today) {
  const t = toDate(today);
  if (t.getDate() < 15) return [];
  const billed = new Set((invoices || []).map(i => i.linkedTaskId));
  const out = [];
  for (const p of wbs || []) {
    for (const task of p.children || []) {
      if (task.endDate && toDate(task.endDate) <= t && task.trade && !['PM', 'Owner', 'Architect', 'GC', 'PM/Super', 'Super', 'AHJ'].includes(task.trade) && !billed.has(task.id)) {
        out.push({ taskId: task.id, name: task.name, trade: task.trade, rating: 2, issue: 'Scheduled work complete — no sub bill saved in JobTread' });
      }
    }
  }
  return out;
}

export function rateAll(trackers = {}, wbs, today) {
  return {
    rfis: (trackers.rfis || []).map(x => ({ ...x, ...rateRFI(x, wbs, today) })),
    submittals: (trackers.submittals || []).map(x => ({ ...x, ...rateSubmittal(x, wbs, today) })),
    asis: (trackers.asis || []).map(x => ({ ...x, ...rateASI(x) })),
    payApps: (trackers.payApps || []).map(x => ({ ...x, ...ratePayApp(x, today, trackers.payAppCycleDay) })),
    subInvoices: (trackers.subInvoices || []).map(x => ({ ...x, ...rateSubInvoice(x, today) })),
    unbilled: unbilledWork(wbs, trackers.subInvoices, today),
  };
}
