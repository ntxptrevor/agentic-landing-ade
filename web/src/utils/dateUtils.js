const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Accepts 'YYYY-MM-DD', a full ISO timestamp ('2026-11-16T00:00:00.000Z' — the calendar date
// part is taken as a local date, never shifted by time zone), 'M/D/YYYY' and 'M/D/YY' (20YY),
// or a valid Date. Anything else returns null — never an Invalid Date (council audit #3, A-01).
export function parseDate(str) {
  if (str instanceof Date) return Number.isNaN(str.getTime()) ? null : new Date(str.getFullYear(), str.getMonth(), str.getDate());
  if (typeof str !== 'string') return null;
  const s = str.trim();
  let y, m, d;
  let k = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if (k) { y = +k[1]; m = +k[2]; d = +k[3]; } else {
    k = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
    if (!k) return null;
    m = +k[1]; d = +k[2]; y = k[3].length === 2 ? 2000 + +k[3] : +k[3];
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1000) return null;
  const out = new Date(y, m - 1, d);
  if (out.getFullYear() !== y || out.getMonth() !== m - 1 || out.getDate() !== d) return null; // 2026-02-30
  return out;
}

// Normalize any accepted date form to 'YYYY-MM-DD', or null when it cannot be parsed.
export function toISODate(v) {
  const d = parseDate(v);
  return d ? formatDate(d) : null;
}

export function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function isWorkingDay(date, workingDays, holidays) {
  if (!isValidDate(date)) return false;
  const dayName = DAY_NAMES[date.getDay()];
  if (!(workingDays || []).includes(dayName)) return false;
  const dateStr = formatDate(date);
  if (holidays && (holidays instanceof Set ? holidays.has(dateStr) : holidays.includes(dateStr))) return false;
  return true;
}

// ---- Working-day calendar --------------------------------------------------------------
// Every working-day computation runs on a cached ordinal calendar (day number -> count of
// working days so far), so add/subtract/between are O(1) after a one-time build instead of a
// day-by-day loop with Array.includes. Hard cap: no single call may span more than
// MAX_DAY_ITERATIONS calendar days, and a calendar with no working days throws instead of
// looping forever (A-01, A-27, C-20).
export const MAX_DAY_ITERATIONS = 20000;
const DAY_MS = 86400000;
const MAX_CALENDAR_SPAN = 200000;
const dayNum = d => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
const fromDayNum = n => { const u = new Date(n * DAY_MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
const DOW_INDEX = Object.fromEntries(DAY_NAMES.map((n, i) => [n, i]));

class WorkCalendar {
  constructor(workingDays, holidays) {
    this.wd = new Array(7).fill(false);
    for (const n of workingDays || []) if (n in DOW_INDEX) this.wd[DOW_INDEX[n]] = true;
    this.hol = new Set();
    for (const h of holidays || []) { const p = parseDate(h); if (p) this.hol.add(dayNum(p)); }
    this.lo = 0; this.hi = -1; this.cum = null; this.work = null;
  }
  isWorking(n) { return this.wd[(((n + 4) % 7) + 7) % 7] && !this.hol.has(n); }
  build(lo, hi) {
    if (hi - lo > MAX_CALENDAR_SPAN) throw new RangeError(`Working-day calendar: date range ${fromDayNum(lo).getFullYear()}–${fromDayNum(hi).getFullYear()} is out of the supported span`);
    const len = hi - lo + 1;
    const cum = new Int32Array(len);
    const work = [];
    let c = 0;
    for (let i = 0; i < len; i++) { if (this.isWorking(lo + i)) { c++; work.push(lo + i); } cum[i] = c; }
    if (c === 0 && !this.wd.some(Boolean)) throw new Error('Working-day calendar has no working days (check project.workingDays)');
    this.lo = lo; this.hi = hi; this.cum = cum; this.work = work;
  }
  cover(n) {
    if (this.cum && n >= this.lo && n <= this.hi) return;
    if (!this.cum) { this.build(n - 1100, n + 1100); return; }
    const step = Math.min(Math.max(this.hi - this.lo, 730), 3650);
    this.build(n < this.lo ? Math.min(n, this.lo - step) : this.lo, n > this.hi ? Math.max(n, this.hi + step) : this.hi);
  }
  C(n) { this.cover(n); return this.cum[n - this.lo]; }
  add(x, days) {
    let idx = this.C(x) + days - 1;
    while (idx >= this.work.length) {
      if (this.hi - x > MAX_DAY_ITERATIONS) throw new RangeError(`addWorkingDays: ${days} working days from ${formatDate(fromDayNum(x))} exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
      this.cover(this.hi + 1);
      idx = this.C(x) + days - 1;
    }
    const r = this.work[idx];
    if (r - x > MAX_DAY_ITERATIONS) throw new RangeError(`addWorkingDays: ${days} working days from ${formatDate(fromDayNum(x))} exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
    return r;
  }
  sub(x, days) {
    let idx = this.C(x - 1) - days;
    while (idx < 0) {
      if (x - this.lo > MAX_DAY_ITERATIONS) throw new RangeError(`subtractWorkingDays: ${days} working days before ${formatDate(fromDayNum(x))} exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
      this.cover(this.lo - 1);
      idx = this.C(x - 1) - days;
    }
    const r = this.work[idx];
    if (x - r > MAX_DAY_ITERATIONS) throw new RangeError(`subtractWorkingDays: ${days} working days before ${formatDate(fromDayNum(x))} exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
    return r;
  }
}

const calCache = new WeakMap();
const NO_HOLIDAYS = [];
function calendarFor(workingDays, holidays) {
  const key = holidays && typeof holidays === 'object' ? holidays : NO_HOLIDAYS;
  const wd = Array.isArray(workingDays) ? workingDays : [];
  const list = key instanceof Set ? [...key] : key;
  const sig = `${wd.join(',')}|${list.length}|${list[0] || ''}|${list[list.length - 1] || ''}`;
  const hit = calCache.get(key);
  if (hit && hit.sig === sig) return hit.cal;
  const cal = new WorkCalendar(wd, list);
  calCache.set(key, { sig, cal });
  return cal;
}

function requireDate(d, fn) {
  const v = d instanceof Date ? d : (typeof d === 'string' ? parseDate(d) : (d == null ? null : new Date(d)));
  if (!isValidDate(v)) throw new RangeError(`${fn}: invalid date ${JSON.stringify(d)}`);
  return v;
}
const whole = (days, fn) => {
  const n = Number(days);
  if (Number.isNaN(n) || n <= 0) return 0;
  if (!Number.isFinite(n) || n > MAX_DAY_ITERATIONS) throw new RangeError(`${fn}: ${days} days exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
  return Math.ceil(n);
};

// The `days`-th working day after startDate. days <= 0 returns a copy of startDate
// (unchanged legacy behavior); use shiftWorkingDays for signed offsets.
export function addWorkingDays(startDate, days, workingDays, holidays) {
  const s = requireDate(startDate, 'addWorkingDays');
  const n = whole(days, 'addWorkingDays');
  if (!n) return new Date(s);
  return fromDayNum(calendarFor(workingDays, holidays).add(dayNum(s), n));
}

// The `days`-th working day before fromDate. days <= 0 returns a copy.
export function subtractWorkingDays(fromDate, days, workingDays, holidays) {
  const s = requireDate(fromDate, 'subtractWorkingDays');
  const n = whole(days, 'subtractWorkingDays');
  if (!n) return new Date(s);
  return fromDayNum(calendarFor(workingDays, holidays).sub(dayNum(s), n));
}

// Signed working-day offset: positive adds, negative subtracts, 0 returns a copy.
export function shiftWorkingDays(date, n, workingDays, holidays) {
  return n >= 0 ? addWorkingDays(date, n, workingDays, holidays) : subtractWorkingDays(date, -n, workingDays, holidays);
}

// Working days in (start, end] — 0 when end <= start.
export function workingDaysBetween(start, end, workingDays, holidays) {
  const a = dayNum(requireDate(start, 'workingDaysBetween'));
  const b = dayNum(requireDate(end, 'workingDaysBetween'));
  if (b <= a) return 0;
  if (b - a > MAX_DAY_ITERATIONS) throw new RangeError(`workingDaysBetween: span of ${b - a} days exceeds the ${MAX_DAY_ITERATIONS}-day iteration cap`);
  const cal = calendarFor(workingDays, holidays);
  cal.cover(a); cal.cover(b);
  return cal.C(b) - cal.C(a);
}

// Working days in [start, end] inclusive (0 when end < start).
export function countWorkingDays(start, end, workingDays, holidays) {
  const a = requireDate(start, 'countWorkingDays');
  return workingDaysBetween(a, end, workingDays, holidays) + (dayNum(requireDate(end, 'countWorkingDays')) >= dayNum(a) && isWorkingDay(a, workingDays, holidays) ? 1 : 0);
}

export function calendarDaysBetween(start, end) {
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function getMonthName(index) {
  return MONTH_NAMES[index];
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getDayName(date) {
  return DAY_NAMES[date.getDay()];
}

export function getUSFederalHolidays(year) {
  const holidays = [];
  // New Year's Day
  holidays.push(`${year}-01-01`);
  // MLK Day - 3rd Monday of January
  holidays.push(getNthWeekday(year, 0, 1, 3));
  // Presidents' Day - 3rd Monday of February
  holidays.push(getNthWeekday(year, 1, 1, 3));
  // Memorial Day - last Monday of May
  holidays.push(getLastWeekday(year, 4, 1));
  // Independence Day
  holidays.push(`${year}-07-04`);
  // Labor Day - 1st Monday of September
  holidays.push(getNthWeekday(year, 8, 1, 1));
  // Thanksgiving - 4th Thursday of November
  holidays.push(getNthWeekday(year, 10, 4, 4));
  // Christmas
  holidays.push(`${year}-12-25`);
  return holidays;
}

function getNthWeekday(year, month, weekday, n) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, month, day);
    if (d.getMonth() !== month) break;
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return formatDate(d);
    }
  }
  return null;
}

function getLastWeekday(year, month, weekday) {
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = daysInMonth; day >= 1; day--) {
    const d = new Date(year, month, day);
    if (d.getDay() === weekday) return formatDate(d);
  }
  return null;
}

// NTXP non-work calendar (council audit 2026-10-13): federal holidays plus Thanksgiving week
// and the Dec 22 – Jan 2 winter shutdown, when owners will not take punch or inspections.
export function getNtxpNonWorkDays(year) {
  const days = new Set(getUSFederalHolidays(year));
  const nov1 = new Date(year, 10, 1);
  const thanksgiving = new Date(year, 10, 1 + ((4 - nov1.getDay() + 7) % 7) + 21);
  for (let k = -3; k <= 1; k++) days.add(formatDate(new Date(year, 10, thanksgiving.getDate() + k)));
  for (let d = 22; d <= 31; d++) days.add(formatDate(new Date(year, 11, d)));
  days.add(formatDate(new Date(year, 0, 1)));
  days.add(formatDate(new Date(year, 0, 2)));
  return [...days].sort();
}
