import React, { useCallback, useState } from 'react';
import GanttChart from './GanttChart.jsx';
import ListView from './ListView.jsx';
import CalendarView from './CalendarView.jsx';
import ExportPanel from './ExportPanel.jsx';
import ProcurementPanel from './ProcurementPanel.jsx';
import InputPanel from './InputPanel.jsx';
import CanonicalSchedule from './CanonicalSchedule.jsx';
import SyncModal from './SyncModal.jsx';
import TrackersPanel from './TrackersPanel.jsx';
import ChangelogPanel from './ChangelogPanel.jsx';
import EnvironmentPanel from './EnvironmentPanel.jsx';

const TABS = [
  { id: 'canonical', label: 'Canonical' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'trackers', label: 'Trackers' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'input', label: 'Input', edit: true },
  { id: 'changelog', label: 'Changelog' },
  { id: 'environment', label: 'Environment', edit: true },
  { id: 'export', label: 'Export' },
];

export default function ScheduleViewer({ project, meta, hosted, onProcurementImport, onApplyProposals, onMemory, onApplySync, onConfirmOptimization, onLinks, onCoda }) {
  const [activeTab, setActiveTab] = useState('canonical');
  const [syncOpen, setSyncOpen] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const handlePreflight = useCallback(r => setPreflight(r), []);

  const allTasks = project.wbs.flatMap(p => p.children || []);
  const stats = [
    ['Working Days', `${project.workingDuration || '—'}d`],
    ['Calendar Days', project.calendarDuration || '—'],
    ['Critical Path', `${project.criticalPathDuration || '—'}d`, 'critical'],
    ['End Date', project.endDate || '—'],
    ['Critical Tasks', allTasks.filter(t => t.isCritical).length, 'critical'],
    ['With Submittal / Lead', allTasks.filter(t => t.hasSubmittal).length],
    ['Canonical Version', `v${meta.version}`],
  ];

  return (
    <div>
      <div className="summary-grid">
        {stats.map(([label, value, cls]) => (
          <div className="summary-stat" key={label}>
            <div className="label">{label}</div>
            <div className={`value ${cls || ''}`} style={String(value).length > 8 ? { fontSize: '1.05rem' } : undefined}>{value}</div>
          </div>
        ))}
      </div>

      {preflight && (
        <details className={`preflight ${preflight.pass ? 'pass' : 'fail'}`}>
          <summary>Pre-flight: {preflight.pass ? 'all deterministic checks pass' : `${preflight.failures.length} check(s) failing`} — model-council inspection and final audit run in the agent before publishing</summary>
          <ul>{preflight.results.map(r => <li key={r.id} className={r.ok ? 'ok' : r.warnOnly ? 'warn' : 'bad'}>{r.ok ? '✓' : r.warnOnly ? '!' : '✗'} {r.msg}</li>)}</ul>
        </details>
      )}

      <div className="tabs tabs-scroll">
        {TABS.filter(t => !(hosted && t.edit)).map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className={activeTab === 'canonical' ? 'canon-wrap' : 'card'}>
        {activeTab === 'canonical' && <CanonicalSchedule project={project} meta={meta} onSync={() => setSyncOpen(true)} onPreflight={handlePreflight} />}
        {activeTab === 'gantt' && <GanttChart project={project} />}
        {activeTab === 'list' && <ListView project={project} />}
        {activeTab === 'calendar' && <CalendarView project={project} />}
        {activeTab === 'trackers' && <TrackersPanel project={project} meta={meta} />}
        {activeTab === 'procurement' && <ProcurementPanel project={project} onImport={onProcurementImport} />}
        {activeTab === 'input' && <InputPanel project={project} onApplyProposals={onApplyProposals} onMemory={onMemory} />}
        {activeTab === 'changelog' && <ChangelogPanel meta={meta} />}
        {activeTab === 'environment' && <EnvironmentPanel meta={meta} projectName={project.name} onConfirm={onConfirmOptimization} onLinks={onLinks} onCoda={onCoda} />}
        {activeTab === 'export' && <ExportPanel project={project} meta={meta} preflight={preflight} />}
      </div>

      {syncOpen && (
        <SyncModal project={project} meta={meta} onClose={() => setSyncOpen(false)}
          onApply={(items, bundle) => { onApplySync(items, bundle); setSyncOpen(false); }} />
      )}
    </div>
  );
}
