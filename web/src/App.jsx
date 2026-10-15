import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { moveTaskAfter, moveTaskBefore } from './utils/reorder.js';
import { calculateSchedule } from './utils/scheduler.js';
import { getUSFederalHolidays, getNtxpNonWorkDays } from './utils/dateUtils.js';
import { buildWbs, seedSubmittals } from './utils/jevTree.js';
import { MODULE_BY_ID } from './data/jevTaxonomy.js';
import { buildSourceRef } from './utils/procurementAudit.js';
import {
  emptyMeta, logChange, logActivity, recordInput, addMemory, addOptimizationEntry, applySyncItems, updateCoda, recordCodaBackup, holdSyncItems, markSiteSaved,
  acknowledgeHeld, dismissHeld, openHeld, markAwarded, keepAwarded, changesSinceSave, summarizeChanges,
  saveLocal, loadLocal, fromCanonicalDocument, buildCanonicalDocument, slugify, sourceRef,
} from './utils/canonical.js';

// SyncModal dispatches held-item actions (acknowledge / apply / dismiss) on this event.
const HELD_EVENT = 'bidforge:held';
const todayIso = () => new Date().toISOString().slice(0, 10);
const taskCount = p => (p?.wbs || []).reduce((n, ph) => n + (ph.children || []).length, 0);

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
    setSavedAt(data.canonical?.generatedAt || data.canonical?.meta?.savedAt || null);
    if (data.canonical?.schema === 'bidforge.canonical.v1') {
      let loaded;
      try {
        loaded = fromCanonicalDocument(data.canonical);
      } catch (err) {
        // Never open an empty v0 in place of a stored canonical (a save would overwrite it).
        setProject({ ...buildInitialProject(), name: data.project?.name || s }); setMeta(emptyMeta()); setComputed(null); setStep('view');
        setNotice({ kind: 'bad', text: `${s}: ${err.message}` });
        return;
      }
      const { project: p, meta: m } = loaded;
      m.slug = s;
      if (data.project?.status === 'active') m.status = keepAwarded(m.status, 'active');
      const c = recalc(p);
      setProject(c); setMeta(m); setComputed(c); setHosted(false); setStep('view'); setNotice(null);
    } else {
      const entry = projects.find(x => x.slug === s);
      setProject({ ...buildInitialProject(), name: entry?.name || s });
      setMeta({ ...emptyMeta(), slug: s, status: keepAwarded('bid', entry?.status, data.project?.status) }); setComputed(null); setStep('instant');
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
          try {
            const { project: p, meta: m } = fromCanonicalDocument(doc);
            const c = recalc(p);
            setProject(c); setMeta(m); setComputed(c); setHosted(true); setStep('view');
          } catch (err) {
            setNotice({ kind: 'bad', text: `Hosted canonical.json: ${err.message}` });
            setResumable(loadLocal());
          }
        } else {
          setResumable(loadLocal());
        }
      })
      .catch(() => setResumable(loadLocal()));
  }, [server.checked, server.available]);

  // Browser backup: debounced (1.5 s), skipped when unchanged; a full quota is reported once.
  const quotaWarned = useRef(false);
  useEffect(() => {
    if (!computed || hosted) return undefined;
    const t = setTimeout(() => {
      const r = saveLocal(computed, meta, slug);
      if (!r.ok && r.quota && !quotaWarned.current) {
        quotaWarned.current = true;
        setNotice({ kind: 'warn', text: 'Browser storage is full — this schedule is no longer backed up in this browser. Save a version or export the Canonical JSON to keep your changes.' });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [computed, meta, hosted, slug]);

  const updateProject = useCallback((updates) => setProject(prev => ({ ...prev, ...updates })), []);

  const resume = () => {
    let loaded;
    try { loaded = fromCanonicalDocument(resumable); } catch (err) { setNotice({ kind: 'bad', text: err.message }); setResumable(null); return; }
    const { project: p, meta: m } = loaded;
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
    setMeta(m => logChange(m, { type: 'project_setup', source: 'wizard', after: { name: data.name, startDate: data.startDate }, reason: 'Project initialized', sources: [sourceRef('wizard', 'Project setup wizard')] }));
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
        sources: req.status === 'uploaded' && req.documents.length
          ? req.documents.map(d => sourceRef('spec', d.name, d.url || ''))
          : [sourceRef('user', 'Requirements gate acknowledgement')],
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
      const reqSources = (m.requirements.documents || []).map(d => sourceRef('spec', d.name, d.url || ''));
      const modSources = [sourceRef('wizard', 'Scope modules step'), ...reqSources];
      let next = logChange({ ...m, modules, scope }, { type: 'scope_profile', source: 'scope modules', jevRating: 3, after: scope, sources: modSources, reason: `Tier ${scope.tier}, ${scope.sf} SF, ${scope.sector}${scope.constraints.length ? `, ${scope.constraints.join('/')}` : ''} — tier-dropped rows removed by user decision${scope.ownerProfile && scope.ownerProfile !== 'default' ? `; inspection notice profile "${scope.ownerProfile}" (default for this owner, LL-2026-10-14-03)` : ''}${scope.contingencyWd != null ? `; re-inspection contingency set to ${scope.contingencyWd} WD by user` : ''}` });
      next = logChange(next, {
        type: 'modules_confirmed', source: 'scope modules', jevRating: 3, sources: modSources,
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
    if (edits.length) setMeta(m => logChange(m, { type: 'task_edits', source: 'task editor', target: edits.slice(0, 20).map(t => t.id).join(', '), after: edits.slice(0, 20).map(t => `${t.id} ${t.name} ${t.duration}d`), reason: `${edits.length} task(s) edited manually`, sources: [sourceRef('task-editor', 'Define Tasks step (manual edits)')] }));
    setStep('review');
  };

  const handleGenerate = () => {
    const result = recalc(project);
    setComputed(result);
    updateProject(result);
    setMeta(m => logChange(m, { type: 'schedule_generated', source: 'JEV builder + CPM', jevRating: 2, after: { end: result.endDate, workingDays: result.workingDuration }, reason: 'Original canonical schedule', sources: [sourceRef('app', 'JEV builder + CPM (Review & Generate)')] }));
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
    setMeta(m => logChange(m, {
      type: 'procurement_import', source: 'procurement panel', target: phaseId, after: tasks.map(t => t.name), reason: `${tasks.length} procurement task(s) added`,
      sources: [sourceRef('procurement', 'Procurement panel import'), ...tasks.map(t => {
        const ref = buildSourceRef(t);
        return sourceRef('procurement', `${t.name}${ref ? ` (${ref})` : ''}`, t.driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(t.driveFileId)}/view` : '', t.startDate || todayIso());
      })].slice(0, 40),
    }));
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
      // Conversation / pasted input: {type:'conversation', title, url (if provided), date}.
      const inputSources = [sourceRef('conversation', rawInput ? `${rawInput.name || 'Input'}${rawInput.type ? ` (${rawInput.type})` : ''}` : 'Inputs tab', rawInput?.url || '', rawInput?.date || todayIso())];
      for (const p of proposals) {
        // Date references and notes carry no task to change: record them as logged, not applied.
        if (p.action === 'date_update' || p.action === 'note') {
          next = logChange(next, {
            type: 'input_logged', source: rawInput?.type || 'input panel', actor: 'user',
            after: p.date || null, reason: `Logged only — no schedule change: ${p.reason}`, jevRating: 1, sources: inputSources, noVersion: true,
          });
          continue;
        }
        next = logChange(next, {
          type: `input_${p.action}`, source: rawInput?.type || 'input panel', actor: p.isCriticalPath ? 'user (critical path override)' : 'user',
          target: p.taskId || p.taskName, before: p.oldValue, after: p.newValue ?? p.taskName, reason: p.reason,
          jevRating: p.isCriticalPath ? 4 : p.severity === 'medium' ? 3 : 2, sources: inputSources,
        });
      }
      return next;
    });
  };

  const handleMemory = (texts) => setMeta(m => texts.reduce((acc, t) => addMemory(acc, t, 'project', sourceRef('conversation', 'Memory directive (Inputs tab)', '', todayIso())), m));

  const handleApplySync = (items, bundle = {}, held = []) => {
    if (!computed) return;
    const { project: p, meta: applied, report } = applySyncItems(computed, meta, items);
    let m = held.length ? holdSyncItems(applied, held) : applied;
    const c = recalc(p);
    setComputed(c);
    const bundleSources = (bundle.sources || []).map(x => sourceRef(x.kind || 'sync', x.title || x.id, x.link || '', String(x.date || '').slice(0, 10) || undefined));
    if (bundle.codaBackup) m = recordCodaBackup(m, bundle.codaBackup, bundleSources.slice(0, 5));
    if (!bundle.held) m = recordInput(m, { type: 'sync_bundle', name: `Sync ${bundle.window?.from?.slice(0, 10)} → ${bundle.window?.to?.slice(0, 10)}`, text: JSON.stringify(bundle.sources || []) });
    setMeta(m);
    const parts = [`${report.applied} change(s) applied`];
    if (report.tracked) parts.push(`${report.tracked} milestone move(s) tracked, not moved`);
    if (report.skipped) parts.push(`${report.skipped} skipped (task not found — see Changelog)`);
    if (report.duplicates) parts.push(`${report.duplicates} already applied (skipped)`);
    if (held.length) parts.push(`${held.length} held for acknowledgement`);
    setNotice({ kind: report.skipped ? 'warn' : 'ok', text: `Sync: ${parts.join(', ')}.` });
  };

  // Held sync items: acknowledge / apply / dismiss from the SYNC popup.
  useEffect(() => {
    const onHeld = (ev) => {
      const { action, ids = [], note = '' } = ev.detail || {};
      const by = server.user?.email || 'user';
      const src = [sourceRef('user', `${action} in SYNC by ${by}`, slug ? liveUrl(slug) : '')];
      if (action === 'acknowledge') setMeta(m => acknowledgeHeld(m, ids, { by, note, sources: src }));
      else if (action === 'dismiss') setMeta(m => dismissHeld(m, ids, { by, note, sources: src }));
      else if (action === 'apply') {
        const items = openHeld(meta).filter(x => ids.includes(x.id) && x.item)
          .map(x => ({ ...x.item, approved: true, sources: x.item.sources || x.sources }));
        if (items.length) handleApplySync(items, { held: true }, []);
      }
    };
    window.addEventListener(HELD_EVENT, onHeld);
    return () => window.removeEventListener(HELD_EVENT, onHeld);
  });

  const handleConfirmOptimization = (entry) => setMeta(m => addOptimizationEntry(m, entry));
  const handleCoda = (coda) => setMeta(m => updateCoda(m, coda));
  const handleLinks = (links) => setMeta(m => logChange({ ...m, links }, { type: 'links_updated', source: 'environment', after: links, reason: 'Canonical sync targets updated', sources: [sourceRef('environment', 'Environment tab (sync targets)')] }));

  // Award: status → active; versions route to !Active Projects/<name>/06 - Schedule (logged with source).
  const handleAward = () => {
    if (!computed || meta.status === 'active') return;
    if (!window.confirm(`Mark "${computed.name}" as awarded? Its schedule versions will route to the project folder.`)) return;
    const by = server.user?.email || 'user';
    setMeta(m => markAwarded(m, { name: computed.name, by, url: slug ? liveUrl(slug) : '' }));
    setNotice({ kind: 'ok', text: 'Marked awarded — Save version to record it in the project folder.' });
  };

  // Drag a row to a new position: re-sequence it after the drop target and recompute dates.
  // Drag a row onto another row (after it) or onto a phase / sub-phase header (first row): the
  // engine re-sequences it, keeps link types and lags, never drops constraints or actuals, refuses
  // loops, and returns every task whose dates moved so the changelog lists them all.
  const handleReorder = (taskId, targetId, mode = 'after') => {
    const run = (opts = {}) => (mode === 'before' ? moveTaskBefore : moveTaskAfter)(computed, taskId, targetId, opts);
    let r = run();
    if (!r) return;
    if (r.error === 'constrained' || r.error === 'has_actuals') {
      if (!window.confirm(`${r.message}\n\nMove it anyway? The change is logged as a user decision and rated for review.`)) return;
      r = run({ allowConstrained: true, allowActuals: true });
    }
    if (r.error) { setNotice({ kind: 'bad', text: r.message || r.error }); return; }
    if (r.task.protected && !window.confirm(`"${r.task.name}" is a protected NTXP backbone row. Move it ${mode === 'before' ? 'to the top of' : 'after'} "${r.target.name}"?`)) return;
    const c = r.project;
    const moved = c.wbs.flatMap(p => p.children).find(t => t.id === taskId);
    setComputed(c);
    const shifted = (r.changes || []).filter(x => x.id !== taskId);
    setMeta(m => logChange(m, {
      type: 'task_resequenced', source: 'live canonical schedule (row drag)', actor: server.user?.email || 'user',
      target: `${taskId} ${r.task.name}`, before: { start: r.before.start, finish: r.before.end, after: r.before.preds, projectEnd: r.projectEndBefore },
      after: { start: moved?.startDate, finish: moved?.endDate, after: targetId, projectEnd: r.projectEndAfter, relinked: r.relinked, shifted: shifted.slice(0, 40) },
      reason: `Moved ${mode === 'before' ? 'to the top of' : 'after'} ${targetId} ${r.target.name}: ${r.before.start} → ${moved?.startDate}; ${shifted.length} other task(s) moved; finish ${r.projectEndBefore} → ${r.projectEndAfter}${(r.relinked || []).some(x => x.typeConflict) ? ' (link type conflict resolved to the successor\'s type)' : ''}`,
      jevRating: r.task.isMilestone || r.task.protected || r.projectEndAfter !== r.projectEndBefore ? 4 : r.task.isCritical ? 3 : 2,
      sources: [sourceRef('live-edit', 'Row drag on the live canonical schedule', slug ? liveUrl(slug) : '')],
    }));
  };

  // Instant schedule from uploaded files (skill logic in the browser).
  const handleInstantBuild = async ({ name, number, status: statusIn, startDate, modules, scope, imported, analysis, items, ackNone, existingSlug }) => {
    const s = existingSlug || slug || slugify(name);
    const entry = projects.find(x => x.slug === s);
    // An awarded project is never routed back to 'bid' by a rebuild.
    const status = keepAwarded(statusIn, entry?.status, s === slug ? meta.status : null);
    if (existingSlug && existingSlug !== slug) {
      // Rebuilding an existing KB project: its stored version is the base (the save adds the next version).
      const data = server.available && server.authenticated ? await loadProject(existingSlug) : null;
      setServerVersion(data?.canonical ? (data.version ?? data.canonical.version ?? null) : null);
      setServerHash(data?.hash || null); setSavedAt(data?.canonical?.generatedAt || null); setActivity(data?.activity || null);
    } else if (!slug) {
      // A new project has no server version yet; never carry over the last opened project's base.
      setServerVersion(null); setServerHash(null); setSavedAt(null); setActivity(null);
    }
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
    let m = { ...emptyMeta(), slug: s, status, scope, links: { ...emptyMeta().links, jobNumber: number || entry?.number || '', liveUrl: server.available ? liveUrl(s) : '' } };
    m.requirements = ackNone
      ? { status: 'acknowledged_none', documents: [], specText: '', acknowledgement: { text: 'No project-specific schedule requirements exist', by: server.user?.email || 'user', at: new Date().toISOString() }, detected: analysis.modules }
      : { status: 'uploaded', documents: analysis.requirementsDocs.map(n => ({ name: n, type: 'project_manual', url: linkFor(n) })), specText: analysis.specText, detected: analysis.modules };
    m.modules = analysis.modules.map(x => ({ id: x.id, status: modules.includes(x.id) ? 'confirmed' : 'declined', evidence: `documents: ${x.hits.map(h => h.keyword).join(', ')}`, confirmedBy: 'user', at: new Date().toISOString() }))
      .concat(modules.filter(id => !analysis.modules.some(x => x.id === id)).map(id => ({ id, status: 'confirmed', evidence: 'user', confirmedBy: 'user', at: new Date().toISOString() })));
    m = logChange(m, { type: 'project_setup', source: 'instant schedule', reason: `Project initialized (${status === 'bid' ? 'pursuit' : 'awarded'})`, after: { name, number, startDate }, sources });
    const specSources = sources.filter(x => x.type === 'spec' && analysis.requirementsDocs.includes(x.title));
    m = logChange(m, { type: ackNone ? 'requirements_acknowledged_none' : 'requirements_uploaded', source: 'instant schedule', jevRating: 3, reason: ackNone ? 'User confirmed no project-specific requirements exist' : `${analysis.requirementsDocs.length} requirement document(s)`, sources: ackNone || !specSources.length ? [sourceRef('user', `Requirements acknowledgement by ${server.user?.email || 'user'}`)] : specSources });
    for (const i of items) if (i.text) m = recordInput(m, { type: i.kind, name: i.name, text: i.text.slice(0, 20000), url: linkFor(i.name) });
    if (analysis.leadItems.length) m = logChange(m, { type: 'lead_times_found', source: 'quotes', jevRating: 2, after: analysis.leadItems, reason: `${analysis.leadItems.length} lead time(s) read from quotes — tracked in procurement`, sources: sources.filter(x => x.type === 'quote').length ? sources.filter(x => x.type === 'quote') : sources });
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
    if (!taskCount(computed)) { setNotice({ kind: 'bad', text: 'Not saved: the schedule has no activities — an empty canonical is never saved over a stored version.' }); return; }
    setSaving(true);
    const s = slug || meta.slug || slugify(computed.name);
    // A site save is not a KB publish: it records siteSavedVersion only (the agent publishes).
    const status = keepAwarded(meta.status, projects.find(x => x.slug === s)?.status);
    const metaOut = markSiteSaved({ ...meta, slug: s, status, links: { ...meta.links, liveUrl: liveUrl(s) } }, meta.version);
    const doc = buildCanonicalDocument(computed, metaOut, s);
    const { reason, sources } = summarizeChanges(changesSinceSave(meta, savedAt));
    const r = await saveProject({
      slug: s, name: computed.name, status, canonical: doc,
      baseVersion: serverVersion, baseHash: serverHash, reason, sources: sources.slice(0, 50),
    });
    setSaving(false);
    if (r.ok) {
      const v = r.version ?? doc.version;
      setServerVersion(v); setServerHash(r.hash || null); setSlug(s); setSavedAt(doc.generatedAt);
      // The server never lowers a version but may raise it (snapshots): follow it.
      setMeta(v !== metaOut.version ? markSiteSaved({ ...metaOut, version: v }, v) : metaOut);
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
  const readOnly = cloud && !!server.readOnly;
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
            onInstant={readOnly ? null : () => { setSlug(''); setStep('instant'); setNotice(null); history.replaceState(null, '', location.pathname); }}
            onSave={computed && !readOnly ? handleSave : null} saving={saving} dirty={dirty} serverVersion={serverVersion}
            status={meta.status} onAward={computed && slug ? handleAward : null}
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
          {step === 'instant' && <InstantSchedule initialName={project.name} projects={projects} currentSlug={slug} onBuild={handleInstantBuild} onCancel={computed ? () => setStep('view') : null} />}
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
              onOac={() => setMeta(m => logActivity({ ...m, sync: { ...m.sync, lastOacAt: new Date().toISOString() } }, { type: 'oac_report', source: 'export', reason: `OAC schedule section generated from v${m.version}`, jevRating: 1, sources: [sourceRef('export', `OAC schedule section v${m.version}`, slug ? liveUrl(slug) : '')] }))}
            />
          )}
        </main>
        {cloud && step === 'view' && activity && showContext && <ContextPanel activity={activity} onClose={() => setShowContext(false)} />}
      </div>
    </>
  );
}
