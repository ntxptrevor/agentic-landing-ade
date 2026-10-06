const DOC_TYPE_LABELS = {
  vendorOrder: 'Purchase Order Issued',
  customerOrder: 'Customer Order Received',
  vendorBill: 'Vendor Invoice Received',
  customerInvoice: 'Customer Invoice Issued',
  bidRequest: 'Bid Request Sent',
  submittal: 'Submittal Received',
  shopDrawing: 'Shop Drawing Submitted',
  approval: 'Approval Received',
  contract: 'Contract Executed',
  changeOrder: 'Change Order Issued',
  lienWaiver: 'Lien Waiver Received',
  insurance: 'Insurance Certificate Received',
  bond: 'Bond Received',
  permit: 'Permit Issued',
  notice: 'Notice to Proceed',
  amendment: 'Amendment Received',
  rfi: 'RFI Response Received',
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(dateStr) {
  if (!dateStr) return '';
  if (!DATE_REGEX.test(dateStr)) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return dateStr;
}

export function parseProcurementImport(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (!data.entries || !Array.isArray(data.entries)) {
    throw new Error('Invalid format: expected { entries: [...] }');
  }
  const hasAnySync = data.entries.some(e => e.jobTreadTaskId);
  const allSynced = data.entries.every(e => e.jobTreadTaskId);
  const computedStatus = allSynced ? 'synced' : hasAnySync ? 'partial' : 'local-only';

  return {
    project: data.project || '',
    jobId: data.jobId || '',
    auditDate: data.auditDate || new Date().toISOString().slice(0, 10),
    sources: data.sources || [],
    syncStatus: data.syncStatus || computedStatus,
    procurementGroupTaskId: data.procurementGroupTaskId || null,
    entries: data.entries.map(e => ({
      name: e.name || `Procurement: ${DOC_TYPE_LABELS[e.documentType] || e.documentType}`,
      date: validateDate(e.date),
      source: e.source || 'Unknown',
      documentType: e.documentType || 'unknown',
      documentName: e.documentName || '',
      documentId: e.documentId || null,
      jobTreadTaskId: e.jobTreadTaskId || null,
      driveFileId: e.driveFileId || null,
      lightfieldId: e.lightfieldId || null,
      duration: e.duration || 1,
      trade: e.trade || 'Procurement',
      category: 'procurement',
      syncStatus: e.jobTreadTaskId ? 'synced' : 'local-only',
    })),
    skipped: data.skipped || [],
  };
}

export function deduplicateEntries(newEntries, existingTasks) {
  const existingIds = new Set();
  const existingNames = new Set();

  function collectTasks(tasks) {
    for (const t of tasks) {
      if (t.jobTreadTaskId) existingIds.add(t.jobTreadTaskId);
      if (t.category === 'procurement') existingNames.add(t.name.toLowerCase());
      if (t.children) collectTasks(t.children);
    }
  }
  for (const phase of existingTasks) {
    collectTasks(phase.children || []);
  }

  const accepted = [];
  const skipped = [];
  for (const entry of newEntries) {
    if (entry.jobTreadTaskId && existingIds.has(entry.jobTreadTaskId)) {
      skipped.push({ ...entry, reason: `Already in schedule (JobTread ID: ${entry.jobTreadTaskId})` });
    } else if (existingNames.has(entry.name.toLowerCase())) {
      skipped.push({ ...entry, reason: 'Task with same name already exists' });
    } else {
      accepted.push(entry);
    }
  }
  return { accepted, skipped };
}

export function buildProcurementTasks(entries, phaseId, startIndex) {
  return entries.map((entry, i) => ({
    id: `${phaseId}.${startIndex + i}`,
    type: 'task',
    name: entry.name,
    wbsCode: `${phaseId}.${startIndex + i}`,
    duration: entry.duration,
    durationUnit: 'days',
    trade: entry.trade,
    category: 'procurement',
    predecessors: [],
    successors: [],
    isMilestone: false,
    isCritical: false,
    notes: buildTaskNotes(entry),
    jobTreadTaskId: entry.jobTreadTaskId || null,
    driveFileId: entry.driveFileId || null,
    lightfieldId: entry.lightfieldId || null,
    syncStatus: entry.syncStatus || 'local-only',
    children: [],
  }));
}

function buildTaskNotes(entry) {
  const parts = [`Source: ${entry.source}`];
  if (entry.documentName) parts.push(`Document: ${entry.documentName}`);
  if (entry.date) parts.push(`Date: ${entry.date}`);
  if (entry.jobTreadTaskId) parts.push(`JT: ${entry.jobTreadTaskId}`);
  if (entry.driveFileId) parts.push(`GD: ${entry.driveFileId}`);
  if (entry.lightfieldId) parts.push(`LF: ${entry.lightfieldId}`);
  return parts.join(' | ');
}

export function buildSourceRef(task) {
  const refs = [];
  if (task.jobTreadTaskId) refs.push(`JT:${task.jobTreadTaskId}`);
  if (task.driveFileId) refs.push(`GD:${task.driveFileId}`);
  if (task.lightfieldId) refs.push(`LF:${task.lightfieldId}`);
  return refs.join('; ');
}

export { DOC_TYPE_LABELS };
