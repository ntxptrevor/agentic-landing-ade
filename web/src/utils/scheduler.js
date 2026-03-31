import { parseDate, addWorkingDays, workingDaysBetween, calendarDaysBetween, formatDate, isWorkingDay } from './dateUtils.js';

export function calculateSchedule(project) {
  const { startDate, workingDays, holidays, wbs } = project;
  const allTasks = flattenTasks(wbs);
  const taskMap = new Map(allTasks.map(t => [t.id, t]));

  // Topological sort to resolve dependencies
  const sorted = topologicalSort(allTasks);

  // Forward pass
  const projStart = parseDate(startDate);
  for (const task of sorted) {
    if (task.type === 'phase') continue;

    let earlyStart = projStart;
    if (task.predecessors && task.predecessors.length > 0) {
      for (const predId of task.predecessors) {
        const dep = project.dependencies?.find(d => d.from === predId && d.to === task.id);
        const pred = taskMap.get(predId);
        if (!pred || !pred.endDate) continue;

        const predEnd = parseDate(pred.endDate);
        const lag = dep?.lag || 0;
        const type = dep?.type || 'FS';
        let candidateStart;

        if (type === 'FS') {
          candidateStart = addWorkingDays(predEnd, lag, workingDays, holidays);
        } else if (type === 'SS') {
          candidateStart = addWorkingDays(parseDate(pred.startDate), lag, workingDays, holidays);
        } else if (type === 'FF') {
          const predEndWithLag = addWorkingDays(predEnd, lag, workingDays, holidays);
          candidateStart = subtractWorkingDays(predEndWithLag, task.duration, workingDays, holidays);
        } else if (type === 'SF') {
          candidateStart = subtractWorkingDays(
            addWorkingDays(parseDate(pred.startDate), lag, workingDays, holidays),
            task.duration,
            workingDays,
            holidays
          );
        } else {
          candidateStart = addWorkingDays(predEnd, lag, workingDays, holidays);
        }

        if (candidateStart > earlyStart) {
          earlyStart = candidateStart;
        }
      }
    }

    // Make sure earlyStart lands on a working day
    while (!isWorkingDay(earlyStart, workingDays, holidays)) {
      earlyStart.setDate(earlyStart.getDate() + 1);
    }

    task.startDate = formatDate(earlyStart);
    task.endDate = formatDate(addWorkingDays(earlyStart, task.duration - 1, workingDays, holidays));
  }

  // Update phase dates
  for (const phase of wbs) {
    const children = phase.children || [];
    if (children.length === 0) continue;
    const starts = children.filter(c => c.startDate).map(c => parseDate(c.startDate));
    const ends = children.filter(c => c.endDate).map(c => parseDate(c.endDate));
    if (starts.length > 0) {
      phase.startDate = formatDate(new Date(Math.min(...starts)));
    }
    if (ends.length > 0) {
      phase.endDate = formatDate(new Date(Math.max(...ends)));
    }
  }

  // Backward pass
  const allEnds = allTasks.filter(t => t.endDate).map(t => parseDate(t.endDate));
  const projectEnd = new Date(Math.max(...allEnds));

  for (let i = sorted.length - 1; i >= 0; i--) {
    const task = sorted[i];
    if (task.type === 'phase') continue;

    const successors = allTasks.filter(
      t => t.predecessors && t.predecessors.includes(task.id)
    );

    let lateFinish = projectEnd;
    if (successors.length > 0) {
      for (const succ of successors) {
        if (!succ._lateStart) continue;
        const dep = project.dependencies?.find(d => d.from === task.id && d.to === succ.id);
        const lag = dep?.lag || 0;
        const candidateFinish = subtractWorkingDays(succ._lateStart, lag, workingDays, holidays);
        if (candidateFinish < lateFinish) {
          lateFinish = candidateFinish;
        }
      }
    }

    task._lateFinish = lateFinish;
    task._lateStart = subtractWorkingDays(lateFinish, task.duration - 1, workingDays, holidays);

    // Calculate float
    const earlyStart = parseDate(task.startDate);
    task.float = workingDaysBetween(earlyStart, task._lateStart, workingDays, holidays);
    task.isCritical = task.float === 0;
  }

  // Calculate project summary
  const projectStartDate = parseDate(startDate);
  const workDuration = workingDaysBetween(projectStartDate, projectEnd, workingDays, holidays);
  const calDuration = calendarDaysBetween(projectStartDate, projectEnd);
  const criticalTasks = allTasks.filter(t => t.isCritical && t.type !== 'phase');
  const criticalDuration = criticalTasks.reduce((sum, t) => sum + (t.duration || 0), 0);

  return {
    ...project,
    endDate: formatDate(projectEnd),
    workingDuration: workDuration,
    calendarDuration: calDuration,
    criticalPathDuration: criticalDuration,
    wbs,
  };
}

function flattenTasks(wbs) {
  const tasks = [];
  for (const phase of wbs) {
    tasks.push(phase);
    if (phase.children) {
      for (const task of phase.children) {
        tasks.push(task);
        if (task.children) {
          for (const subtask of task.children) {
            tasks.push(subtask);
          }
        }
      }
    }
  }
  return tasks;
}

function topologicalSort(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set();
  const sorted = [];

  function visit(task) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    if (task.predecessors) {
      for (const predId of task.predecessors) {
        const pred = taskMap.get(predId);
        if (pred) visit(pred);
      }
    }
    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }
  return sorted;
}

function subtractWorkingDays(fromDate, days, workingDays, holidays) {
  let current = new Date(fromDate);
  let subtracted = 0;
  while (subtracted < days) {
    current.setDate(current.getDate() - 1);
    if (isWorkingDay(current, workingDays, holidays)) {
      subtracted++;
    }
  }
  return current;
}

export function detectCircularDependencies(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set();
  const stack = new Set();

  function hasCycle(taskId) {
    if (stack.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visited.add(taskId);
    stack.add(taskId);
    const task = taskMap.get(taskId);
    if (task?.predecessors) {
      for (const predId of task.predecessors) {
        if (hasCycle(predId)) return true;
      }
    }
    stack.delete(taskId);
    return false;
  }

  for (const task of tasks) {
    if (hasCycle(task.id)) return true;
  }
  return false;
}
