#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: catches schedule conversations and routes them into the
// canonical schedule (bidforge-schedules). Reads the hook JSON ({prompt, cwd, session_id, ...})
// from stdin. Schedule-related → prints {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit",
// "additionalContext":"..."}}. Otherwise, or on any error, exits 0 silently (never blocks a prompt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Unambiguous schedule vocabulary: one hit is enough.
const STRONG = [
  /\bgantt\b/i, /\bcpm\b/i, /\bcritical[\s-]+path\b/i, /\blook[\s-]?aheads?\b/i, /\bmilestones?\b/i,
  /\bsubstantial(?:ly)?[\s-]+complet(?:e|ion)\b/i, /\bfinal[\s-]+completion\b/i, /\bNTP\b/, /\bnotice[\s-]+to[\s-]+proceed\b/i,
  /\b(?:recovery|baseline|master|construction|project|updated|revised|canonical|bid|job)[\s-]+schedules?\b/i,
  /\bschedule[\s-]+(?:update|impact|variance|slip(?:page)?|delay|revision|narrative|version|recovery)s?\b/i,
  /\bmspdi\b/i, /\.mpp\b/i, /\b(?:ms|microsoft)[\s-]+project\b/i, /\bOAC\b/i, /\bowner[\s-]+architect[\s-]+contractor\b/i,
  /\bpay[\s-]?app(?:lication)?[\s-]+schedule\b/i, /\btime[\s-]+extensions?\b/i, /\bliquidated[\s-]+damages\b/i,
  /\b(?:weather|rain)[\s-]+days?\b/i, /\bdata[\s-]+date\b/i, /\bbidforge\b/i, /\b(?:total|free|negative|schedule)[\s-]+float\b/i,
  /\b(?:ahead\s+of|behind|on)\s+schedule\b/i, /\bwbs\b/i,
];
// Ambiguous words: count only next to construction context.
const WEAK = [/\bschedul(?:e|es|ed|ing)\b/i, /\bdurations?\b/i, /\bdelay(?:s|ed)?\b/i, /\bslip(?:s|ped|page)?\b/i,
  /\bsequenc(?:e|es|ed|ing)\b/i, /\bfloat\b/i, /\bbaseline\b/i, /\blead[\s-]+times?\b/i, /\bwork(?:ing)?[\s-]+days?\b/i];
const CONTEXT = /\b(?:drywall|framing|demo(?:lition)?|inspections?|sub(?:contractor)?s?|super(?:intendent)?|trades?|phases?|tasks?|activit(?:y|ies)|job(?:site)?|project|site|owner|architect|GC|punch|closeout|submittals?|RFIs?|mobiliz\w*|install\w*|pour|concrete|roof\w*|MEP|crew|WD|NTXP|JobTread|campus|renovation|construction|rough[\s-]?in|abatement|fire\s+marshal|precon\w*)\b/i;
// "schedule a meeting", calendar talk — not the construction schedule.
const CALENDAR = /\b(?:re)?schedul(?:e|ing)\s+(?:a|an|the|my|our|some|this|that)?\s*(?:\w+\s+)?(?:meeting|call|appointment|time|chat|zoom|teams|demo|interview|lunch|dinner|session|1:1|one[\s-]on[\s-]one|sync|catch[\s-]?up|haircut|dentist|doctor)\b|\bcalendar\s+invites?\b|\bsend\s+(?:an?\s+)?invites?\b/i;
const OAC_GEN = /\bOAC\b[^.?!\n]{0,60}\b(?:report|agenda|minutes|packet|deck|presentation|summary|update)\b|\b(?:report|agenda|minutes|packet|deck)\b[^.?!\n]{0,40}\bOAC\b/i;

export function classify(prompt) {
  const p = String(prompt || '');
  if (!p.trim()) return { schedule: false, oac: false };
  const strong = STRONG.some(r => r.test(p));
  let schedule = strong;
  if (!schedule) {
    const calendarish = CALENDAR.test(p);
    const weakHits = WEAK.filter(r => r.test(p)).length;
    const scheduleWord = WEAK[0].test(p);
    // bare "schedule" (noun) counts unless the prompt is calendar talk; other weak words need context
    if (!calendarish && scheduleWord && /\b(?:the|our|this|that|current|latest|new|its|job's|project's)\s+schedule\b/i.test(p)) schedule = true;
    else if (!calendarish && weakHits && CONTEXT.test(p)) schedule = true;
    else if (!calendarish && weakHits >= 2) schedule = true;
  }
  return { schedule, oac: schedule && OAC_GEN.test(p) };
}

export function buildContext({ sessionId, date, skillDir, oac }) {
  const src = `conversation, session ${sessionId || 'unknown'}, ${date} UTC`;
  const lines = [
    `BidForge schedule router (${src}). S=${skillDir}`,
    '1) The canonical schedule (<KB>/schedule/canonical.json) is the single source of truth: use the bidforge-schedules skill; read it with `node $S/scripts/schedule_query.mjs <canonical.json> summary|lookahead|milestones|critical|task <q>|late|changes|oac`, never re-derive.',
    `2) Capture every schedule fact, decision or date stated here as a bidforge input with a changelog entry sourced: ${src}, plus links to any files/emails/meetings referenced. Never edit Drive/JobTread copies directly.`,
    '3) Folders: pursuit (status bid) → bid folder `Schedules/`; awarded → project folder `06 - Schedule/`. Versions immutable `v<NNN>-<date>`.',
    '4) Never fork: load the latest canonical version, save with baseVersion; on a version conflict reconcile, never overwrite.',
  ];
  if (oac) lines.push('5) OAC GATE (forced schedule update): before any OAC report/agenda/minutes run `node $S/scripts/oac_gate.mjs <canonical.json>`; if it fails run /bidforge-schedules --sync <project> (full sync) first, then `schedule_query oac`.');
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
