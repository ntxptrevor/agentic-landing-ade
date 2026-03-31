import React, { useState } from 'react';
import GanttChart from './GanttChart.jsx';
import ListView from './ListView.jsx';
import CalendarView from './CalendarView.jsx';
import ExportPanel from './ExportPanel.jsx';

export default function ScheduleViewer({ project }) {
  const [activeTab, setActiveTab] = useState('gantt');

  const allTasks = project.wbs.flatMap(p => p.children || []);
  const criticalCount = allTasks.filter(t => t.isCritical).length;

  return (
    <div>
      <div className="summary-grid">
        <div className="summary-stat">
          <div className="label">Project Duration</div>
          <div className="value">{project.workingDuration || '—'}d</div>
        </div>
        <div className="summary-stat">
          <div className="label">Calendar Days</div>
          <div className="value">{project.calendarDuration || '—'}</div>
        </div>
        <div className="summary-stat">
          <div className="label">Critical Path</div>
          <div className="value critical">{project.criticalPathDuration || '—'}d</div>
        </div>
        <div className="summary-stat">
          <div className="label">End Date</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>{project.endDate || '—'}</div>
        </div>
        <div className="summary-stat">
          <div className="label">Critical Tasks</div>
          <div className="value critical">{criticalCount}</div>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'gantt', label: 'Gantt Chart' },
          { id: 'list', label: 'List View' },
          { id: 'calendar', label: 'Calendar' },
          { id: 'export', label: 'Export' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'gantt' && <GanttChart project={project} />}
        {activeTab === 'list' && <ListView project={project} />}
        {activeTab === 'calendar' && <CalendarView project={project} />}
        {activeTab === 'export' && <ExportPanel project={project} />}
      </div>
    </div>
  );
}
