import React from 'react';

export default function ReviewGenerate({ project, onGenerate, onBack }) {
  const totalTasks = project.wbs.reduce((sum, p) => sum + (p.children?.length || 0), 0);
  const totalDuration = project.wbs.reduce(
    (sum, p) => sum + (p.children || []).reduce((s, t) => s + (t.duration || 0), 0),
    0
  );
  const depCount = project.dependencies?.length || 0;

  return (
    <div>
      <div className="card">
        <h2>Review & Generate</h2>
        <div className="summary-grid">
          <div className="summary-stat">
            <div className="label">Project</div>
            <div className="value" style={{ fontSize: '1.1rem' }}>{project.name}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Start Date</div>
            <div className="value">{project.startDate}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Phases</div>
            <div className="value">{project.wbs.length}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Tasks</div>
            <div className="value">{totalTasks}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Dependencies</div>
            <div className="value">{depCount}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Total Task Days</div>
            <div className="value">{totalDuration}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Phase Summary</h3>
        <table className="task-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Tasks</th>
              <th>Total Duration (days)</th>
            </tr>
          </thead>
          <tbody>
            {project.wbs.map(phase => {
              const phaseDur = (phase.children || []).reduce((s, t) => s + (t.duration || 0), 0);
              return (
                <tr key={phase.id}>
                  <td style={{ fontWeight: 600 }}>{phase.name}</td>
                  <td>{phase.children?.length || 0}</td>
                  <td>{phaseDur}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Working Calendar</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Work days: {project.workingDays.join(', ')} | Hours/day: {project.hoursPerDay} |
          Holidays: {project.holidays.length === 0 ? 'None' : project.holidays.length + ' days'}
        </p>
      </div>

      <div className="btn-group">
        <button className="btn btn-secondary" onClick={onBack}>Back to Edit</button>
        <button className="btn btn-primary" onClick={onGenerate}>
          Generate Schedule
        </button>
      </div>
    </div>
  );
}
