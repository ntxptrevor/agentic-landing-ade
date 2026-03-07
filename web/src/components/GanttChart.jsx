import React, { useMemo } from 'react';
import { parseDate, getMonthName } from '../utils/dateUtils.js';

export default function GanttChart({ project }) {
  const { wbs, startDate, endDate } = project;

  const timeline = useMemo(() => {
    if (!startDate || !endDate) return null;

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const pixelsPerDay = Math.max(4, Math.min(30, 800 / totalDays));
    const totalWidth = totalDays * pixelsPerDay;

    // Build month headers
    const months = [];
    let current = new Date(start);
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const visStart = new Date(Math.max(monthStart, start));
      const visEnd = new Date(Math.min(monthEnd, end));
      const startOffset = Math.round((visStart - start) / (1000 * 60 * 60 * 24));
      const span = Math.round((visEnd - visStart) / (1000 * 60 * 60 * 24)) + 1;

      months.push({
        label: `${getMonthName(current.getMonth())} ${current.getFullYear()}`,
        left: startOffset * pixelsPerDay,
        width: span * pixelsPerDay,
      });

      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    // Build week lines
    const weekLines = [];
    for (let d = 7; d < totalDays; d += 7) {
      weekLines.push(d * pixelsPerDay);
    }

    return { start, totalDays, pixelsPerDay, totalWidth, months, weekLines };
  }, [startDate, endDate]);

  if (!timeline) {
    return <div className="empty-state">No schedule data to display.</div>;
  }

  const getBarPosition = (taskStart, taskEnd) => {
    if (!taskStart || !taskEnd) return null;
    const s = parseDate(taskStart);
    const e = parseDate(taskEnd);
    const leftDays = Math.round((s - timeline.start) / (1000 * 60 * 60 * 24));
    const spanDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return {
      left: leftDays * timeline.pixelsPerDay,
      width: Math.max(4, spanDays * timeline.pixelsPerDay),
    };
  };

  return (
    <div className="gantt-container">
      <div style={{ minWidth: 300 + timeline.totalWidth }}>
        {/* Month headers */}
        <div className="gantt-header">
          <div className="gantt-label-col">Task</div>
          <div className="gantt-timeline-header" style={{ width: timeline.totalWidth }}>
            {timeline.months.map((m, i) => (
              <div
                key={i}
                className="gantt-month"
                style={{ width: m.width, minWidth: m.width }}
              >
                {m.width > 40 ? m.label : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Task rows */}
        {wbs.map(phase => (
          <React.Fragment key={phase.id}>
            {/* Phase row */}
            <div className="gantt-row phase-row">
              <div className="gantt-label">
                <span className="wbs">{phase.wbsCode}</span>
                {phase.name}
              </div>
              <div className="gantt-timeline" style={{ width: timeline.totalWidth }}>
                {timeline.weekLines.map((x, i) => (
                  <div key={i} className="gantt-day-line" style={{ left: x }} />
                ))}
              </div>
            </div>

            {/* Task rows */}
            {(phase.children || []).map(task => {
              const bar = getBarPosition(task.startDate, task.endDate);
              return (
                <div key={task.id} className="gantt-row">
                  <div className="gantt-label">
                    <span className="wbs">{task.wbsCode}</span>
                    {task.name}
                    <span className="dur">{task.duration}d</span>
                  </div>
                  <div className="gantt-timeline" style={{ width: timeline.totalWidth }}>
                    {timeline.weekLines.map((x, i) => (
                      <div key={i} className="gantt-day-line" style={{ left: x }} />
                    ))}
                    {bar && (
                      <div
                        className={`gantt-bar ${task.isCritical ? 'critical' : 'normal'}`}
                        style={{ left: bar.left, width: bar.width }}
                        title={`${task.name}: ${task.startDate} - ${task.endDate} (${task.duration}d)${task.isCritical ? ' [CRITICAL]' : ''}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
