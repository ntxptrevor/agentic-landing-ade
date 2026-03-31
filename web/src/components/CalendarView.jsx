import React, { useMemo } from 'react';
import { parseDate, formatDate, getDaysInMonth, getMonthName } from '../utils/dateUtils.js';

export default function CalendarView({ project }) {
  const { wbs, startDate, endDate } = project;

  const months = useMemo(() => {
    if (!startDate || !endDate) return [];

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const result = [];

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const daysInMonth = getDaysInMonth(year, month);

      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateStr = formatDate(date);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Find tasks active on this day
        const activeTasks = [];
        for (const phase of wbs) {
          for (const task of phase.children || []) {
            if (!task.startDate || !task.endDate) continue;
            if (dateStr >= task.startDate && dateStr <= task.endDate) {
              activeTasks.push({
                wbs: task.wbsCode,
                name: task.name,
                isCritical: task.isCritical,
                isStart: dateStr === task.startDate,
                isEnd: dateStr === task.endDate,
              });
            }
          }
        }

        days.push({ date: d, dateStr, dayOfWeek, isWeekend, activeTasks });
      }

      result.push({
        label: `${getMonthName(month)} ${year}`,
        year,
        month,
        days,
      });

      current = new Date(year, month + 1, 1);
    }

    return result;
  }, [wbs, startDate, endDate]);

  if (months.length === 0) {
    return <div className="empty-state">No schedule data to display.</div>;
  }

  return (
    <div className="calendar-container">
      {months.map((m, mi) => (
        <div key={mi} style={{ marginBottom: 32 }}>
          <div className="calendar-month-title">{m.label}</div>
          <div className="calendar-grid">
            {/* Headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat/Sun'].map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}

            {/* Leading empty cells */}
            {(() => {
              const firstDay = new Date(m.year, m.month, 1).getDay();
              // Convert Sunday=0 to Monday-based: Mon=0..Sun=6
              const offset = firstDay === 0 ? 5 : firstDay - 1;
              const cells = [];
              for (let i = 0; i < Math.min(offset, 5); i++) {
                cells.push(<div key={`empty-${i}`} className="calendar-cell" />);
              }
              return cells;
            })()}

            {/* Day cells - group weekdays + weekend */}
            {(() => {
              const cells = [];
              let i = 0;
              while (i < m.days.length) {
                const day = m.days[i];
                if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
                  // Weekday
                  cells.push(
                    <div key={day.dateStr} className="calendar-cell">
                      <div className="calendar-date">{day.date}</div>
                      {day.activeTasks.slice(0, 3).map((t, ti) => (
                        <div
                          key={ti}
                          className={`calendar-task ${t.isCritical ? 'critical' : 'normal'} ${t.isStart ? 'start' : ''} ${t.isEnd ? 'end' : ''}`}
                          title={t.name}
                        >
                          {t.wbs}
                        </div>
                      ))}
                      {day.activeTasks.length > 3 && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                          +{day.activeTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  );
                  i++;
                } else if (day.dayOfWeek === 6) {
                  // Saturday - combine with Sunday
                  const sundayDay = m.days[i + 1];
                  cells.push(
                    <div key={day.dateStr} className="calendar-cell weekend">
                      <div className="calendar-date">
                        {day.date}{sundayDay ? `-${sundayDay.date}` : ''}
                      </div>
                    </div>
                  );
                  i += sundayDay ? 2 : 1;
                } else {
                  // Sunday alone (month starts on Sunday)
                  cells.push(
                    <div key={day.dateStr} className="calendar-cell weekend">
                      <div className="calendar-date">{day.date}</div>
                    </div>
                  );
                  i++;
                }
              }
              return cells;
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}
