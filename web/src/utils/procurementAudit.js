const DOC_TYPE_LABELS = {
  vendorOrder: 'Purchase Order Issued',
  customerOrder: 'Customer Order Received',
  vendorBill: 'Vendor Invoice Received',
  customerInvoice: 'Customer Invoice Issued',
  bidRequest: 'Bid Request Sent',
  submittal: 'Submittal Received',
  approval: 'Approval Received',
  contract: 'Contract Executed',
  insurance: 'Insurance Certificate Received',
  bond: 'Bond Received',
  permit: 'Permit Issued',
  notice: 'Notice to Proceed',
  amendment: 'Amendment Received',
  rfi: 'RFI Response Received',
};

export function parseProcurementImport(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (!data.entries || !Array.isArray(data.entries)) {
    throw new Error('Invalid format: expected { entries: [...] }');
  }
  return {
    project: data.project || '',
    auditDate: data.auditDate || new Date().toISOString().slice(0, 10),
    sources: data.sources || [],
    entries: data.entries.map(e => ({
      name: e.name || `Procurement: ${DOC_TYPE_LABELS[e.documentType] || e.documentType}`,
      date: e.date || '',
      source: e.source || 'Unknown',
      documentType: e.documentType || 'unknown',
      documentName: e.documentName || '',
      duration: e.duration || 1,
      trade: e.trade || 'Procurement',
      category: 'procurement',
    })),
  };
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
    notes: `Source: ${entry.source}${entry.documentName ? ` | ${entry.documentName}` : ''}${entry.date ? ` | ${entry.date}` : ''}`,
    children: [],
  }));
}

export { DOC_TYPE_LABELS };
