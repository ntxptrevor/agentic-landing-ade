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

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isWorkingDay(date, workingDays, holidays) {
  const dayName = DAY_NAMES[date.getDay()];
  if (!workingDays.includes(dayName)) return false;
  const dateStr = formatDate(date);
  if (holidays.includes(dateStr)) return false;
  return true;
}

export function addWorkingDays(startDate, days, workingDays, holidays) {
  let current = new Date(startDate);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, workingDays, holidays)) {
      added++;
    }
  }
  return current;
}

export function workingDaysBetween(start, end, workingDays, holidays) {
  let current = new Date(start);
  let count = 0;
  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, workingDays, holidays)) {
      count++;
    }
  }
  return count;
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
