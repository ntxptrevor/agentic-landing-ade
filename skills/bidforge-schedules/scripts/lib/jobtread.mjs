// Shared JobTread helpers for jobtread_push.mjs and schedule_diff.mjs (no dependencies).
//
// Pushed-dates map (written only by `jobtread_push.mjs record`, after a read-back):
//   canonical.sync.jobtreadPushed = { <jobTreadTaskId>: { startDate, endDate, progress?, updatedAt, version, at } }
// The daily pull diffs JobTread against this map, so only true manual JobTread edits become items;
// canonical changes that were not pushed yet are "push pending", never edits.
import { view } from './canonical_read.mjs';

const DAY = 86400000;
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const day = s => new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
const iso = d => d.toISOString().slice(0, 10);

// Working calendar from the canonical project (defaults Mon–Fri, no holidays).
export function calendarOf(doc) {
  const v = view(doc);
  const p = v.project || {};
  const wd = Array.isArray(p.workingDays) && p.workingDays.length ? p.workingDays : (Array.isArray(doc.workingDays) && doc.workingDays.length ? doc.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const hol = Array.isArray(p.holidays) ? p.holidays : (Array.isArray(doc.holidays) ? doc.holidays : []);
  const norm = x => String(x).slice(0, 3).toLowerCase();
  return { workingDays: new Set(wd.map(norm)), holidays: new Set(hol.map(h => String(h).slice(0, 10))) };
}

export function isWorkday(s, cal) {
  const d = day(s);
  return cal.workingDays.has(NAMES[d.getUTCDay()].toLowerCase()) && !cal.holidays.has(iso(d));
}

// Inclusive count of working days from a to b (0 when b < a).
export function workdaysBetween(a, b, cal) {
  let n = 0;
  for (let d = day(a); d <= day(b); d = new Date(d.getTime() + DAY)) if (isWorkday(iso(d), cal)) n++;
  return n;
}

// Signed working-day distance from a to b (b later → positive).
export function workdayShift(a, b, cal) {
  if (!a || !b || a === b) return 0;
  return a < b ? workdaysBetween(a, b, cal) - (isWorkday(a, cal) ? 1 : 0) : -(workdaysBetween(b, a, cal) - (isWorkday(b, cal) ? 1 : 0));
}

export function jtNodes(raw) {
  if (Array.isArray(raw)) return raw;
  return raw?.job?.tasks?.nodes || raw?.tasks?.nodes || raw?.tasks || raw?.nodes || [];
}

export function scheduleTasks(doc) {
  return view(doc).tasks.filter(t => t && !t.isReference && t.type !== 'phase' && (t.startDate || t.endDate));
}

// Normalized pushed map, including the legacy {id: updatedAt} form.
export function pushedMap(doc) {
  const s = (doc.meta && doc.meta.sync) || doc.sync || {};
  const out = {};
  for (const [id, upd] of Object.entries(s.jobtreadPushedUpdatedAt || {})) out[id] = { updatedAt: upd };
  for (const [id, rec] of Object.entries(s.jobtreadPushed || {})) if (rec && typeof rec === 'object') out[id] = { ...out[id], ...rec };
  return out;
}

export const progressOf = t => (t.actualFinish ? 100 : Math.round(Number(t.percentComplete) || 0));
export const jtProgress = j => (typeof j.progress === 'number' ? Math.round(j.progress * 100) : null);
