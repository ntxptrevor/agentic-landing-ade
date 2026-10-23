// Mini-JEV model router for NTXP CPM Gantt Schedules.
// Every action gets two scores: impact (0-100, likelihood x magnitude of effect on
// the project) and intelligence (1-100, 1 = Haiku/Luna medium effort,
// 100 = Fable/Astra frontier high effort). The router picks the cheapest seat whose
// capability clears the requirement. A model named in an instruction is read as an
// intent (a capability floor), never a hard pick. Model-council configuration still
// decides which seats exist and are authorized; this only chooses among them.

// Capability and cost are relative 1-100 estimates. Live prices and availability come
// from the ntxp-model-router registry (route.py) and the council sheet (01 Config).
export const MODEL_REGISTRY = [
  { id: 'claude-fable-5-1', provider: 'Anthropic', label: 'Claude Fable 5.1', capability: 99, cost: 100, efforts: ['medium', 'high', 'max'] },
  { id: 'openai-astra', provider: 'OpenAI', label: 'OpenAI Astra', capability: 98, cost: 95, efforts: ['medium', 'high'] },
  { id: 'claude-opus-5-5', provider: 'Anthropic', label: 'Claude Opus 5.5', capability: 94, cost: 70, efforts: ['low', 'medium', 'high', 'max'] },
  { id: 'openai-sol', provider: 'OpenAI', label: 'OpenAI Sol', capability: 92, cost: 60, efforts: ['medium', 'high'] },
  { id: 'gemini-pro', provider: 'Google', label: 'Gemini Pro', capability: 88, cost: 45, efforts: ['medium', 'high'] },
  { id: 'grok', provider: 'xAI', label: 'Grok', capability: 84, cost: 35, efforts: ['medium', 'high'] },
  { id: 'claude-sonnet-5-5', provider: 'Anthropic', label: 'Claude Sonnet 5.5', capability: 82, cost: 30, efforts: ['low', 'medium', 'high'] },
  { id: 'deepseek', provider: 'DeepSeek', label: 'DeepSeek', capability: 76, cost: 6, efforts: ['medium'], restricted: true },
  { id: 'glm', provider: 'Zhipu', label: 'GLM Coding Plan', capability: 70, cost: 5, efforts: ['medium'], restricted: true },
  { id: 'openai-luna', provider: 'OpenAI', label: 'OpenAI Luna', capability: 58, cost: 4, efforts: ['medium'] },
  { id: 'claude-haiku-5-5', provider: 'Anthropic', label: 'Claude Haiku 5.5', capability: 55, cost: 5, efforts: ['low', 'medium'] },
];

export function modelScores(m) {
  return {
    cuttingEdge: m.capability,
    costEfficient: Math.round((m.capability / Math.max(m.cost, 1)) * 10) / 10,
  };
}

// Action catalog. `det: true` means a script/JEV rule does it with no model at all.
// `claudeOnly` mirrors the ntxp-model-router hard no-list (owner-facing, pay apps,
// RFI/submittal responses, contract language). `confidential` keeps restricted
// seats (DeepSeek, GLM) away per council rules.
export const ACTIONS = [
  { id: 'cpm_recalc', label: 'CPM forward/backward pass', impact: 60, intel: 1, det: true },
  { id: 'module_detect', label: 'Keyword module detection in specs', impact: 40, intel: 1, det: true },
  { id: 'line_item_classify', label: 'Classify line item (class/trade/submittal/phase/milestone)', impact: 30, intel: 1, det: true },
  { id: 'changelog_write', label: 'Write changelog entry', impact: 10, intel: 1, det: true },
  { id: 'export_xml', label: 'Export MSPDI XML / JSON / CSV', impact: 10, intel: 1, det: true },
  { id: 'jobtread_date_push', label: 'Push dates to JobTread (Pave API)', impact: 45, intel: 5, det: true },
  { id: 'jobtread_pull_diff', label: 'Pull JobTread manual edits and diff', impact: 50, intel: 10, det: true },
  { id: 'invoice_rule_check', label: 'AP invoice rule check (20th, PO, waiver, PM approval)', impact: 55, intel: 5, det: true, confidential: true },
  { id: 'sync_collect', label: 'Collect sync sources (Gmail, Calendar, Drive, Plaud)', impact: 20, intel: 20, confidential: true },
  { id: 'sync_summarize', label: 'Summarize each change source', impact: 35, intel: 40, confidential: true },
  { id: 'meeting_extract', label: 'Extract actions from transcripts / notes', impact: 45, intel: 50, confidential: true },
  { id: 'daily_report_compare', label: 'Compare daily reports/photos to planned progress', impact: 60, intel: 60, confidential: true },
  { id: 'spec_requirements', label: 'Read Project Manual / specs / UGCs for schedule rules', impact: 85, intel: 85, confidential: true },
  { id: 'initial_schedule', label: 'Generate initial schedule', impact: 95, intel: 92, confidential: true },
  { id: 'complex_change', label: 'High-argument complex resequence', impact: 90, intel: 90, confidential: true },
  { id: 'milestone_impact', label: 'Assess milestone / inspection date impact', impact: 90, intel: 80, confidential: true },
  { id: 'preflight_visual', label: 'Pre-flight visual + rules inspection', impact: 50, intel: 55 },
  { id: 'preflight_final_audit', label: 'Final data-source + sync integrity audit', impact: 80, intel: 85, confidential: true },
  { id: 'lessons_conclude', label: 'Draw lessons learned / propose JEV changes', impact: 75, intel: 88 },
  { id: 'research_sweep', label: 'Scheduling best-practice research sweep', impact: 25, intel: 45 },
  { id: 'owner_communication', label: 'Owner/architect-facing schedule narrative', impact: 80, intel: 85, claudeOnly: true, confidential: true },
  { id: 'pay_app_review', label: 'Owner pay application (AR) review', impact: 80, intel: 75, claudeOnly: true, confidential: true },
];

// Named model -> treated as a capability floor (intent), not a selection.
export function intentFloor(namedModel) {
  if (!namedModel) return 0;
  const key = namedModel.toLowerCase();
  const m = MODEL_REGISTRY.find(r => r.id.includes(key) || r.label.toLowerCase().includes(key));
  return m ? m.capability : 0;
}

export function routeAction(actionId, { available = MODEL_REGISTRY.map(m => m.id), namedModel } = {}) {
  const action = ACTIONS.find(a => a.id === actionId);
  if (!action) return { executor: 'claude-opus-5-5', reason: 'Unknown action: default orchestrator' };
  if (action.det) {
    return { executor: 'script', effort: null, required: action.intel, reason: 'Deterministic JEV/script path — no model call' };
  }
  let required = action.intel;
  if (action.impact >= 70) required = Math.max(required, 80);
  required = Math.max(required, Math.min(intentFloor(namedModel), 95));
  const pool = MODEL_REGISTRY
    .filter(m => available.includes(m.id))
    .filter(m => !(action.claudeOnly && m.provider !== 'Anthropic'))
    .filter(m => !(action.confidential && m.restricted));
  const eligible = pool.filter(m => m.capability >= required).sort((a, b) => a.cost - b.cost);
  const pick = eligible[0] || pool.sort((a, b) => b.capability - a.capability)[0];
  if (!pick) return { executor: null, required, reason: 'No authorized seat available' };
  const effort = required >= 90 ? 'high' : required >= 60 ? 'medium' : 'low';
  return {
    executor: pick.id,
    effort: pick.efforts.includes(effort) ? effort : pick.efforts[pick.efforts.length - 1],
    required,
    reason: `${action.label}: impact ${action.impact}, intelligence ${action.intel}${namedModel ? `, named "${namedModel}" read as floor` : ''} → cheapest seat ≥ ${required}`,
  };
}
