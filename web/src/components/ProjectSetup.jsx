import React, { useState } from 'react';

const WORK_DAY_PRESETS = {
  'mon-fri': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  'mon-sat': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export default function ProjectSetup({ project, onDone }) {
  const [name, setName] = useState(project.name);
  const [startDate, setStartDate] = useState(project.startDate);
  const [workDayPreset, setWorkDayPreset] = useState('mon-fri');
  const [hoursPerDay, setHoursPerDay] = useState(project.hoursPerDay);
  const [holidayPreset, setHolidayPreset] = useState('ntxp');
  const [customHolidays, setCustomHolidays] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const workingDays = WORK_DAY_PRESETS[workDayPreset] || WORK_DAY_PRESETS['mon-fri'];
    const holidays = holidayPreset === 'custom'
      ? customHolidays.split(',').map(h => h.trim()).filter(Boolean)
      : [];

    onDone({
      name: name.trim(),
      startDate,
      workingDays,
      hoursPerDay: Number(hoursPerDay) || 8,
      holidayPreset,
      holidays,
    });
  };

  return (
    <div className="setup-layout">
    <div className="card">
      <h2>Project Setup</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Project Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Highway Bridge Rehabilitation"
            autoFocus
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Hours per Day</label>
            <input
              type="number"
              value={hoursPerDay}
              onChange={e => setHoursPerDay(e.target.value)}
              min={1}
              max={24}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Working Days</label>
          <select value={workDayPreset} onChange={e => setWorkDayPreset(e.target.value)}>
            <option value="mon-fri">Monday - Friday (5-day)</option>
            <option value="mon-sat">Monday - Saturday (6-day)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Holidays</label>
          <select value={holidayPreset} onChange={e => setHolidayPreset(e.target.value)}>
            <option value="ntxp">NTXP calendar (federal + Thanksgiving week + Dec 22 – Jan 2)</option>
            <option value="none">No holidays</option>
            <option value="us">US Federal Holidays</option>
            <option value="custom">Custom (enter dates)</option>
          </select>
        </div>
        {holidayPreset === 'custom' && (
          <div className="form-group">
            <label>Holiday Dates (comma-separated YYYY-MM-DD)</label>
            <input
              type="text"
              value={customHolidays}
              onChange={e => setCustomHolidays(e.target.value)}
              placeholder="2026-07-04, 2026-12-25"
            />
          </div>
        )}
        <div className="btn-group">
          <button type="submit" className="btn btn-primary">
            Continue to Phase Selection
          </button>
        </div>
      </form>
    </div>
    <aside className="card setup-aside" aria-label="What happens next">
      <h3>What happens next</h3>
      <ol>
        <li><b>Project details</b>: name, start date and calendars.</li>
        <li><b>Requirements</b>: upload the Division 01 specs and UGC, or confirm none exist by typing the acknowledgement phrase.</li>
        <li><b>Scope modules</b>: answer Yes or No for every module. Modules with no tasks can only be declined.</li>
        <li><b>Tasks</b>: review the NTXP backbone and the tasks your answers added.</li>
        <li><b>Generate</b>: the CPM engine builds the schedule and logs it to the canonical changelog.</li>
      </ol>
    </aside>
    </div>
  );
}
