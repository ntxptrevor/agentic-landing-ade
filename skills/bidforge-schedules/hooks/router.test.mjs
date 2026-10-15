// Labelled fixture for the schedule router hook (council audit #3, A-10/F-05).
// run: node --test skills/bidforge-schedules/hooks/   (prints precision / recall)
// Labels: 'oac' = schedule + OAC gate step, 'schedule' = routed, 'none' = must stay silent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classify } from './schedule_router.mjs';

export const FIXTURE = [
  // Seat probes that were missed before audit #3
  ['inspection passed today', 'schedule'],
  ['owner moved SC to 12/20', 'schedule'],
  ['drywall crew is 2 days behind', 'schedule'],
  ['can we start framing Monday', 'schedule'],
  ['when is the ceiling grid going in', 'schedule'],
  ['the AHU ships 3 weeks late', 'schedule'],
  ['pour got rained out', 'schedule'],
  ['OAC narrative for Thursday', 'oac'],
  ['update the lookahead', 'schedule'],
  ["what's on the critical path", 'schedule'],
  ['pay app percent complete for October', 'schedule'],
  ['punch walk moved to Friday', 'schedule'],
  ['drywall sub is 3 days late', 'schedule'],
  ['Inspection failed today, re-inspect Tuesday', 'schedule'],
  ['Roofer cannot start until the 20th', 'schedule'],
  ['Elevator equipment ships 6 weeks late', 'schedule'],
  ['When does flooring start at McShan?', 'schedule'],
  ['HVAC units delivered, set crane Monday', 'schedule'],
  ['Fire marshal final passed', 'schedule'],
  ['Reschedule the drywall inspection to Monday', 'schedule'],
  ['Push mobilization back two weeks, the permit is late', 'schedule'],
  ['move the punch walk to next Friday', 'schedule'],
  ['add 2 days to selective demo', 'schedule'],
  ['what is the lead time on the RTUs', 'schedule'],
  ['ceiling tile is pushed back a week because of lead time', 'schedule'],
  ['when does the sub start mobilizing', 'schedule'],
  ['drywall sub says delivery slipping two weeks', 'schedule'],
  ['push the RTU delivery out 10 days', 'schedule'],
  ['tape and finish will take 4 more days', 'schedule'],
  ['we are behind on the roof', 'schedule'],
  ['Remember this: always use 5 WD notice for TAS inspections', 'schedule'],
  ['call the inspector, the above-ceiling inspection failed today', 'schedule'],
  ['fire code inspection passed yesterday', 'schedule'],
  ['precon meeting moved to Friday', 'schedule'],
  ['prep for the OAC meeting tomorrow', 'oac'],
  ['write the OAC minutes from today', 'oac'],
  // Already caught before audit #3 (regression guard)
  ['Update the schedule — drywall slipped 3 days per the super', 'schedule'],
  ['What is on the 3-week lookahead for McShan?', 'schedule'],
  ['Show me the critical path and float on the restroom job', 'schedule'],
  ['Owner says substantial completion moves to 12/20, log it', 'schedule'],
  ['Generate the OAC report for McShan', 'oac'],
  ['draft the OAC agenda for Thursday', 'oac'],
  ['Export the MSPDI so I can open it as .mpp', 'schedule'],
  ['We got NTP today, start the baseline', 'schedule'],
  ['Can you build a recovery schedule after the delay?', 'schedule'],
  ['the gantt looks off for phase 2', 'schedule'],
  // Must stay silent
  ['schedule a meeting with Bob tomorrow', 'none'],
  ['Schedule a call with the owner next week', 'none'],
  ['schedule a call', 'none'],
  ['Please schedule an appointment with my dentist', 'none'],
  ['Can you move my dentist appointment to Friday?', 'none'],
  ['send a calendar invite to the architect for Friday', 'none'],
  ['What is the duration of the Netflix show Dark?', 'none'],
  ['Write a Python function to sort a list', 'none'],
  ['How do I schedule a cron job in Python every Monday?', 'none'],
  ['python asyncio: run a task with a 5 second delay', 'none'],
  ['schedule the email for 9am', 'none'],
  ['Reschedule my 1:1 with Sarah to Thursday', 'none'],
  ['remind me to call mom on Monday', 'none'],
  ['my flight is delayed 2 hours', 'none'],
  ['the package ships Monday', 'none'],
  ['how long is the movie Inception', 'none'],
  ['book a table for dinner Friday at 7', 'none'],
  ['summarize this email thread', 'none'],
  ['what color should I paint the living room', 'none'],
  ['fix the bug where the render is delayed in my React component', 'none'],
];

const routed = l => l !== 'none';

export function metrics(fixture = FIXTURE) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const misses = [], falsePositives = [];
  for (const [p, label] of fixture) {
    const got = classify(p).schedule;
    if (routed(label) && got) tp++;
    else if (routed(label)) { fn++; misses.push(p); }
    else if (got) { fp++; falsePositives.push(p); }
    else tn++;
  }
  return { n: fixture.length, tp, fp, fn, tn, precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn), misses, falsePositives };
}

test('fixture has at least 40 labelled prompts', () => {
  assert.ok(FIXTURE.length >= 40, `only ${FIXTURE.length}`);
});

test('router recall >= 95% and zero false positives', () => {
  const m = metrics();
  console.log(`router: n=${m.n} precision=${(m.precision * 100).toFixed(1)}% recall=${(m.recall * 100).toFixed(1)}% (tp ${m.tp}, fp ${m.fp}, fn ${m.fn}, tn ${m.tn})`);
  if (m.misses.length) console.log('  misses:', m.misses);
  assert.equal(m.fp, 0, `false positives: ${m.falsePositives.join(' | ')}`);
  assert.ok(m.recall >= 0.95, `recall ${m.recall}; misses: ${m.misses.join(' | ')}`);
});

test('OAC report/agenda/minutes/narrative/meeting prep get the gate step', () => {
  for (const [p, label] of FIXTURE) {
    if (label === 'oac') assert.equal(classify(p).oac, true, p);
    if (label === 'none') assert.equal(classify(p).oac, false, p);
  }
});

test('hook process: routed prompt prints context, silent otherwise, never fails', () => {
  const hook = fileURLToPath(new URL('./schedule_router.mjs', import.meta.url));
  const run = input => spawnSync(process.execPath, [hook], { input, encoding: 'utf8' });
  const r = run(JSON.stringify({ prompt: 'OAC narrative for Thursday', session_id: 's-1' }));
  assert.equal(r.status, 0);
  const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /OAC GATE/);
  assert.match(ctx, /s-1/);
  assert.ok(ctx.length <= 1300);
  for (const bad of ['', 'not json{', '{"cwd":"/"}', JSON.stringify({ prompt: 'schedule a call' })]) {
    const q = run(bad);
    assert.equal(q.status, 0);
    assert.equal(q.stdout.trim(), '');
  }
});
