# Trackers and the JEV impact scale

Code: `web/src/utils/trackers.js`. Sub-agent: `agents/tracker-watch.md`.

## Impact scale (drives color, notification, gating and model escalation)

| Rating | Label | Color | Trigger examples | Notification | Gate | Intelligence |
|---|---|---|---|---|---|---|
| 1 | Log | gray `#8A94A6` | informational, no date effect | changelog only | no | script |
| 2 | Note | blue `#2F529B` | invoice after 20th rolls to next cycle; unbilled work | sync summary list | no | low |
| 3 | Watch | amber `#B45309` | RFI overdue, approved submittal not ordered, ASI not distributed, missing PO/waiver | highlighted + conversational note | no | mid |
| 4 | Flag | red ink `#B92A32` | blocks a task ≤10 working days out, slip beyond float, past 20th unapproved, CO time request | must be acknowledged at sync | yes | high |
| 5 | Gate | signal red `#D0353C` | milestone / inspection date affected, critical-path slip, failed life-safety inspection | explicit permission + council gate email/text | yes | frontier |

## Rules

**RFIs** — overdue → 3; open and blocking a task starting ≤10 working days → 4; answered but not
sent to affected subs → 3 (communication gap); cost/time impact → 4; critical task +1; affects a
milestone → 5.

**Submittals / lead times** — register seeded from every task with `hasSubmittal`. Stages:
submitted → approved → ordered → shipped (tracking #) → delivered → installed. Need-by = linked
task start − 5 working days. Projected = delivered / ship ETA / (order or approval) + lead days.
Not submitted with lead no longer fitting → 4; revise & resubmit → 3; approved >3 days, no order →
3; due in 7 days without tracking → 3; projected after need-by → 3, beyond float → 4, beyond float
on critical → 5.

**ASIs / change orders** — distribution check for owner, architect, GC and subs (missing → 3);
pending CO with time extension → 4; milestone change → 5.

**Owner pay apps (AR)** — cycle day from the contract (default 25th; set `trackers.payAppCycleDay`).
Due ≤5 days and not started → 4; submitted >30 days unpaid → 3; billed % more than 10 points under
complete % → 3. Pay-app content review stays with Claude (dallas-isd-sov-payapp-review for DISD).

**Sub invoices (AP)** — invoices due the **20th** for payment the following month. Acceptance
requires all three: PM approval status in JobTread, attached NTXP Purchase Order, attached
Conditional Waiver (verify in JobTread documents and the Drive project folder). Missing PO or
waiver → 3; received after the 20th → 2 (next cycle); not PM-approved after the 20th → 4; amount
over remaining PO balance → 4. Scheduled work complete with no saved bill after the 15th → 2
nudge. Email threads that show an invoice sent but not in JobTread → 3.

## Sub-agent escalation

The tracker-watch agent runs deterministically and only calls a model when a rating is ≥3 (write
the note) or ≥4 (write consequence + options for the user). It never sends anything to subs,
owner or architect; drafts only.
