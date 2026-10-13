// MSPDI (Microsoft Project XML) export — opens in MS Project and saves as .mpp.
// Outline: phase (1) > sub-phase summary (2) > task (3).

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DAYS = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
const dur = (days, hpd) => `PT${Math.round(days * hpd)}H0M0S`;
const LINK = { FF: 0, FS: 1, SF: 2, SS: 3 };

export function exportMSPDI(project, meta = {}) {
  const hpd = project.hoursPerDay || 8;
  const workDays = new Set((project.workingDays || []).map(d => DAYS[d]));
  const rows = [];
  const uidOf = new Map();
  let uid = 0;

  for (const phase of project.wbs) {
    rows.push({ kind: 'phase', level: 1, item: phase, uid: ++uid });
    let currentSub = null;
    for (const t of phase.children || []) {
      if (t.sub && t.sub !== currentSub) {
        currentSub = t.sub;
        const kids = phase.children.filter(c => c.sub === t.sub);
        rows.push({ kind: 'sub', level: 2, item: { name: t.sub, startDate: kids.map(k => k.startDate).sort()[0], endDate: kids.map(k => k.endDate).sort().pop() }, uid: ++uid });
      }
      uidOf.set(t.id, ++uid);
      rows.push({ kind: 'task', level: t.sub ? 3 : 2, item: t, uid });
    }
  }

  const outline = [0, 0, 0, 0];
  const taskXml = rows.map((r, i) => {
    outline[r.level - 1] += 1;
    for (let k = r.level; k < outline.length; k++) outline[k] = 0;
    const num = outline.slice(0, r.level).join('.');
    const t = r.item;
    const start = `${t.startDate || project.startDate}T08:00:00`;
    const finish = `${t.endDate || project.endDate}T17:00:00`;
    if (r.kind !== 'task') {
      return `    <Task><UID>${r.uid}</UID><ID>${i + 1}</ID><Name>${esc(t.name)}</Name><OutlineNumber>${num}</OutlineNumber><OutlineLevel>${r.level}</OutlineLevel><Summary>1</Summary><Start>${start}</Start><Finish>${finish}</Finish></Task>`;
    }
    const preds = (t.predecessors || []).filter(p => uidOf.has(p)).map(p => {
      const d = (project.dependencies || []).find(x => x.from === p && x.to === t.id);
      return `<PredecessorLink><PredecessorUID>${uidOf.get(p)}</PredecessorUID><Type>${LINK[d?.type || 'FS']}</Type><LinkLag>${(d?.lag || 0) * hpd * 600}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`;
    }).join('');
    const ms = t.isMilestone || t.duration === 0;
    const ext = [
      ['188743731', t.category], ['188743732', t.jobTreadTaskId], ['188743733', t.notes],
      ['188743734', t.cls], ['188743735', t.trade], ['188743736', t.hasSubmittal ? 'Yes' : 'No'], ['188743737', t.sub],
    ].filter(([, v]) => v).map(([f, v]) => `<ExtendedAttribute><FieldID>${f}</FieldID><Value>${esc(v)}</Value></ExtendedAttribute>`).join('');
    return `    <Task><UID>${r.uid}</UID><ID>${i + 1}</ID><Name>${esc(t.name)}</Name><WBS>${esc(t.wbsCode || t.id)}</WBS><OutlineNumber>${num}</OutlineNumber><OutlineLevel>${r.level}</OutlineLevel><Type>0</Type><Start>${start}</Start><Finish>${finish}</Finish><Duration>${dur(t.duration || 0, hpd)}</Duration><DurationFormat>7</DurationFormat><Milestone>${ms ? 1 : 0}</Milestone><Critical>${t.isCritical ? 1 : 0}</Critical><TotalSlack>${(t.float || 0) * hpd * 600}</TotalSlack><PercentComplete>${t.percentComplete || (t.actualFinish ? 100 : 0)}</PercentComplete>${t.actualStart ? `<ActualStart>${t.actualStart}T08:00:00</ActualStart>` : ''}${t.actualFinish ? `<ActualFinish>${t.actualFinish}T17:00:00</ActualFinish>` : ''}${t.constraintStart ? `<ConstraintType>4</ConstraintType><ConstraintDate>${t.constraintStart}T08:00:00</ConstraintDate>` : '<ConstraintType>0</ConstraintType>'}${t.contractDate ? `<Deadline>${t.contractDate}T17:00:00</Deadline>` : ''}<Notes>${esc(t.notes)}</Notes>${preds}${ext}</Task>`;
  }).join('\n');

  const weekDays = [1, 2, 3, 4, 5, 6, 7].map(d => workDays.has(d)
    ? `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`
    : `<WeekDay><DayType>${d}</DayType><DayWorking>0</DayWorking></WeekDay>`).join('');
  const exceptions = (project.holidays || []).map(h => `<WeekDay><DayType>0</DayType><DayWorking>0</DayWorking><TimePeriod><FromDate>${h}T00:00:00</FromDate><ToDate>${h}T23:59:00</ToDate></TimePeriod></WeekDay>`).join('');
  const attrs = [['188743731', 'Text1', 'Category'], ['188743732', 'Text2', 'JobTread ID'], ['188743733', 'Text3', 'Source Notes'], ['188743734', 'Text4', 'JEV Class'], ['188743735', 'Text5', 'Trade'], ['188743736', 'Text6', 'Has Submittal / Lead'], ['188743737', 'Text7', 'Sub-Phase']]
    .map(([id, name, alias]) => `<ExtendedAttribute><FieldID>${id}</FieldID><FieldName>${name}</FieldName><Alias>${alias}</Alias></ExtendedAttribute>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${esc(project.name)} Schedule</Name>
  <Title>${esc(project.name)}</Title>
  <Company>NTXP LLC</Company>
  <Comments>BidForge canonical schedule v${meta.version ?? 0}</Comments>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${project.startDate}T08:00:00</StartDate>
  <FinishDate>${project.endDate}T17:00:00</FinishDate>
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>${hpd * 60}</MinutesPerDay>
  <MinutesPerWeek>${hpd * 60 * workDays.size}</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DurationFormat>7</DurationFormat>
  <ExtendedAttributes>${attrs}</ExtendedAttributes>
  <Calendars><Calendar><UID>1</UID><Name>NTXP Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays}${exceptions}</WeekDays></Calendar></Calendars>
  <Tasks>
${taskXml}
  </Tasks>
</Project>`;
}
