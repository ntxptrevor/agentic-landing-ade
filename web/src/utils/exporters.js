export function exportJSON(project) {
  const data = {
    $schema: 'bidforge-schedule-v1',
    project: {
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      workingDays: project.workingDays,
      hoursPerDay: project.hoursPerDay,
      holidays: project.holidays,
      calendarDuration: project.calendarDuration,
      workingDuration: project.workingDuration,
      criticalPathDuration: project.criticalPathDuration,
    },
    wbs: project.wbs.map(phase => ({
      ...phase,
      children: (phase.children || []).map(t => ({
        ...t,
        jobTreadTaskId: t.jobTreadTaskId || undefined,
        syncStatus: t.syncStatus || undefined,
      })),
    })),
    milestones: project.milestones || [],
    dependencies: project.dependencies || [],
    metadata: {
      createdAt: new Date().toISOString(),
      version: '1.0',
    },
  };
  return JSON.stringify(data, null, 2);
}

export function exportCSV(project) {
  const rows = ['WBS Code,Task Name,Phase,Duration (days),Start Date,End Date,Predecessors,Is Critical,Is Milestone,Trade,Category,Source Ref,Notes'];

  for (const phase of project.wbs) {
    for (const task of phase.children || []) {
      rows.push(csvRow(task, phase.name));
      for (const sub of task.children || []) {
        rows.push(csvRow(sub, phase.name));
      }
    }
  }

  return rows.join('\n');
}

function csvRow(task, phaseName) {
  const refs = [];
  if (task.jobTreadTaskId) refs.push(`JT:${task.jobTreadTaskId}`);
  if (task.driveFileId) refs.push(`GD:${task.driveFileId}`);
  if (task.lightfieldId) refs.push(`LF:${task.lightfieldId}`);
  const sourceRef = refs.join('; ');
  const fields = [
    task.wbsCode || task.id,
    csvEscape(task.name),
    csvEscape(phaseName),
    task.duration,
    task.startDate || '',
    task.endDate || '',
    (task.predecessors || []).join('; '),
    task.isCritical ? 'Yes' : 'No',
    task.isMilestone ? 'Yes' : 'No',
    csvEscape(task.trade || ''),
    csvEscape(task.category || 'activity'),
    csvEscape(sourceRef),
    csvEscape(task.notes || ''),
  ];
  return fields.join(',');
}

function csvEscape(val) {
  if (typeof val !== 'string') return val;
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportMSProjectXML(project) {
  let uid = 0;
  const idToUid = new Map();
  const tasks = [];

  // First pass: assign UIDs
  for (const phase of project.wbs) {
    uid++;
    idToUid.set(phase.id, uid);
    for (const task of phase.children || []) {
      uid++;
      idToUid.set(task.id, uid);
    }
  }

  uid = 0;
  for (const phase of project.wbs) {
    uid++;
    tasks.push(`    <Task>
      <UID>${uid}</UID>
      <Name>${xmlEscape(phase.name)}</Name>
      <OutlineLevel>1</OutlineLevel>
      <Start>${phase.startDate || project.startDate}T08:00:00</Start>
      <Finish>${phase.endDate || project.endDate}T17:00:00</Finish>
      <Summary>1</Summary>
    </Task>`);

    for (const task of phase.children || []) {
      uid++;
      const hours = (task.duration || 0) * (project.hoursPerDay || 8);
      const predLinks = (task.predecessors || []).map(predId => {
        const dep = (project.dependencies || []).find(d => d.from === predId && d.to === task.id);
        const type = { FF: 0, FS: 1, SF: 2, SS: 3 }[dep?.type || 'FS'] ?? 1;
        const predUid = idToUid.get(predId) || 0;
        return `      <PredecessorLink>
        <PredecessorUID>${predUid}</PredecessorUID>
        <Type>${type}</Type>
        <LinkLag>${(dep?.lag || 0) * 4800}</LinkLag>
      </PredecessorLink>`;
      }).join('\n');

      const extAttrs = [];
      if (task.category && task.category !== 'activity') {
        extAttrs.push(`      <ExtendedAttribute><FieldID>188743731</FieldID><Value>${xmlEscape(task.category)}</Value></ExtendedAttribute>`);
      }
      if (task.jobTreadTaskId) {
        extAttrs.push(`      <ExtendedAttribute><FieldID>188743732</FieldID><Value>${xmlEscape(task.jobTreadTaskId)}</Value></ExtendedAttribute>`);
      }
      if (task.notes) {
        extAttrs.push(`      <ExtendedAttribute><FieldID>188743733</FieldID><Value>${xmlEscape(task.notes)}</Value></ExtendedAttribute>`);
      }
      const extBlock = extAttrs.length > 0 ? '\n' + extAttrs.join('\n') : '';

      tasks.push(`    <Task>
      <UID>${uid}</UID>
      <Name>${xmlEscape(task.name)}</Name>
      <OutlineLevel>2</OutlineLevel>
      <WBS>${task.wbsCode || task.id}</WBS>
      <Start>${task.startDate || ''}T08:00:00</Start>
      <Finish>${task.endDate || ''}T17:00:00</Finish>
      <Duration>PT${hours}H0M0S</Duration>
${predLinks}${extBlock}
    </Task>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${xmlEscape(project.name)}</Name>
  <StartDate>${project.startDate}T08:00:00</StartDate>
  <FinishDate>${project.endDate}T17:00:00</FinishDate>
  <ExtendedAttributes>
    <ExtendedAttribute><FieldID>188743731</FieldID><FieldName>Category</FieldName><Alias>Category</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743732</FieldID><FieldName>JobTreadTaskId</FieldName><Alias>JobTread ID</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743733</FieldID><FieldName>Notes</FieldName><Alias>Source Notes</Alias></ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>
${tasks.join('\n')}
  </Tasks>
</Project>`;
}

function xmlEscape(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
