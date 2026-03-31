import React, { useState, useCallback } from 'react';
import ProjectSetup from './components/ProjectSetup.jsx';
import PhaseSelection from './components/PhaseSelection.jsx';
import TaskEditor from './components/TaskEditor.jsx';
import ReviewGenerate from './components/ReviewGenerate.jsx';
import ScheduleViewer from './components/ScheduleViewer.jsx';
import { calculateSchedule } from './utils/scheduler.js';
import { getUSFederalHolidays } from './utils/dateUtils.js';
import { CONSTRUCTION_PHASES } from './data/constructionPhases.js';

const STEPS = [
  { id: 'setup', label: 'Project Setup' },
  { id: 'phases', label: 'Select Phases' },
  { id: 'tasks', label: 'Define Tasks' },
  { id: 'review', label: 'Review & Generate' },
  { id: 'view', label: 'View Schedule' },
];

function buildInitialProject() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    name: '',
    startDate: `${yyyy}-${mm}-${dd}`,
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    hoursPerDay: 8,
    holidays: [],
    holidayPreset: 'none',
    wbs: [],
    milestones: [],
    dependencies: [],
  };
}

export default function App() {
  const [step, setStep] = useState('setup');
  const [project, setProject] = useState(buildInitialProject);
  const [selectedPhaseIds, setSelectedPhaseIds] = useState([]);
  const [computed, setComputed] = useState(null);

  const updateProject = useCallback((updates) => {
    setProject(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSetupDone = (data) => {
    const holidays = data.holidayPreset === 'us'
      ? getUSFederalHolidays(new Date(data.startDate).getFullYear())
      : data.holidays;
    updateProject({ ...data, holidays });
    setStep('phases');
  };

  const handlePhasesDone = (phaseIds) => {
    setSelectedPhaseIds(phaseIds);

    // Build WBS from selected phases
    let phaseIndex = 0;
    const wbs = phaseIds.map(pid => {
      phaseIndex++;
      const phaseData = CONSTRUCTION_PHASES.find(p => p.id === pid);
      return {
        id: `${phaseIndex}`,
        type: 'phase',
        name: phaseData.name,
        wbsCode: `${phaseIndex}`,
        children: phaseData.defaultTasks.map((t, ti) => ({
          id: `${phaseIndex}.${ti + 1}`,
          type: 'task',
          name: t.name,
          wbsCode: `${phaseIndex}.${ti + 1}`,
          duration: t.duration,
          durationUnit: 'days',
          trade: t.trade,
          predecessors: [],
          successors: [],
          isMilestone: false,
          isCritical: false,
          notes: '',
          children: [],
        })),
      };
    });

    // Auto-wire sequential dependencies between phases
    const deps = [];
    for (let i = 1; i < wbs.length; i++) {
      const prevPhase = wbs[i - 1];
      const curPhase = wbs[i];
      const lastTask = prevPhase.children[prevPhase.children.length - 1];
      const firstTask = curPhase.children[0];
      if (lastTask && firstTask) {
        firstTask.predecessors = [lastTask.id];
        deps.push({ from: lastTask.id, to: firstTask.id, type: 'FS', lag: 0, lagUnit: 'days' });
      }
    }

    // Auto-wire sequential tasks within each phase
    for (const phase of wbs) {
      for (let i = 1; i < phase.children.length; i++) {
        const prev = phase.children[i - 1];
        const cur = phase.children[i];
        if (cur.predecessors.length === 0) {
          cur.predecessors = [prev.id];
          deps.push({ from: prev.id, to: cur.id, type: 'FS', lag: 0, lagUnit: 'days' });
        }
      }
    }

    updateProject({ wbs, dependencies: deps });
    setStep('tasks');
  };

  const handleTasksDone = (wbs, dependencies) => {
    updateProject({ wbs, dependencies });
    setStep('review');
  };

  const handleGenerate = () => {
    const result = calculateSchedule(project);
    setComputed(result);
    updateProject(result);
    setStep('view');
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.id === step);
    if (idx > 0) setStep(STEPS[idx - 1].id);
  };

  const handleNewProject = () => {
    setProject(buildInitialProject());
    setSelectedPhaseIds([]);
    setComputed(null);
    setStep('setup');
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <>
      <header className="header">
        <h1><span>BidForge</span> Schedules</h1>
        <div className="header-actions">
          {step !== 'setup' && (
            <button className="btn btn-secondary btn-sm" onClick={handleNewProject}>
              New Project
            </button>
          )}
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="step-indicator">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`step-item ${s.id === step ? 'active' : ''} ${i < stepIndex ? 'completed' : ''}`}
              >
                <div className="step-num">{i < stepIndex ? '\u2713' : i + 1}</div>
                {s.label}
              </div>
            ))}
          </div>
          {project.name && (
            <div style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              <div><strong>Project:</strong> {project.name}</div>
              <div><strong>Start:</strong> {project.startDate}</div>
              <div><strong>Work Days:</strong> {project.workingDays.join(', ')}</div>
            </div>
          )}
        </aside>
        <main className="main">
          {step === 'setup' && (
            <ProjectSetup project={project} onDone={handleSetupDone} />
          )}
          {step === 'phases' && (
            <PhaseSelection
              selectedIds={selectedPhaseIds}
              onDone={handlePhasesDone}
              onBack={handleBack}
            />
          )}
          {step === 'tasks' && (
            <TaskEditor
              wbs={project.wbs}
              dependencies={project.dependencies}
              onDone={handleTasksDone}
              onBack={handleBack}
            />
          )}
          {step === 'review' && (
            <ReviewGenerate
              project={project}
              onGenerate={handleGenerate}
              onBack={handleBack}
            />
          )}
          {step === 'view' && computed && (
            <ScheduleViewer project={computed} />
          )}
        </main>
      </div>
    </>
  );
}
