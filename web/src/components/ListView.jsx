import React from 'react';

export default function ListView({ project }) {
  const { wbs } = project;

  return (
    <div className="list-view">
      <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
        <strong>{project.name}</strong> | {project.startDate} to {project.endDate} | {project.workingDuration} working days
      </div>

      {wbs.map(phase => (
        <div key={phase.id} className="list-phase">
          <div className="list-phase-header">
            {phase.wbsCode}. {phase.name}
            <span className="list-phase-dates">
              {phase.startDate} to {phase.endDate}
            </span>
          </div>

          {(phase.children || []).map(task => (
            <div key={task.id} className="list-task">
              <span className="wbs">{task.wbsCode}</span>
              <span>
                {task.name}
                {task.isCritical && <span className="tag tag-critical" style={{ marginLeft: 8 }}>CRITICAL</span>}
              </span>
              <span>{task.duration}d</span>
              <span className="dates">{task.startDate} → {task.endDate}</span>
              <span className="deps">
                {task.predecessors?.length > 0 && (
                  <>dep: {task.predecessors.join(', ')}</>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
