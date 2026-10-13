// JEV (Job Evidence Validator) Decision Tree Engine
// Processes raw inputs (text, files, transcripts) into schedule modifications
// Rules:
//  1. Never remove critical-path items unless user explicitly confirms
//  2. Organize by logical flow: Preconstruction → Construction → Closeout
//  3. Classify every input as an action type before applying

// ─── INPUT CLASSIFICATIONS ──────────────────────────────────────────
export const INPUT_TYPES = {
  MEETING_TRANSCRIPT: 'meeting_transcript',
  EMAIL: 'email',
  TEXT_MESSAGE: 'text_message',
  NOTE: 'note',
  SCOPE_DESCRIPTION: 'scope_description',
  SUB_QUOTE: 'sub_quote',
  CHANGE_ORDER: 'change_order',
  RFI: 'rfi',
  SUBMITTAL: 'submittal',
  DAILY_REPORT: 'daily_report',
  INSPECTION: 'inspection',
  SCHEDULE_UPDATE: 'schedule_update',
  GENERAL: 'general',
};

// ─── ACTION TYPES ───────────────────────────────────────────────────
export const ACTION_TYPES = {
  ADD_TASK: 'add_task',
  MODIFY_DURATION: 'modify_duration',
  ADD_DEPENDENCY: 'add_dependency',
  CHANGE_SEQUENCE: 'change_sequence',
  ADD_NOTE: 'add_note',
  FLAG_DELAY: 'flag_delay',
  CONFIRM_COMPLETE: 'confirm_complete',
  ADD_PROCUREMENT: 'add_procurement',
  UPDATE_DATE: 'update_date',
  NO_ACTION: 'no_action',
};

// ─── KEYWORD PATTERNS ───────────────────────────────────────────────
const PATTERNS = {
  dates: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s*\d{4})?)/gi,
  durations: /(\d+)\s*(?:day|week|month|wk|mo)s?/gi,
  tasks: /(?:start|begin|complete|finish|install|demo|deliver|pour|inspect|frame|wire|rough|trim|paint|clean|mobilize|submit|approve|procure)/gi,
  delays: /(?:delay|push(?:ed)?\s*back|slip|behind|late|hold|wait|reschedule|postpone)/gi,
  completions: /(?:complet(?:e|ed|ion)|done|finish(?:ed)?|wrap(?:ped)?|sign(?:ed)?\s*off|passed|approved)/gi,
  trades: /(?:plumb|electric|hvac|fire\s*(?:alarm|protect|suppres)|drywall|paint|floor|ceiling|frame|framing|concrete|demo|landscape|roofing|masonry|millwork|cabinet|signage|low\s*voltage|controls)/gi,
  procurement: /(?:purchase\s*order|PO|subcontract|material\s*order|vendor|supplier|quote|bid|proposal|pricing)/gi,
  critical: /(?:critical|must\s*have|required|mandatory|deadline|milestone|gate|approval\s*needed)/gi,
  phases: /(?:precon|mobiliz|closeout|punch|turnover|substantial\s*completion|final\s*walk|NTP|notice\s*to\s*proceed)/gi,
};

// ─── PREBUILT WORKFLOWS ─────────────────────────────────────────────
export const WORKFLOWS = [
  {
    id: 'meeting-transcript',
    name: 'Meeting Transcript / Minutes',
    icon: 'MTG',
    description: 'Extract action items, dates, and schedule impacts from OAC or coordination meeting notes',
    acceptedTypes: ['.txt', '.pdf', '.docx', '.md'],
    inputType: INPUT_TYPES.MEETING_TRANSCRIPT,
  },
  {
    id: 'email-thread',
    name: 'Email / Correspondence',
    icon: 'EMAIL',
    description: 'Parse email threads for schedule-affecting decisions, approvals, or delays',
    acceptedTypes: ['.txt', '.eml', '.pdf', '.md'],
    inputType: INPUT_TYPES.EMAIL,
  },
  {
    id: 'text-message',
    name: 'Text Message / Chat',
    icon: 'TXT',
    description: 'Process field text messages or chat logs for quick schedule updates',
    acceptedTypes: ['.txt', '.md'],
    inputType: INPUT_TYPES.TEXT_MESSAGE,
  },
  {
    id: 'scope-description',
    name: 'Scope of Work',
    icon: 'SOW',
    description: 'Parse scope descriptions to generate or validate task sequences',
    acceptedTypes: ['.txt', '.pdf', '.docx', '.md'],
    inputType: INPUT_TYPES.SCOPE_DESCRIPTION,
  },
  {
    id: 'sub-quote',
    name: 'Subcontractor Quote / Proposal',
    icon: 'BID',
    description: 'Extract trade, duration, and procurement items from sub quotes',
    acceptedTypes: ['.txt', '.pdf', '.csv', '.xlsx', '.md'],
    inputType: INPUT_TYPES.SUB_QUOTE,
  },
  {
    id: 'daily-report',
    name: 'Daily Field Report',
    icon: 'RPT',
    description: 'Update task progress and flag delays from daily site reports',
    acceptedTypes: ['.txt', '.pdf', '.md'],
    inputType: INPUT_TYPES.DAILY_REPORT,
  },
  {
    id: 'change-order',
    name: 'Change Order / RFI',
    icon: 'CO',
    description: 'Add or modify tasks based on approved change orders or RFI responses',
    acceptedTypes: ['.txt', '.pdf', '.docx', '.md'],
    inputType: INPUT_TYPES.CHANGE_ORDER,
  },
  {
    id: 'inspection',
    name: 'Inspection Report',
    icon: 'INS',
    description: 'Log inspection results and trigger next-sequence tasks on pass',
    acceptedTypes: ['.txt', '.pdf', '.md'],
    inputType: INPUT_TYPES.INSPECTION,
  },
  {
    id: 'notes',
    name: 'General Notes',
    icon: 'NOTE',
    description: 'Freeform notes — the engine will classify and extract schedule impacts',
    acceptedTypes: ['.txt', '.md'],
    inputType: INPUT_TYPES.NOTE,
  },
];

// ─── CLASSIFY INPUT ─────────────────────────────────────────────────
export function classifyInput(text) {
  const lower = text.toLowerCase();

  if (/(?:meeting|oac|minutes|agenda|coordination|pre-?install|kickoff|attendance|attendees)/i.test(lower))
    return INPUT_TYPES.MEETING_TRANSCRIPT;
  if (/(?:from:|to:|subject:|sent:|cc:|fwd:|re:)/i.test(lower))
    return INPUT_TYPES.EMAIL;
  if (/(?:quote|proposal|bid|pricing|unit\s*price|lump\s*sum|total\s*price)/i.test(lower))
    return INPUT_TYPES.SUB_QUOTE;
  if (/(?:scope\s*of\s*work|sow|specification|description\s*of\s*work)/i.test(lower))
    return INPUT_TYPES.SCOPE_DESCRIPTION;
  if (/(?:change\s*order|co\s*#|bulletin|revision|addendum)/i.test(lower))
    return INPUT_TYPES.CHANGE_ORDER;
  if (/(?:rfi|request\s*for\s*information|clarification)/i.test(lower))
    return INPUT_TYPES.RFI;
  if (/(?:daily\s*(?:report|log)|field\s*report|manpower|weather\s*conditions)/i.test(lower))
    return INPUT_TYPES.DAILY_REPORT;
  if (/(?:inspection|passed|failed|deficienc|violation|comply)/i.test(lower))
    return INPUT_TYPES.INSPECTION;
  if (/(?:submittal|shop\s*draw|product\s*data|sample|catalog\s*cut)/i.test(lower))
    return INPUT_TYPES.SUBMITTAL;

  return INPUT_TYPES.GENERAL;
}

// ─── EXTRACT ACTIONS FROM TEXT ──────────────────────────────────────
export function extractActions(text, inputType) {
  const actions = [];
  const lines = text.split(/[\n.;]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect delays
    if (PATTERNS.delays.test(lower)) {
      PATTERNS.delays.lastIndex = 0;
      const durationMatch = lower.match(PATTERNS.durations);
      const tradeMatch = lower.match(PATTERNS.trades);
      actions.push({
        type: ACTION_TYPES.FLAG_DELAY,
        text: line,
        duration: durationMatch ? parseInt(durationMatch[0]) : null,
        trade: tradeMatch ? tradeMatch[0] : null,
        confidence: 0.8,
      });
      continue;
    }

    // Detect completions
    if (PATTERNS.completions.test(lower)) {
      PATTERNS.completions.lastIndex = 0;
      const tradeMatch = lower.match(PATTERNS.trades);
      const dateMatch = lower.match(PATTERNS.dates);
      actions.push({
        type: ACTION_TYPES.CONFIRM_COMPLETE,
        text: line,
        trade: tradeMatch ? tradeMatch[0] : null,
        date: dateMatch ? dateMatch[0] : null,
        confidence: 0.7,
      });
      continue;
    }

    // Detect new tasks or procurement
    if (PATTERNS.procurement.test(lower)) {
      PATTERNS.procurement.lastIndex = 0;
      const durationMatch = lower.match(PATTERNS.durations);
      actions.push({
        type: ACTION_TYPES.ADD_PROCUREMENT,
        text: line,
        duration: durationMatch ? parseInt(durationMatch[0]) : 5,
        confidence: 0.7,
      });
      continue;
    }

    // Detect task additions or modifications
    if (PATTERNS.tasks.test(lower)) {
      PATTERNS.tasks.lastIndex = 0;
      const durationMatch = lower.match(PATTERNS.durations);
      const tradeMatch = lower.match(PATTERNS.trades);
      const dateMatch = lower.match(PATTERNS.dates);

      if (durationMatch) {
        actions.push({
          type: ACTION_TYPES.MODIFY_DURATION,
          text: line,
          duration: parseInt(durationMatch[0]),
          trade: tradeMatch ? tradeMatch[0] : null,
          date: dateMatch ? dateMatch[0] : null,
          confidence: 0.6,
        });
      } else {
        actions.push({
          type: ACTION_TYPES.ADD_TASK,
          text: line,
          trade: tradeMatch ? tradeMatch[0] : 'General',
          date: dateMatch ? dateMatch[0] : null,
          confidence: 0.5,
        });
      }
      continue;
    }

    // Detect date updates
    const dateMatch = lower.match(PATTERNS.dates);
    if (dateMatch && PATTERNS.critical.test(lower)) {
      PATTERNS.critical.lastIndex = 0;
      actions.push({
        type: ACTION_TYPES.UPDATE_DATE,
        text: line,
        date: dateMatch[0],
        confidence: 0.6,
      });
    }
  }

  return actions;
}

// ─── JEV DECISION TREE ──────────────────────────────────────────────
// Takes extracted actions and existing WBS, returns proposed modifications
export function jevDecisionTree(actions, existingWbs) {
  const proposals = [];
  const criticalIds = new Set();

  // Build set of critical-path task IDs
  for (const phase of existingWbs) {
    for (const task of phase.children || []) {
      if (task.isCritical) criticalIds.add(task.id);
    }
  }

  for (const action of actions) {
    switch (action.type) {
      case ACTION_TYPES.FLAG_DELAY: {
        const matchedTask = findBestTaskMatch(action.text, existingWbs);
        if (matchedTask) {
          const isCrit = criticalIds.has(matchedTask.id);
          proposals.push({
            action: 'modify',
            taskId: matchedTask.id,
            taskName: matchedTask.name,
            field: 'duration',
            oldValue: matchedTask.duration,
            newValue: matchedTask.duration + (action.duration || 5),
            reason: action.text,
            isCriticalPath: isCrit,
            severity: isCrit ? 'high' : 'medium',
            requiresConfirmation: isCrit,
            confidence: action.confidence,
          });
        } else {
          proposals.push({
            action: 'note',
            reason: action.text,
            severity: 'low',
            confidence: action.confidence,
          });
        }
        break;
      }

      case ACTION_TYPES.CONFIRM_COMPLETE: {
        const matchedTask = findBestTaskMatch(action.text, existingWbs);
        if (matchedTask) {
          proposals.push({
            action: 'complete',
            taskId: matchedTask.id,
            taskName: matchedTask.name,
            date: action.date,
            reason: action.text,
            isCriticalPath: criticalIds.has(matchedTask.id),
            severity: 'info',
            confidence: action.confidence,
          });
        }
        break;
      }

      case ACTION_TYPES.ADD_TASK: {
        const targetPhase = detectTargetPhase(action.text, existingWbs);
        proposals.push({
          action: 'add',
          phase: targetPhase,
          taskName: cleanTaskName(action.text),
          duration: action.duration || 3,
          trade: normalizeTrade(action.trade),
          category: 'activity',
          reason: action.text,
          severity: 'low',
          confidence: action.confidence,
        });
        break;
      }

      case ACTION_TYPES.ADD_PROCUREMENT: {
        proposals.push({
          action: 'add',
          phase: 'preconstruction',
          taskName: cleanTaskName(action.text),
          duration: action.duration || 5,
          trade: 'Procurement',
          category: 'procurement',
          reason: action.text,
          severity: 'medium',
          confidence: action.confidence,
        });
        break;
      }

      case ACTION_TYPES.MODIFY_DURATION: {
        const matchedTask = findBestTaskMatch(action.text, existingWbs);
        if (matchedTask) {
          const isCrit = criticalIds.has(matchedTask.id);
          proposals.push({
            action: 'modify',
            taskId: matchedTask.id,
            taskName: matchedTask.name,
            field: 'duration',
            oldValue: matchedTask.duration,
            newValue: action.duration,
            reason: action.text,
            isCriticalPath: isCrit,
            severity: isCrit ? 'high' : 'medium',
            requiresConfirmation: isCrit,
            confidence: action.confidence,
          });
        }
        break;
      }

      case ACTION_TYPES.UPDATE_DATE: {
        proposals.push({
          action: 'date_update',
          date: action.date,
          reason: action.text,
          severity: 'medium',
          confidence: action.confidence,
        });
        break;
      }

      default:
        if (action.text && action.text.length > 10) {
          proposals.push({
            action: 'note',
            reason: action.text,
            severity: 'info',
            confidence: action.confidence || 0.3,
          });
        }
    }
  }

  // Sort: critical-path impacts first, then by confidence
  proposals.sort((a, b) => {
    if (a.isCriticalPath && !b.isCriticalPath) return -1;
    if (!a.isCriticalPath && b.isCriticalPath) return 1;
    const sevOrder = { high: 0, medium: 1, low: 2, info: 3 };
    const sa = sevOrder[a.severity] ?? 3;
    const sb = sevOrder[b.severity] ?? 3;
    if (sa !== sb) return sa - sb;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  return proposals;
}

// ─── HELPERS ────────────────────────────────────────────────────────

function findBestTaskMatch(text, wbs) {
  const lower = text.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const phase of wbs) {
    for (const task of phase.children || []) {
      const words = task.name.toLowerCase().split(/[\s\/\-&]+/).filter(w => w.length > 2);
      let score = 0;
      for (const word of words) {
        if (lower.includes(word)) score += 1;
      }
      if (task.trade && lower.includes(task.trade.toLowerCase())) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = task;
      }
    }
  }

  return bestScore >= 1 ? bestMatch : null;
}

function detectTargetPhase(text, wbs) {
  const lower = text.toLowerCase();
  if (/(?:precon|submittal|permit|contract|ntp|badge|kickoff|procurement|subcontract)/i.test(lower))
    return 'preconstruction';
  if (/(?:closeout|punch|turnover|final\s*walk|warranty|final\s*bill|pay\s*app)/i.test(lower))
    return 'closeout';
  return 'construction';
}

function cleanTaskName(text) {
  return text
    .replace(/(?:need|should|must|will|please|we|they|the|a|an)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalizeTrade(trade) {
  if (!trade) return 'General';
  const map = {
    plumb: 'Plumbing', electric: 'Electrical', hvac: 'HVAC',
    drywall: 'Drywall', paint: 'Painting', floor: 'Flooring',
    ceiling: 'Ceilings', frame: 'Framing', framing: 'Framing',
    concrete: 'Concrete', demo: 'Demolition', landscape: 'Landscape',
    roofing: 'Roofing', masonry: 'Masonry', millwork: 'Millwork',
    cabinet: 'Millwork', signage: 'Signage', 'low voltage': 'Low Voltage',
    controls: 'Controls', 'fire alarm': 'Fire Alarm',
    'fire protect': 'Fire Protection', 'fire suppres': 'Fire Protection',
  };
  const lower = trade.toLowerCase();
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return trade.charAt(0).toUpperCase() + trade.slice(1);
}
