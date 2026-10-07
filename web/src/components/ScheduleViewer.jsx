import React, { useState } from 'react';
import GanttChart from './GanttChart.jsx';
import ListView from './ListView.jsx';
import CalendarView from './CalendarView.jsx';
import ExportPanel from './ExportPanel.jsx';
import ProcurementPanel from './ProcurementPanel.jsx';

export default function ScheduleViewer({ project, onProcurementImport }) {
  const [activeTab, setActiveTab] = useState('gantt');

  const allTasks = project.wbs.flatMap(p => p.children || []);
  const criticalCount = allTasks.filter(t => t.isCritical).length;
  const deliverableCount = allTasks.filter(t => t.category === 'deliverable').length;
  const deliveryCount = allTasks.filter(t => t.category === 'delivery').length;
  const procurementCount = allTasks.filter(t => t.category === 'procurement').length;

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
        <div className="summary-stat">
          <div className="label">Deliverables</div>
          <div className="value" style={{ color: 'var(--deliverable)' }}>{deliverableCount}</div>
        </div>
        <div className="summary-stat">
          <div className="label">Deliveries</div>
          <div className="value" style={{ color: 'var(--delivery)' }}>{deliveryCount}</div>
        </div>
        <div className="summary-stat">
          <div className="label">Procurement</div>
          <div className="value" style={{ color: 'var(--procurement)' }}>{procurementCount}</div>
        </div>
      </div>

      <div className="category-legend">
        <span className="legend-item"><span className="legend-swatch deliverable"></span> Deliverable</span>
        <span className="legend-item"><span className="legend-swatch delivery"></span> Delivery</span>
        <span className="legend-item"><span className="legend-swatch procurement"></span> Procurement</span>
        <span className="legend-item"><span className="legend-swatch critical"></span> Critical Path</span>
        <span className="legend-item"><span className="legend-swatch normal"></span> Activity</span>
      </div>

      <div className="tabs">
        {[
          { id: 'gantt', label: 'Gantt Chart' },
          { id: 'list', label: 'List View' },
          { id: 'calendar', label: 'Calendar' },
          { id: 'procurement', label: 'Procurement' },
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
        {activeTab === 'procurement' && <ProcurementPanel project={project} onImport={onProcurementImport} />}
        {activeTab === 'export' && <ExportPanel project={project} />}
      </div>
    </div>
  );
}
