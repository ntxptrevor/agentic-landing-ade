#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: catches schedule conversations and routes them into the
// canonical schedule (ntxp-cpm-gantt-schedule). Reads the hook JSON ({prompt, cwd, session_id, ...})
// from stdin. Schedule-related → prints {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit",
// "additionalContext":"..."}}. Otherwise, or on any error, exits 0 silently (never blocks a prompt).
//
// Scoring (council audit #3, A-10/F-05):
//   strong schedule term (Gantt, CPM, critical path, look-ahead, OAC, ...)   → route
//   construction activity × time/progress signal                              +3
//   "the/our/this schedule" (schedule as a noun), "update the schedule"       +3
//   weak schedule word (duration, delay, lead time, ...) next to an activity  +2
//   calendar / meeting talk, code questions, personal errands                 −4 each
//   route when score ≥ 3. Fixture + precision/recall: hooks/router.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rx = (parts, flags = 'i') => new RegExp(`\\b(?:${parts.join('|')})\\b`, flags);

// Unambiguous schedule vocabulary: one hit is enough.
const STRONG = [
  /\bgantt\b/i, /\bcpm\b/i, /\bcritical[\s-]+path\b/i, /\blook[\s-]?aheads?\b/i, /\bmilestones?\b/i,
  /\bsubstantial(?:ly)?[\s-]+complet(?:e|ion)\b/i, /\bfinal[\s-]+completion\b/i, /\bNTP\b/, /\bnotice[\s-]+to[\s-]+proceed\b/i,
  /\b(?:recovery|baseline|master|construction|project|updated|revised|canonical|bid|job|three[\s-]week|3[\s-]week)[\s-]+schedules?\b/i,
  /\bschedule[\s-]+(?:update|impact|variance|slip(?:page)?|delay|revision|narrative|version|recovery)s?\b/i,
  /\bmspdi\b/i, /\.mpp\b/i, /\b(?:ms|microsoft)[\s-]+project\b/i, /\bOAC\b/i, /\bowner[\s-]+architect[\s-]+contractor\b/i,
  /\bpay[\s-]?app(?:lication)?[\s-]+schedule\b/i, /\btime[\s-]+extensions?\b/i, /\bliquidated[\s-]+damages\b/i,
  /\b(?:weather|rain)[\s-]+days?\b/i, /\bdata[\s-]+date\b/i, /\bbidforge\b/i, /\b(?:total|free|negative|schedule)[\s-]+float\b/i,
  /\b(?:ahead\s+of|behind|on)\s+schedule\b/i, /\bwbs\b/i,
];

// Construction activity vocabulary: trades, work items, inspections, milestones, CSI terms, site events.
const ACTIVITY = [
  rx(['drywall', 'sheetrock', 'gyp(?:sum)?\\s+board', 'framing', 'framers?', 'metal\\s+studs?', 'studs', 'ceiling\\s+(?:grid|tiles?)', 'ceilings?',
    'acoustical', 'paint(?:ing|ers?)?', 'prime\\s+coat', 'flooring', 'carpet', 'LVT', 'VCT', 'terrazzo', 'tile', 'tiling', 'millwork', 'casework',
    'doors?\\s+(?:and|&)\\s+frames', 'door\\s+hardware', 'glazing', 'storefront', 'curtain\\s*wall', 'roof(?:s|ing|ers?)?', 'insulation',
    'waterproofing', 'sealants?', 'masonry', 'brick', 'CMU', 'concrete\\s+(?:pour|truck|work|slab|placement|cure|curing)', 'pours?', 'slabs?',
    'footings?', 'foundations?', 'rebar', 'formwork', 'structural\\s+steel', 'steel\\s+erection', 'joists?', 'excavation', 'grading',
    'site\\s*work', 'paving', 'asphalt', 'curbs?', 'landscaping', 'irrigation', 'underground', 'trench(?:ing)?', 'backfill', 'compaction',
    'demo', 'demolition', 'selective\\s+demo', 'abatement', 'asbestos', 'HVAC', 'AHUs?', 'RTUs?', 'VAVs?', 'duct(?:work)?', 'chillers?',
    'boilers?', 'plumbing', 'plumbers?', 'electrical', 'electricians?', 'switchgear', 'transformers?', 'generators?', 'conduit', 'lighting',
    'low[\\s-]voltage', 'fire\\s+alarm', 'sprinklers?', 'fire\\s+marshal', 'elevators?', 'MEP', 'rough[\\s-]?ins?', 'top[\\s-]?out',
    'tape\\s+(?:and|&)\\s+(?:float|finish)', 'tape,\\s+float', 'punch(?:\\s+(?:list|walk))?', 'closeout', 'turnover', 'commissioning',
    'test(?:ing)?\\s+(?:and|&)\\s+balance', 'inspections?', 're-?inspect\\w*', 'inspectors?', 'permits?', 'AHJ', 'TDLR', 'TAS', 'RAS',
    'certificate\\s+of\\s+occupancy', 'mobiliz\\w*', 'demobiliz\\w*', 'submittals?', 'RFIs?', 'shop\\s+drawings?', 'crane',
    'crews?', 'subs?', 'subcontractors?', 'trades?', 'super(?:intendent)?', 'foreman', 'GC', 'job\\s*site', 'on\\s+site',
    'site\\s+walk', 'walk[\\s-]?through', 'mock[\\s-]?ups?', 'change\\s+orders?', 'ASIs?', 'pay\\s+app(?:lication)?s?', 'SOV',
    'schedule\\s+of\\s+values', 'daily\\s+(?:log|report)s?', 'scaffold\\w*', 'layout', 'renovation', 'precon\\w*', 'pre-con\\w*',
    'kick[\\s-]?off', 'install\\w*', 'equipment', 'units?\\s+delivered']),
  /\b(?:SC|FC|TCO|C\/O|CO)\b/, // milestone abbreviations (case-sensitive)
];

// Time / progress signals: dates, weekdays, behind/ahead/late, moved, passed/failed, ships, percent.
const TIME = [
  rx(['(?:mon|tues?|wednes|thurs?|fri|satur|sun)day', 'today', 'tomorrow', 'yesterday', 'tonight', 'this\\s+week', 'next\\s+(?:week|month)',
    'end\\s+of\\s+(?:the\\s+)?(?:week|month)', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october',
    'november', 'december', 'jan', 'feb', 'aug', 'sept?', 'oct', 'nov', 'dec', 'the\\s+\\d{1,2}(?:st|nd|rd|th)',
    '\\d+\\s*(?:more\\s+)?(?:days?|weeks?|wks?|WD|working\\s+days|work\\s+days|months?)', '(?:a|one|two|three|four|five|six)\\s+(?:more\\s+)?(?:days?|weeks?|months?)',
    'behind', 'ahead', 'late', 'early', 'slip\\w*', 'delay\\w*', 'mov(?:e|ed|es|ing)', 'push(?:ed|ing)?\\s+(?:\\w+\\s+)?(?:back|out)',
    'pull(?:ed)?\\s+in', 'postpon\\w*', 're-?schedul\\w*', 'passed', 'failed', 'rained\\s+out', 'rain(?:ed)?', 'weather', 'ships?', 'shipped',
    'shipping', 'deliver\\w*', 'arriv\\w*', 'lead\\s+times?', 'start(?:s|ed|ing)?', 'finish(?:es|ed)?', 'complete[ds]?', 'percent(?:\\s+complete)?',
    'when\\s+(?:is|are|does|do|will|can|should)', 'how\\s+long', 'go(?:es|ing)?\\s+in', 'done', 'ready', '(?:before|after)\\s+the', 'on\\s+hold', 'held\\s+up', 'until', 'take\\s+\\d+']),
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/, /\b\d{4}-\d{2}-\d{2}\b/, /\d+\s*%/,
];

// Ambiguous schedule words: count next to an activity.
const WEAK = [/\bschedul(?:e|es|ed|ing)\b/i, /\bdurations?\b/i, /\bdelay(?:s|ed)?\b/i, /\bslip\w*\b/i,
  /\bsequenc(?:e|es|ed|ing)\b/i, /\bfloat\b/i, /\bbaseline\b/i, /\blead[\s-]+times?\b/i, /\bwork(?:ing)?[\s-]+days?\b/i];
// "schedule" as a noun: the schedule, our schedule, update the schedule, schedule for the job.
const SCHEDULE_NOUN = /\b(?:the|our|this|that|current|latest|new|its|job's|project's|site's)\s+schedule\b(?!\s+(?:a|an)\b)|\bupdate\s+(?:the\s+)?schedule\b/i;

// Not the construction schedule.
// Calendar items, errands and appointments (always), or "(re)schedule/book/send … a meeting/call/email".
const CALENDAR = [
  /\b(?:calendar|invites?|dentist|doctor|haircut|flight|hotel|reservation|webinar|remind\s+me|1:1|one[\s-]on[\s-]one|zoom\s+link|book\s+a\s+table)\b/i,
  /\b(?:re-?schedul\w*|book|set\s+up|send|cancel|move|plan)\s+(?:a|an|the|my|our|some|this|that)?\s*(?:\w+\s+){0,2}(?:meeting|call|appointment|appt|chat|zoom|lunch|dinner|breakfast|interview|session|sync|catch[\s-]?up|email|e-mail|message|newsletter|post|tweet)s?\b/i,
];
const CODE = /\b(?:python|javascript|typescript|node\.?js|java|react|function|regex|sql|cron|api|script|(?<!(?:building|fire|energy|plumbing|electrical|mechanical|health|city)\s)code|bug|compile|asyncio|celery|kubernetes|docker|unit\s+tests?|algorithm|apscheduler|airflow)\b/i;
const PERSONAL = /\b(?:netflix|hulu|movie|film|tv\s+show|the\s+show|episode|video\s+game|concert|birthday|vacation|my\s+car|oil\s+change|kids?|school\s+pickup|gym|workout|recipe|essay|homework|bedroom|living\s+room|my\s+(?:house|home|apartment|room|kitchen))\b/i;

const OAC_GEN = /\bOAC\b[^.?!\n]{0,60}\b(?:report|agenda|minutes|packet|deck|presentation|summary|update|narrative|notes|recap|prep|meeting|slides)\b|\b(?:report|agenda|minutes|packet|deck|narrative|notes|recap|prep(?:are)?)\b[^.?!\n]{0,40}\bOAC\b/i;

export function score(prompt) {
  const p = String(prompt || '');
  const strong = STRONG.some(r => r.test(p));
  const activity = ACTIVITY.some(r => r.test(p));
  const time = TIME.some(r => r.test(p));
  const weak = WEAK.some(r => r.test(p));
  const noun = SCHEDULE_NOUN.test(p);
  const oacMention = /\bOAC\b/i.test(p);
  let s = 0;
  const why = [];
  if (strong) { s += 5; why.push('strong'); }
  if (activity && time) { s += 3; why.push('activity×time'); }
  if (noun) { s += 3; why.push('schedule-noun'); }
  if (weak && activity) { s += 2; why.push('weak×activity'); }
  if (!oacMention && CALENDAR.some(r => r.test(p))) { s -= 4; why.push('calendar'); }
  if (CODE.test(p)) { s -= 4; why.push('code'); }
  if (PERSONAL.test(p)) { s -= 4; why.push('personal'); }
  return { score: s, strong, activity, time, why };
}

export function classify(prompt) {
  const p = String(prompt || '');
  if (!p.trim()) return { schedule: false, oac: false, score: 0 };
  const r = score(p);
  // Route at score >= 3: a strong term (+5) routes unless calendar / code / personal talk subtracts.
  const schedule = r.score >= 3;
  return { schedule, oac: schedule && OAC_GEN.test(p), score: r.score, why: r.why };
}

export function buildContext({ sessionId, date, skillDir, oac }) {
  const src = `conversation, session ${sessionId || 'unknown'}, ${date} UTC`;
  const lines = [
    `NTXP-CPM-Gantt-Schedule router (${src}). S=${skillDir}`,
    '1) The canonical schedule (<KB>/schedule/canonical.json) is the single source of truth: use the ntxp-cpm-gantt-schedule skill; read it with `node $S/scripts/schedule_query.mjs <canonical.json> summary|lookahead|milestones|critical|task <q>|late|changes|oac`, never re-derive.',
    `2) Capture every schedule fact, decision or date stated here as a schedule input with a changelog entry sourced: ${src}, plus links to any files/emails/meetings referenced. Never edit Drive/JobTread copies directly.`,
    '3) Folders: pursuit (status bid) → bid folder `Schedules/`; awarded → project folder `06 - Schedule/`. Versions immutable `v<NNN>-<date>`.',
    '4) Never fork: load the latest canonical version, save with baseVersion; on a version conflict reconcile, never overwrite.',
  ];
  if (oac) lines.push('5) OAC GATE (forced schedule update): before any OAC report/agenda/minutes/narrative run `node $S/scripts/oac_gate.mjs <canonical.json> [--changes changes.json]`; if it fails run /ntxp-cpm-gantt-schedule --sync <project> first.');
  lines.push('Rules: $S/references/integration.md');
  return lines.join('\n');
}

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { return; }
  if (!input.trim()) return;
  let data;
  try { data = JSON.parse(input); } catch { return; }
  const { schedule, oac } = classify(data?.prompt ?? data?.user_prompt ?? '');
  if (!schedule) return;
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const additionalContext = buildContext({ sessionId: data.session_id, date: new Date().toISOString().slice(0, 10), skillDir, oac });
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }) + '\n');
}

const isMain = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) { try { main(); } catch { /* never block the prompt */ } process.exitCode = 0; }
