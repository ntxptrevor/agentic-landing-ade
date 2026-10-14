import React, { useState, useCallback, useEffect } from 'react';
import ProjectSetup from './components/ProjectSetup.jsx';
import RequirementsGate from './components/RequirementsGate.jsx';
import ModuleSelection from './components/ModuleSelection.jsx';
import TaskEditor from './components/TaskEditor.jsx';
import ReviewGenerate from './components/ReviewGenerate.jsx';
import ScheduleViewer from './components/ScheduleViewer.jsx';
import LoginGate from './components/LoginGate.jsx';
import ProjectBar from './components/ProjectBar.jsx';
import ContextPanel from './components/ContextPanel.jsx';
import InstantSchedule from './components/InstantSchedule.jsx';
import { getSession, logout, listProjects, loadProject, saveProject, uploadFiles, liveUrl } from './utils/api.js';
import { moveTaskAfter } from './utils/reorder.js';
import { calculateSchedule } from './utils/scheduler.js';
import { getUSFederalHolidays, getNtxpNonWorkDays } from './utils/dateUtils.js';
import { buildWbs, seedSubmittals } from './utils/jevTree.js';
import { MODULE_BY_ID } from './data/jevTaxonomy.js';
import {
  emptyMeta, logChange, recordInput, addMemory, addOptimizationEntry, applySyncItems, updateCoda, recordCodaBackup, holdSyncItems, markPublished,
  saveLocal, loadLocal, fromCanonicalDocument, buildCanonicalDocument, slugify, sourceRef,
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
  // Cloud mode (schedule.ntxpllc.com): login, KB project list, server versions.
  const [server, setServer] = useState({ checked: false, available: false, authenticated: false });
  const [projects, setProjects] = useState([]);
  const [slug, setSlug] = useState('');
  const [serverVersion, setServerVersion] = useState(null);
  const [serverHash, setServerHash] = useState(null);
  const [activity, setActivity] = useState(null);
  const [showContext, setShowContext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const openProject = useCallback(async (s) => {
    setSlug(s);
    history.replaceState(null, '', s ? `?project=${encodeURIComponent(s)}` : location.pathname);
    if (!s) return;
    const data = await loadProject(s);
    if (!data) { setNotice({ kind: 'bad', text: `Could not load ${s}.` }); return; }
    setActivity(data.activity || null);
    setServerVersion(data.canonical ? (data.version ?? data.canonical.version ?? null) : null);
    setServerHash(data.hash || null);
    setSavedAt(data.canonical?.generatedAt || null);
    if (data.canonical?.schema === 'bidforge.canonical.v1') {
      const { project: p, meta: m } = fromCanonicalDocument(data.canonical);
      const c = recalc(p);
      setProject(c); setMeta(m); setComputed(c); setHosted(false); setStep('view'); setNotice(null);
    } else {
      const entry = projects.find(x => x.slug === s);
      setProject({ ...buildInitialProject(), name: entry?.name || s });
      setMeta(emptyMeta()); setComputed(null); setStep('instant');
      setNotice({ kind: 'warn', text: 'No canonical schedule yet for this project — build one from its files.' });
    }
  }, [projects]);

  // Server check first; without a server the app runs as before (hosted file or local storage).
  useEffect(() => {
    getSession().then(async sess => {
      setServer({ checked: true, ...sess });
      if (sess.available && sess.authenticated) {
        const list = await listProjects();
        setProjects(list);
        const q = new URLSearchParams(location.search).get('project');
        if (q) openProject(q);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!server.checked || server.available) return;
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
  }, [server.checked, server.available]);

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

  const handleApplySync = (items, bundle, held = []) => {
    const { project: p, meta: applied } = applySyncItems(computed, meta, items);
    const m = held.length ? holdSyncItems(applied, held) : applied;
    const c = recalc(p);
    setComputed(c);
    const withBackup = bundle.codaBackup ? recordCodaBackup(m, bundle.codaBackup) : m;
    setMeta(recordInput(withBackup, { type: 'sync_bundle', name: `Sync ${bundle.window?.from?.slice(0, 10)} → ${bundle.window?.to?.slice(0, 10)}`, text: JSON.stringify(bundle.sources || []) }));
  };

  const handleConfirmOptimization = (entry) => setMeta(m => addOptimizationEntry(m, entry));
  const handleCoda = (coda) => setMeta(m => updateCoda(m, coda));
  const handleLinks = (links) => setMeta(m => logChange({ ...m, links }, { type: 'links_updated', source: 'environment', after: links, reason: 'Canonical sync targets updated' }));

  // Drag a row to a new position: re-sequence it after the drop target and recompute dates.
  const handleReorder = (taskId, targetId) => {
    const r = moveTaskAfter(computed, taskId, targetId);
    if (!r) return;
    if (r.error) { setNotice({ kind: 'bad', text: r.error }); return; }
    if (r.task.protected && !window.confirm(`"${r.task.name}" is a protected NTXP backbone row. Move it after "${r.target.name}"?`)) return;
    const c = recalc(r.project);
    const moved = c.wbs.flatMap(p => p.children).find(t => t.id === taskId);
    setComputed(c);
    setMeta(m => logChange(m, {
      type: 'task_resequenced', source: 'live canonical schedule (row drag)', actor: server.user?.email || 'user',
      target: `${taskId} ${r.task.name}`, before: { start: r.before.start, finish: r.before.end, after: r.before.preds },
      after: { start: moved?.startDate, finish: moved?.endDate, after: targetId },
      reason: `Moved after ${targetId} ${r.target.name}: ${r.before.start} → ${moved?.startDate}`,
      jevRating: r.task.isMilestone || r.task.protected ? 4 : r.task.isCritical ? 3 : 2,
      sources: [sourceRef('live-edit', 'Row drag on the live canonical schedule', slug ? liveUrl(slug) : '')],
    }));
  };

  // Instant schedule from uploaded files (skill logic in the browser).
  const handleInstantBuild = async ({ name, number, status, startDate, modules, scope, imported, analysis, items, ackNone }) => {
    const s = slug || slugify(name);
    // A new project has no server version yet; never carry over the last opened project's base.
    if (!slug) { setServerVersion(null); setServerHash(null); setSavedAt(null); setActivity(null); }
    const startYear = new Date(startDate).getFullYear();
    const holidays = Array.from({ length: 10 }, (_, k) => getNtxpNonWorkDays(startYear + k)).flat();
    let wbs; let dependencies;
    if (imported) ({ wbs, dependencies } = imported);
    else ({ wbs, dependencies } = buildWbs(modules, { ...scope, startDate }));
    const base = { ...buildInitialProject(), name, startDate, holidays, holidayPreset: 'ntxp', wbs, dependencies };
    const c = recalc(base);
    // Files go to the project's server folder first so the changelog can link each source.
    let stored = [];
    if (server.available && server.authenticated) {
      for (const kind of [...new Set(items.map(i => i.kind))]) {
        stored = stored.concat(await uploadFiles(s, kind, items.filter(i => i.kind === kind).map(i => i.file)));
      }
    }
    const linkFor = n => stored.find(f => f.name === n)?.url || '';
    const today = new Date().toISOString().slice(0, 10);
    const sources = items.map(i => sourceRef(i.kind, i.name, linkFor(i.name), today));
    let m = { ...emptyMeta(), status, scope, links: { ...emptyMeta().links, jobNumber: number, liveUrl: server.available ? liveUrl(s) : '' } };
    m.requirements = ackNone
      ? { status: 'acknowledged_none', documents: [], specText: '', acknowledgement: { text: 'No project-specific schedule requirements exist', by: server.user?.email || 'user', at: new Date().toISOString() }, detected: analysis.modules }
      : { status: 'uploaded', documents: analysis.requirementsDocs.map(n => ({ name: n, type: 'project_manual', url: linkFor(n) })), specText: analysis.specText, detected: analysis.modules };
    m.modules = analysis.modules.map(x => ({ id: x.id, status: modules.includes(x.id) ? 'confirmed' : 'declined', evidence: `documents: ${x.hits.map(h => h.keyword).join(', ')}`, confirmedBy: 'user', at: new Date().toISOString() }))
      .concat(modules.filter(id => !analysis.modules.some(x => x.id === id)).map(id => ({ id, status: 'confirmed', evidence: 'user', confirmedBy: 'user', at: new Date().toISOString() })));
    m = logChange(m, { type: 'project_setup', source: 'instant schedule', reason: `Project initialized (${status === 'bid' ? 'pursuit' : 'awarded'})`, after: { name, number, startDate }, sources });
    m = logChange(m, { type: ackNone ? 'requirements_acknowledged_none' : 'requirements_uploaded', source: 'instant schedule', jevRating: 3, reason: ackNone ? 'User confirmed no project-specific requirements exist' : `${analysis.requirementsDocs.length} requirement document(s)`, sources: sources.filter(x => x.type === 'spec') });
    for (const i of items) if (i.text) m = recordInput(m, { type: i.kind, name: i.name, text: i.text.slice(0, 20000), url: linkFor(i.name) });
    if (analysis.leadItems.length) m = logChange(m, { type: 'lead_times_found', source: 'quotes', jevRating: 2, after: analysis.leadItems, reason: `${analysis.leadItems.length} lead time(s) read from quotes — tracked in procurement`, sources: sources.filter(x => x.type === 'quote') });
    m = logChange(m, {
      type: 'schedule_generated', source: imported ? `imported schedule ${imported.file}` : 'instant schedule (JEV builder + CPM)', jevRating: 2,
      after: { end: c.endDate, workingDays: c.workingDuration, modules }, reason: imported ? `Canonical started from uploaded schedule (${imported.taskCount} tasks)` : 'Original canonical schedule from uploaded files', sources,
    });
    m = { ...m, trackers: { ...m.trackers, submittals: seedSubmittals(c.wbs).map(sb => { const l = analysis.leadItems.find(x => sb.title.toLowerCase().includes(x.item.toLowerCase().split(' ')[0])); return l ? { ...sb, leadDays: l.days } : sb; }) } };
    setSlug(s);
    setProject(c); setMeta(m); setComputed(c); setHosted(false); setStep('view');
    setNotice({ kind: 'ok', text: server.available ? 'Instant schedule built — review it, then Save version to store it in the project folder.' : 'Instant schedule built (offline — saved in this browser).' });
  };

  // Save a version to the server. The server refuses it if someone saved a newer version
  // since this one was loaded (no forks): reload and reconcile instead of overwriting.
  const handleSave = async () => {
    if (!computed) return;
    setSaving(true);
    const s = slug || slugify(computed.name);
    const metaOut = markPublished({ ...meta, links: { ...meta.links, liveUrl: liveUrl(s) } });
    const doc = buildCanonicalDocument(computed, metaOut);
    const since = meta.changelog.filter(e => !savedAt || e.at > savedAt);
    const r = await saveProject({
      slug: s, name: computed.name, status: meta.status || 'bid', canonical: doc,
      baseVersion: serverVersion, baseHash: serverHash,
      reason: meta.changelog[meta.changelog.length - 1]?.reason || 'Saved from schedule.ntxpllc.com',
      sources: since.flatMap(e => e.sources || []).slice(-40),
    });
    setSaving(false);
    if (r.ok) {
      setServerVersion(r.version ?? doc.version); setServerHash(r.hash || null); setSlug(s); setSavedAt(doc.generatedAt);
      setMeta(metaOut);
      history.replaceState(null, '', `?project=${encodeURIComponent(s)}`);
      setProjects(await listProjects());
      setNotice({ kind: 'ok', text: `Saved v${r.version ?? doc.version} to ${doc.folder.path} — the next sync carries it to the knowledge base, Drive and JobTread.` });
    } else if (r.conflict) {
      setNotice({ kind: 'bad', text: r.currentVersion == null ? `Not saved: the server state for ${s} changed — reload it before saving.` : `Not saved: v${r.currentVersion} was saved by someone else after you opened ${serverVersion == null ? 'a new schedule with this name' : `v${serverVersion}`}. Reload the latest version and re-apply your change — schedules never fork.`, action: { label: 'Load latest', run: () => openProject(s) } });
    } else {
      setNotice({ kind: 'bad', text: r.error });
    }
  };

  const handleLogout = async () => { await logout(); location.href = location.pathname; };

  const handleNewProject = () => {
    setProject(buildInitialProject());
    setMeta(emptyMeta());
    setComputed(null);
    setHosted(false);
    setStep('setup');
  };

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const cloud = server.available && server.authenticated;
  const dirty = cloud && computed && (serverVersion == null || meta.version !== serverVersion);

  if (server.checked && server.available && !server.authenticated) {
    return <LoginGate session={server} onAuthenticated={() => location.reload()} />;
  }

  return (
    <>
      <header className="header">
        <h1><span>BidForge</span> Schedules</h1>
        {cloud && (
          <ProjectBar projects={projects} currentSlug={slug} onSelect={openProject}
            onInstant={() => { setSlug(''); setStep('instant'); setNotice(null); history.replaceState(null, '', location.pathname); }}
            onSave={computed ? handleSave : null} saving={saving} dirty={dirty} serverVersion={serverVersion}
            user={server.user} onLogout={handleLogout} />
        )}
        <div className="header-actions">
          {resumable && step === 'setup' && (
            <button className="btn btn-primary btn-sm" onClick={resume}>Resume {resumable.project?.name} (v{resumable.version})</button>
          )}
          {!cloud && step === 'setup' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setStep('instant')}>Instant schedule</button>
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
          {notice && (
            <div className={`notice notice-${notice.kind}`} role="status">
              {notice.text}
              {notice.action && <button className="btn btn-sm btn-secondary" onClick={notice.action.run}>{notice.action.label}</button>}
              <button className="btn btn-sm btn-secondary" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
            </div>
          )}
          {step === 'instant' && <InstantSchedule initialName={project.name} onBuild={handleInstantBuild} onCancel={computed ? () => setStep('view') : null} />}
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
              onReorder={hosted ? null : handleReorder}
              onOac={() => setMeta(m => logChange({ ...m, sync: { ...m.sync, lastOacAt: new Date().toISOString() } }, { type: 'oac_report', source: 'export', reason: `OAC schedule section generated from v${m.version}`, jevRating: 1 }))}
            />
          )}
        </main>
        {cloud && step === 'view' && activity && showContext && <ContextPanel activity={activity} onClose={() => setShowContext(false)} />}
      </div>
    </>
  );
}
