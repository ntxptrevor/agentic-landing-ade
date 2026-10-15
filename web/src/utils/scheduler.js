import {
  parseDate, toISODate, formatDate, isWorkingDay,
  addWorkingDays, subtractWorkingDays, shiftWorkingDays, workingDaysBetween, calendarDaysBetween,
} from './dateUtils.js';

const DEFAULT_WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DATE_FIELDS = ['actualStart', 'actualFinish', 'constraintStart', 'contractDate'];
const MAX_LAG = 2000; // working days; anything larger is a data error, not a lag

// Critical-path schedule. Mutates the tasks in project.wbs in place (legacy contract) and
// returns { ...project, endDate, workingDuration, calendarDuration, criticalPathDuration, wbs,
// warnings[] } plus { cycles: [[ids]], error: 'dependency_cycle' } when the logic loops.
//
// Council audit #3 fixes: dates are normalized on input and unparseable ones ignored with a
// warning (A-01); dependency cycles are detected — tasks in a cycle keep their previous dates
// and are flagged inCycle (A-16/F-02); negative lags are honored in both passes but never
// before the project start (A-15); actualFinish without actualStart derives the start (A-17);
// adjacency is indexed once per run (A-27/F-13).
export function calculateSchedule(project, opts = {}) {
  const { startDate, wbs = [] } = project;
  const warnings = [];
  const warn = (code, message, extra = {}) => warnings.push({ code, message, ...extra });

  let workingDays = project.workingDays;
  if (!Array.isArray(workingDays) || !workingDays.some(d => DEFAULT_WORKING_DAYS.includes(d) || d === 'Sat' || d === 'Sun')) {
    warn('working_days', 'project.workingDays is empty or invalid; using Mon–Fri');
    workingDays = DEFAULT_WORKING_DAYS;
  }
  const holidays = Array.isArray(project.holidays) || project.holidays instanceof Set ? project.holidays : [];

  let projStart = parseDate(startDate);
  if (!projStart) {
    const now = new Date();
    projStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    warn('start_date', `Project start ${JSON.stringify(startDate ?? null)} is not a date; using today (${formatDate(projStart)})`);
  }

  const allTasks = flattenTasks(wbs);
  const taskMap = new Map();
  for (const t of allTasks) if (t && t.id != null && !taskMap.has(t.id)) taskMap.set(t.id, t);

  // ---- normalize inputs once --------------------------------------------------------
  const dates = new Map(); // id -> { actualStart, actualFinish, constraintStart, contractDate } as Date|null
  const dur = new Map();
  for (const t of allTasks) {
    if (t.type === 'phase') continue;
    const nd = {};
    for (const f of DATE_FIELDS) {
      const v = t[f];
      if (v == null || v === '') { nd[f] = null; continue; }
      const iso = toISODate(v);
      if (iso) { if (iso !== v) t[f] = iso; nd[f] = parseDate(iso); } else {
        nd[f] = null;
        warn('invalid_date', `Task ${t.id} ${f} ${JSON.stringify(v)} is not a recognizable date; ignored`, { taskId: t.id, field: f, value: v });
      }
    }
    if (nd.actualStart && nd.actualFinish && nd.actualFinish < nd.actualStart) {
      warn('actual_finish_before_start', `Task ${t.id} actualFinish ${formatDate(nd.actualFinish)} is before actualStart ${formatDate(nd.actualStart)}; using actualStart for both`, { taskId: t.id });
      nd.actualFinish = nd.actualStart;
      nd.actualsConflict = true;
    }
    dates.set(t.id, nd);
    let d = Number(t.duration);
    if (!Number.isFinite(d) || d < 0) {
      if (t.duration != null) warn('invalid_duration', `Task ${t.id} duration ${JSON.stringify(t.duration)} is invalid; using 0`, { taskId: t.id });
      d = 0;
    }
    dur.set(t.id, Math.ceil(d));
  }

  // ---- adjacency, built once ----------------------------------------------------------
  const byPair = new Map();
  for (const d of project.dependencies || []) {
    if (!d) continue;
    const k = pairKey(d.from, d.to);
    const list = byPair.get(k);
    if (list) list.push(d); else byPair.set(k, [d]);
  }
  const NO_DEP = [undefined];
  const preds = new Map();
  const succs = new Map();
  for (const t of allTasks) succs.set(t.id, []);
  for (const t of allTasks) {
    const ps = [];
    if (Array.isArray(t.predecessors)) {
      const seen = new Set();
      for (const pid of t.predecessors) {
        if (seen.has(pid) || !taskMap.has(pid)) continue;
        seen.add(pid);
        ps.push(pid);
        succs.get(pid).push(t.id);
      }
    }
    preds.set(t.id, ps);
  }
  const lagOf = (dep, from, to) => {
    let lag = Number(dep?.lag) || 0;
    if (Math.abs(lag) > MAX_LAG) {
      warn('invalid_lag', `Link ${from}→${to} lag ${dep.lag} is out of range; using 0`, { from, to });
      lag = 0;
    }
    return Math.round(lag);
  };

  // ---- order + cycles (Tarjan SCC over predecessor edges: emits predecessors first) ----
  const { order, cycles } = sccOrder(allTasks, preds);
  const cycleOf = new Map();
  cycles.forEach((c, i) => c.forEach(id => cycleOf.set(id, i)));

  const shift = (date, n) => shiftWorkingDays(date, n, workingDays, holidays);
  const rollToWorking = (date) => {
    if (isWorkingDay(date, workingDays, holidays)) return date;
    return addWorkingDays(date, 1, workingDays, holidays);
  };

  const ES = new Map();
  const EF = new Map();
  const startOf = id => ES.get(id) ?? parseDate(taskMap.get(id)?.startDate);
  const endOf = id => EF.get(id) ?? parseDate(taskMap.get(id)?.endDate);

  // ---- forward pass -------------------------------------------------------------------
  for (const id of order) {
    const task = taskMap.get(id);
    if (task.type === 'phase') continue;
    const d = dur.get(id);
    const nd = dates.get(id);
    let start;
    let end;

    if (cycleOf.has(id)) {
      // A task inside a dependency loop has no valid early date: keep what it had.
      task.inCycle = true;
      const ps = parseDate(task.startDate);
      const pe = parseDate(task.endDate);
      if (ps && pe && pe >= ps) { start = ps; end = pe; } else {
        start = rollToWorking(new Date(projStart));
        end = d > 0 ? addWorkingDays(start, d - 1, workingDays, holidays) : start;
      }
    } else {
      if (task.inCycle) delete task.inCycle;
      let earlyStart = projStart;
      for (const predId of preds.get(id)) {
        const predEnd = endOf(predId);
        if (!predEnd) continue;
        const predStart = startOf(predId) || predEnd;
        for (const dep of byPair.get(pairKey(predId, id)) || NO_DEP) {
          const lag = lagOf(dep, predId, id);
          const type = dep?.type || 'FS';
          let candidateStart;
          if (type === 'SS') {
            candidateStart = shift(predStart, lag);
          } else if (type === 'FF') {
            candidateStart = subtractWorkingDays(shift(predEnd, lag), Math.max(d - 1, 0), workingDays, holidays);
          } else if (type === 'SF') {
            candidateStart = subtractWorkingDays(shift(predStart, lag), Math.max(d - 1, 0), workingDays, holidays);
          } else {
            // FS: the working day after the predecessor finishes, plus lag (negative = lead).
            candidateStart = shift(predEnd, 1 + lag);
          }
          if (candidateStart > earlyStart) earlyStart = candidateStart;
        }
      }
      // Start-no-earlier-than from a confirmed date (JobTread edit, approved milestone move)
      if (nd.constraintStart && nd.constraintStart > earlyStart) earlyStart = nd.constraintStart;
      earlyStart = rollToWorking(new Date(earlyStart));

      const spanEnd = s => (d > 0 ? addWorkingDays(s, d - 1, workingDays, holidays) : new Date(s));
      // Recorded actuals always win over computed dates.
      if (nd.actualStart) {
        start = nd.actualStart;
        end = nd.actualFinish || spanEnd(start);
      } else if (nd.actualFinish) {
        end = nd.actualFinish;
        start = d > 1 ? subtractWorkingDays(end, d - 1, workingDays, holidays) : new Date(end);
      } else {
        start = earlyStart;
        end = spanEnd(start);
      }
    }

    ES.set(id, start);
    EF.set(id, end);
    task.startDate = formatDate(start);
    task.endDate = formatDate(end);
    if (nd.contractDate) task.milestoneVariance = calendarDaysBetween(nd.contractDate, end);
  }

  // ---- phase roll-up ------------------------------------------------------------------
  for (const phase of wbs) {
    const children = phase.children || [];
    if (children.length === 0) continue;
    let lo = null;
    let hi = null;
    for (const c of children) {
      const s = ES.get(c.id) ?? parseDate(c.startDate);
      const e = EF.get(c.id) ?? parseDate(c.endDate);
      if (s && (!lo || s < lo)) lo = s;
      if (e && (!hi || e > hi)) hi = e;
    }
    if (lo) phase.startDate = formatDate(lo);
    if (hi) phase.endDate = formatDate(hi);
  }

  // ---- backward pass ------------------------------------------------------------------
  let projectEnd = null;
  for (const t of allTasks) {
    const e = EF.get(t.id) ?? parseDate(t.endDate);
    if (e && (!projectEnd || e > projectEnd)) projectEnd = e;
  }
  if (!projectEnd) projectEnd = new Date(projStart);

  const LS = new Map();
  const LF = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const task = taskMap.get(id);
    if (task.type === 'phase') continue;
    const d = dur.get(id);
    const myCycle = cycleOf.get(id);
    let lateFinish = projectEnd;
    for (const succId of succs.get(id)) {
      const lsS = LS.get(succId);
      if (!lsS) continue; // phase rows (or tasks outside this run) carry no late dates
      if (myCycle !== undefined && cycleOf.get(succId) === myCycle) continue;
      const lfS = LF.get(succId);
      for (const dep of byPair.get(pairKey(id, succId)) || NO_DEP) {
        const lag = lagOf(dep, id, succId);
        const type = dep?.type || 'FS';
        let candidateFinish;
        if (type === 'SS') candidateFinish = shift(lsS, d - 1 - lag);
        else if (type === 'FF') candidateFinish = shift(lfS, -lag);
        else if (type === 'SF') candidateFinish = shift(lfS, d - 1 - lag);
        else candidateFinish = shift(lsS, -(1 + lag)); // FS
        if (candidateFinish < lateFinish) lateFinish = candidateFinish;
      }
    }
    const lateStart = subtractWorkingDays(lateFinish, d - 1, workingDays, holidays);
    LF.set(id, lateFinish);
    LS.set(id, lateStart);
    task._lateFinish = lateFinish;
    task._lateStart = lateStart;
    task.float = workingDaysBetween(ES.get(id), lateStart, workingDays, holidays);
    task.isCritical = task.float === 0;
  }

  // ---- summary ------------------------------------------------------------------------
  const workDuration = workingDaysBetween(projStart, projectEnd, workingDays, holidays)
    + (isWorkingDay(projStart, workingDays, holidays) ? 1 : 0);
  const calDuration = calendarDaysBetween(projStart, projectEnd);
  let cLo = null;
  let cHi = null;
  for (const t of allTasks) {
    if (!t.isCritical || t.type === 'phase') continue;
    const s = ES.get(t.id) ?? parseDate(t.startDate);
    const e = EF.get(t.id) ?? parseDate(t.endDate);
    if (s && (!cLo || s < cLo)) cLo = s;
    if (e && (!cHi || e > cHi)) cHi = e;
  }
  const criticalDuration = cLo && cHi ? workingDaysBetween(cLo, cHi, workingDays, holidays) + 1 : 0;

  // eslint-disable-next-line no-unused-vars
  const { cycles: _c, error: _e, warnings: _w, ...rest } = project;
  const result = {
    ...rest,
    endDate: formatDate(projectEnd),
    workingDuration: workDuration,
    calendarDuration: calDuration,
    criticalPathDuration: criticalDuration,
    wbs,
    warnings,
  };
  if (cycles.length) {
    result.cycles = cycles;
    result.error = 'dependency_cycle';
    warnings.push({ code: 'dependency_cycle', message: `Dependency loop: ${cycles.map(c => c.join(' → ')).join('; ')} — those tasks keep their previous dates`, cycles });
  }
  if (opts.onWarning) for (const w of warnings) opts.onWarning(w);
  return result;
}

const pairKey = (from, to) => `${from}\u0000${to}`;

function flattenTasks(wbs) {
  const tasks = [];
  for (const phase of wbs || []) {
    if (!phase) continue;
    tasks.push(phase);
    for (const task of phase.children || []) {
      if (!task) continue;
      tasks.push(task);
      for (const subtask of task.children || []) if (subtask) tasks.push(subtask);
    }
  }
  return tasks;
}

// Iterative Tarjan over "task -> its predecessors" edges. SCCs are emitted predecessors-first,
// so the concatenation is a valid scheduling order; SCCs of size > 1 (or self-loops) are cycles.
function sccOrder(tasks, preds) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const order = [];
  const cycles = [];
  let counter = 0;
  for (const root of tasks) {
    if (index.has(root.id)) continue;
    const work = [[root.id, 0]];
    index.set(root.id, counter); low.set(root.id, counter); counter++;
    stack.push(root.id); onStack.add(root.id);
    while (work.length) {
      const frame = work[work.length - 1];
      const [v, i] = frame;
      const ps = preds.get(v) || [];
      if (i < ps.length) {
        frame[1] = i + 1;
        const w = ps[i];
        if (!index.has(w)) {
          index.set(w, counter); low.set(w, counter); counter++;
          stack.push(w); onStack.add(w);
          work.push([w, 0]);
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v), index.get(w)));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(low.get(parent), low.get(v)));
      }
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        comp.reverse();
        if (comp.length > 1 || ps.includes(v)) cycles.push(comp);
        for (const c of comp) order.push(c);
      }
    }
  }
  return { order, cycles };
}

function predecessorGraph(tasks, dependencies) {
  const ids = new Set(tasks.map(t => t.id));
  const preds = new Map(tasks.map(t => [t.id, []]));
  const add = (from, to) => {
    if (!ids.has(from) || !ids.has(to)) return;
    const l = preds.get(to);
    if (!l.includes(from)) l.push(from);
  };
  for (const t of tasks) for (const p of t.predecessors || []) add(p, t.id);
  for (const d of dependencies || []) if (d) add(d.from, d.to);
  return preds;
}

// Every dependency loop among the tasks, as arrays of task ids (empty when acyclic).
// Reads task.predecessors plus, optionally, a dependencies[] list.
export function findDependencyCycles(tasks, dependencies) {
  const list = (tasks || []).filter(t => t && t.id != null);
  return sccOrder(list, predecessorGraph(list, dependencies)).cycles;
}

export function detectCircularDependencies(tasks, dependencies) {
  return findDependencyCycles(tasks, dependencies).length > 0;
}

// Would adding the link from -> to (to follows from) close a dependency loop?
export function wouldCreateCycle(project, from, to) {
  if (from == null || to == null) return false;
  if (from === to) return true;
  const tasks = flattenTasks(project?.wbs);
  const preds = predecessorGraph(tasks, project?.dependencies);
  // A loop exists iff `to` is already a (transitive) predecessor of `from`.
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const v = queue.pop();
    for (const p of preds.get(v) || []) {
      if (p === to) return true;
      if (!seen.has(p)) { seen.add(p); queue.push(p); }
    }
  }
  return false;
}

export { flattenTasks };
