// Input processors — parse raw text from various construction document types
// Each processor returns { lines: string[], metadata: {} }

export function processFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function parseMeetingTranscript(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const actionItems = [];
  const attendees = [];
  const dates = [];
  let inActionSection = false;

  for (const line of lines) {
    if (/action\s*items?|follow.?up|to.?do/i.test(line)) {
      inActionSection = true;
      continue;
    }
    if (inActionSection && /^[-*\d.]\s+/.test(line)) {
      actionItems.push(line.replace(/^[-*\d.]+\s*/, ''));
    }
    if (/^(attendees?|present|participants?)\s*[:;]/i.test(line)) {
      attendees.push(...line.replace(/^[^:]+:\s*/, '').split(/[,;]+/).map(a => a.trim()));
    }
    const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) dates.push(dateMatch[1]);
  }

  return {
    lines: actionItems.length > 0 ? actionItems : lines.filter(l => l.length > 15),
    metadata: { attendees, dates, type: 'meeting_transcript' },
  };
}

export function parseEmail(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const metadata = { from: '', to: '', subject: '', date: '', type: 'email' };

  const contentLines = [];
  let headersDone = false;

  for (const line of lines) {
    if (!headersDone) {
      const fromMatch = line.match(/^from:\s*(.+)/i);
      const toMatch = line.match(/^to:\s*(.+)/i);
      const subMatch = line.match(/^subject:\s*(.+)/i);
      const dateMatch = line.match(/^(?:date|sent):\s*(.+)/i);

      if (fromMatch) { metadata.from = fromMatch[1]; continue; }
      if (toMatch) { metadata.to = toMatch[1]; continue; }
      if (subMatch) { metadata.subject = subMatch[1]; continue; }
      if (dateMatch) { metadata.date = dateMatch[1]; continue; }
      if (/^(cc|bcc|reply-to):/i.test(line)) continue;
      headersDone = true;
    }
    if (headersDone && line.length > 10 && !/^[-_=]{3,}$/.test(line) && !/^>/.test(line)) {
      contentLines.push(line);
    }
  }

  return { lines: contentLines, metadata };
}

export function parseSubQuote(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  const metadata = { vendor: '', total: '', type: 'sub_quote' };

  const vendorMatch = text.match(/(?:from|company|contractor|subcontractor|vendor)\s*[:;]\s*(.+)/i);
  if (vendorMatch) metadata.vendor = vendorMatch[1].trim();

  const totalMatch = text.match(/(?:total|grand\s*total|contract\s*(?:amount|value))\s*[:;]?\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (totalMatch) metadata.total = totalMatch[1];

  for (const line of lines) {
    if (/\$[\d,]+/.test(line) || /(?:unit|lump|per|each|EA|LF|SF|SY|CY|LS)/i.test(line)) {
      items.push(line);
    }
    if (/(?:scope|include|work\s*description|labor|material)/i.test(line) && line.length > 15) {
      items.push(line);
    }
  }

  return { lines: items.length > 0 ? items : lines.filter(l => l.length > 15), metadata };
}

export function parseScopeDescription(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const tasks = [];
  const metadata = { type: 'scope_description' };

  for (const line of lines) {
    if (/^[-*\d.]+\s+/.test(line)) {
      tasks.push(line.replace(/^[-*\d.]+\s*/, ''));
    } else if (/(?:install|demo|deliver|provide|furnish|construct|erect|remove|repair|replace|paint|finish)/i.test(line)) {
      tasks.push(line);
    }
  }

  return { lines: tasks.length > 0 ? tasks : lines.filter(l => l.length > 10), metadata };
}

export function parseDailyReport(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const metadata = { date: '', weather: '', manpower: '', type: 'daily_report' };

  const dateMatch = text.match(/(?:date|report\s*date)\s*[:;]\s*(.+)/i);
  if (dateMatch) metadata.date = dateMatch[1].trim();

  const weatherMatch = text.match(/(?:weather|conditions)\s*[:;]\s*(.+)/i);
  if (weatherMatch) metadata.weather = weatherMatch[1].trim();

  const manpowerMatch = text.match(/(?:manpower|headcount|workers|crew)\s*[:;]\s*(.+)/i);
  if (manpowerMatch) metadata.manpower = manpowerMatch[1].trim();

  return { lines: lines.filter(l => l.length > 10), metadata };
}

export function parseChangeOrder(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const metadata = { coNumber: '', amount: '', type: 'change_order' };

  const coMatch = text.match(/(?:CO|change\s*order)\s*#?\s*(\d+)/i);
  if (coMatch) metadata.coNumber = coMatch[1];

  const amtMatch = text.match(/(?:amount|value|cost)\s*[:;]?\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (amtMatch) metadata.amount = amtMatch[1];

  return { lines: lines.filter(l => l.length > 10), metadata };
}

export function parseGeneral(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  return { lines: lines.filter(l => l.length > 5), metadata: { type: 'general' } };
}
