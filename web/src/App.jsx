import React, { useState, useCallback, useEffect } from 'react';
import ProjectSetup from './components/ProjectSetup.jsx';
import RequirementsGate from './components/RequirementsGate.jsx';
import ModuleSelection from './components/ModuleSelection.jsx';
import TaskEditor from './components/TaskEditor.jsx';
import ReviewGenerate from './components/ReviewGenerate.jsx';
import ScheduleViewer from './components/ScheduleViewer.jsx';
import { calculateSchedule } from './utils/scheduler.js';
import { getUSFederalHolidays, getNtxpNonWorkDays } from './utils/dateUtils.js';
import { buildWbs, seedSubmittals } from './utils/jevTree.js';
import { MODULE_BY_ID } from './data/jevTaxonomy.js';
import {
  emptyMeta, logChange, recordInput, addMemory, addOptimizationEntry, applySyncItems, updateCoda, recordCodaBackup,
  saveLocal, loadLocal, fromCanonicalDocument,
} from './utils/canonical.js';

const STEPS = [
  { id: 'setup', label: 'Project Setup' },
  { id: 'requirements', label: 'Schedule Requirements' },
  { id: 'modules', label: 'Scope Modules' },
  { id: 'tasks', label: 'Define Tasks' },
  { id: 'review', label: 'Review & Generate' },
  { id: 'view', label: 'Canonical Schedule' },
];

function buildInitialProject() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    name: '', startDate: `${yyyy}-${mm}-${dd}`, workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    hoursPerDay: 8, holidays: [], holidayPreset: 'none', wbs: [], milestones: [], dependencies: [],
  };
}

const recalc = p => calculateSchedule(JSON.parse(JSON.stringify(p)));

export default function App() {
  const [step, setStep] = useState('setup');
  const [project, setProject] = useState(buildInitialProject);
  const [meta, setMeta] = useState(emptyMeta);
  const [computed, setComputed] = useState(null);
  const [resumable, setResumable] = useState(null);
  const [hosted, setHosted] = useState(false);

  // Hosted mode: canonical.json next to the page (projecttitle.ntxpllc.com/schedule)
  useEffect(() => {
    fetch(`./canonical.json?t=${Date.now()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(doc => {
        if (doc?.schema === 'bidforge.canonical.v1') {
          const { project: p, meta: m } = fromCanonicalDocument(doc);
          const c = recalc(p);
          setProject(c); setMeta(m); setComputed(c); setHosted(true); setStep('view');
        } else {
          setResumable(loadLocal());
        }
      })
      .catch(() => setResumable(loadLocal()));
  }, []);

  useEffect(() => { if (computed && !hosted) saveLocal(computed, meta); }, [computed, meta, hosted]);

  const updateProject = useCallback((updates) => setProject(prev => ({ ...prev, ...updates })), []);

  const resume = () => {
    const { project: p, meta: m } = fromCanonicalDocument(resumable);
    const c = recalc(p);
    setProject(c); setMeta(m); setComputed(c); setStep('view'); setResumable(null);
  };

  const handleSetupDone = (data) => {
    const startYear = new Date(data.startDate).getFullYear();
    const holidays = data.holidayPreset === 'us'
      ? Array.from({ length: 10 }, (_, k) => getUSFederalHolidays(startYear + k)).flat()
      : data.holidayPreset === 'ntxp'
        ? Array.from({ length: 10 }, (_, k) => getNtxpNonWorkDays(startYear + k)).flat()
        : data.holidays;
    updateProject({ ...data, holidays });
    setMeta(m => logChange(m, { type: 'project_setup', source: 'wizard', after: { name: data.name, startDate: data.startDate }, reason: 'Project initialized' }));
    setStep('requirements');
  };

  const handleRequirementsDone = (req) => {
    setMeta(m => {
      let next = { ...m, requirements: { ...req } };
      next = logChange(next, {
        type: req.status === 'uploaded' ? 'requirements_uploaded' : 'requirements_acknowledged_none',
        source: 'requirements gate', jevRating: 3,
        after: req.status === 'uploaded' ? req.documents.map(d => d.name) : req.acknowledgement,
        reason: req.status === 'uploaded' ? `${req.documents.length} requirement document(s); ${req.detected.length} module signals` : 'User confirmed no project-specific requirements exist',
      });
      if (req.specText) next = recordInput(next, { type: 'requirements', name: 'Project requirements', text: req.specText });
      return next;
    });
    setStep('modules');
  };

  const handleModulesDone = (modules, scope) => {
    const confirmed = modules.filter(m => m.status === 'confirmed').map(m => m.id);
    const { wbs, dependencies, unplaced } = buildWbs(confirmed, { ...scope, startDate: project.startDate });
    updateProject({ wbs, dependencies });
    setMeta(m => {
      let next = logChange({ ...m, modules, scope }, { type: 'scope_profile', source: 'scope modules', jevRating: 3, after: scope, reason: `Tier ${scope.tier}, ${scope.sf} SF, ${scope.sector}${scope.constraints.length ? `, ${scope.constraints.join('/')}` : ''} — tier-dropped rows removed by user decision${scope.ownerProfile && scope.ownerProfile !== 'default' ? `; inspection notice profile "${scope.ownerProfile}" (default for this owner, LL-2026-10-14-03)` : ''}${scope.contingencyWd != null ? `; re-inspection contingency set to ${scope.contingencyWd} WD by user` : ''}` });
      next = logChange(next, {
        type: 'modules_confirmed', source: 'scope modules', jevRating: 3,
        after: confirmed.map(id => MODULE_BY_ID[id]?.label || id),
        reason: `${confirmed.length} module(s) confirmed; declined modules remove their backbone tasks by user decision${unplaced.length ? `; ${unplaced.length} rows appended at phase end (anchor missing)` : ''}`,
      });
      next = { ...next, trackers: { ...next.trackers, submittals: seedSubmittals(wbs) } };
      return next;
    });
    setStep('tasks');
  };

  const handleTasksDone = (wbs, dependencies) => {
    const before = new Map(project.wbs.flatMap(p => p.children).map(t => [t.id, t]));
    const edits = wbs.flatMap(p => p.children).filter(t => { const b = before.get(t.id); return !b || b.name !== t.name || b.duration !== t.duration || String(b.predecessors) !== String(t.predecessors); });
    updateProject({ wbs, dependencies });
    if (edits.length) setMeta(m => logChange(m, { type: 'task_edits', source: 'task editor', after: edits.slice(0, 20).map(t => `${t.id} ${t.name} ${t.duration}d`), reason: `${edits.length} task(s) edited manually` }));
    setStep('review');
  };

  const handleGenerate = () => {
    const result = recalc(project);
    setComputed(result);
    updateProject(result);
    setMeta(m => logChange(m, { type: 'schedule_generated', source: 'JEV builder + CPM', jevRating: 2, after: { end: result.endDate, workingDays: result.workingDuration }, reason: 'Original canonical schedule' }));
    setStep('view');
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.id === step);
    if (idx > 0) setStep(STEPS[idx - 1].id);
  };

  const handleProcurementImport = (phaseId, tasks) => {
    // Imported procurement events keep their source date through recalculation: past dates
    // are actuals, future dates are start-no-earlier-than constraints.
    const today = new Date().toISOString().slice(0, 10);
    const dated = tasks.map(t => (t.startDate
      ? (t.startDate <= today
        ? { ...t, actualStart: t.startDate, actualFinish: t.endDate || t.startDate }
        : { ...t, constraintStart: t.startDate })
      : t));
    setComputed(prev => {
      if (!prev) return prev;
      const next = { ...prev, wbs: prev.wbs.map(p => ({ ...p, children: p.id === phaseId ? [...p.children, ...dated] : [...p.children] })) };
      return recalc(next);
    });
    setMeta(m => logChange(m, { type: 'procurement_import', source: 'procurement panel', after: tasks.map(t => t.name), reason: `${tasks.length} procurement task(s) added` }));
  };

  const handleApplyProposals = (proposals, rawInput) => {
    setComputed(prev => {
      if (!prev) return prev;
      const next = { ...prev, wbs: prev.wbs.map(p => ({ ...p, children: p.children.map(t => ({ ...t })) })) };
      for (const p of proposals) {
        if (p.action === 'modify' && p.taskId) {
          for (const phase of next.wbs) {
            const task = phase.children.find(t => t.id === p.taskId);
            if (task && p.field) task[p.field] = p.newValue;
          }
        }
        if (p.action === 'add' && p.phase) {
          const phase = next.wbs.find(ph => ph.phaseKey === p.phase || ph.name.toLowerCase().includes(p.phase));
          if (phase) {
            const nums = phase.children.map(t => Number(t.id.split('.').pop()) || 0);
            const id = `${phase.id}.${Math.max(0, ...nums) + 1}`;
            const last = phase.children[phase.children.length - 1];
            phase.children.push({
              id, type: 'task', name: p.taskName || 'New Task', wbsCode: id, duration: p.duration || 3, durationUnit: 'days',
              trade: p.trade || 'General', category: p.category || 'activity', sub: 'Added from Inputs',
              predecessors: last ? [last.id] : [], successors: [], isMilestone: false, isCritical: false,
              notes: p.reason || '', children: [], source: 'input',
            });
            if (last) next.dependencies = [...(next.dependencies || []), { from: last.id, to: id, type: 'FS', lag: 0, lagUnit: 'days' }];
          }
        }
        if (p.action === 'complete' && p.taskId) {
          for (const phase of next.wbs) {
            const task = phase.children.find(t => t.id === p.taskId);
            if (task) { task.percentComplete = 100; task.actualFinish = task.actualFinish || p.date || null; }
          }
        }
      }
      return recalc(next);
    });
    setMeta(m => {
      let next = rawInput ? recordInput(m, rawInput) : m;
      for (const p of proposals) {
        // Date references and notes carry no task to change: record them as logged, not applied.
        if (p.action === 'date_update' || p.action === 'note') {
          next = logChange(next, {
            type: 'input_logged', source: rawInput?.type || 'input panel', actor: 'user',
            after: p.date || null, reason: `Logged only — no schedule change: ${p.reason}`, jevRating: 1,
          });
          continue;
        }
        next = logChange(next, {
          type: `input_${p.action}`, source: rawInput?.type || 'input panel', actor: p.isCriticalPath ? 'user (critical path override)' : 'user',
          target: p.taskId || p.taskName, before: p.oldValue, after: p.newValue ?? p.taskName, reason: p.reason,
          jevRating: p.isCriticalPath ? 4 : p.severity === 'medium' ? 3 : 2,
        });
      }
      return next;
    });
  };

  const handleMemory = (texts) => setMeta(m => texts.reduce((acc, t) => addMemory(acc, t), m));

  const handleApplySync = (items, bundle) => {
    const { project: p, meta: m } = applySyncItems(computed, meta, items);
    const c = recalc(p);
    setComputed(c);
    const withBackup = bundle.codaBackup ? recordCodaBackup(m, bundle.codaBackup) : m;
    setMeta(recordInput(withBackup, { type: 'sync_bundle', name: `Sync ${bundle.window?.from?.slice(0, 10)} → ${bundle.window?.to?.slice(0, 10)}`, text: JSON.stringify(bundle.sources || []) }));
  };

  const handleConfirmOptimization = (entry) => setMeta(m => addOptimizationEntry(m, entry));
  const handleCoda = (coda) => setMeta(m => updateCoda(m, coda));
  const handleLinks = (links) => setMeta(m => logChange({ ...m, links }, { type: 'links_updated', source: 'environment', after: links, reason: 'Canonical sync targets updated' }));

  const handleNewProject = () => {
    setProject(buildInitialProject());
    setMeta(emptyMeta());
    setComputed(null);
    setHosted(false);
    setStep('setup');
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <>
      <header className="header">
        <h1><span>BidForge</span> Schedules</h1>
        <div className="header-actions">
          {resumable && step === 'setup' && (
            <button className="btn btn-primary btn-sm" onClick={resume}>Resume {resumable.project?.name} (v{resumable.version})</button>
          )}
          {step !== 'setup' && !hosted && (
            <button className="btn btn-secondary btn-sm" onClick={handleNewProject}>New Project</button>
          )}
        </div>
      </header>
      <div className={`layout ${hosted ? 'hosted' : ''}`}>
        {!hosted && (
          <aside className="sidebar">
            <div className="step-indicator">
              {STEPS.map((s, i) => (
                <div key={s.id} className={`step-item ${s.id === step ? 'active' : ''} ${i < stepIndex ? 'completed' : ''}`}>
                  <div className="step-num">{i < stepIndex ? '✓' : i + 1}</div>
                  {s.label}
                </div>
              ))}
            </div>
            {project.name && (
              <div style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <div><strong>Project:</strong> {project.name}</div>
                <div><strong>Start:</strong> {project.startDate}</div>
                <div><strong>Requirements:</strong> {meta.requirements.status}</div>
                <div><strong>Modules:</strong> {meta.modules.filter(m => m.status === 'confirmed').length} confirmed</div>
                <div><strong>Canonical:</strong> v{meta.version}</div>
              </div>
            )}
          </aside>
        )}
        <main className="main">
          {step === 'setup' && <ProjectSetup project={project} onDone={handleSetupDone} />}
          {step === 'requirements' && <RequirementsGate requirements={meta.requirements} onDone={handleRequirementsDone} onBack={handleBack} />}
          {step === 'modules' && (
            <ModuleSelection detected={meta.requirements.detected || []} initial={meta.modules} initialScope={meta.scope} requirementsStatus={meta.requirements.status} projectName={project.name} onDone={handleModulesDone} onBack={handleBack} />
          )}
          {step === 'tasks' && <TaskEditor wbs={project.wbs} dependencies={project.dependencies} onDone={handleTasksDone} onBack={handleBack} />}
          {step === 'review' && <ReviewGenerate project={project} onGenerate={handleGenerate} onBack={handleBack} />}
          {step === 'view' && computed && (
            <ScheduleViewer
              project={computed}
              meta={meta}
              hosted={hosted}
              onProcurementImport={handleProcurementImport}
              onApplyProposals={handleApplyProposals}
              onMemory={handleMemory}
              onApplySync={handleApplySync}
              onConfirmOptimization={handleConfirmOptimization}
              onLinks={handleLinks}
              onCoda={handleCoda}
            />
          )}
        </main>
      </div>
    </>
  );
}
