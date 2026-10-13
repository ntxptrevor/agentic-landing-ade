# Requirements gate

Hard-coded in the app (`RequirementsGate.jsx`) and in this skill. Exactly one of:

- **Uploaded** — at least one of: Project Manual, Specifications (Division 01 Summary of Work,
  01 32 00 Construction Progress Documentation, 01 33 00 Submittal Procedures, 01 35 00 special
  procedures incl. ICRA/security, 01 77 00 Closeout), owner Uniform General Conditions,
  Supplementary/Special Conditions, JOC detailed scope.
- **Acknowledged none** — user types `NO PROJECT SPECIFIC REQUIREMENTS` and their name. The build
  then uses the NTXP backbone, skill rules and best practices; the acknowledgement is logged
  (`requirements_acknowledged_none`, JEV 3).

## Extraction (inference, routed — `spec_requirements`, intelligence 85)

Parse with LandingAI ADE (never read raw parse output into context; `jq` summaries only). Extract
into a requirements record, each item with the section reference:

| Field | Examples |
|---|---|
| Contract time / milestones | calendar days, substantial/final completion, phase dates, LDs per day |
| Work hours | after-hours, weekends, noise windows, school calendar / summer break |
| Phasing / occupancy | phases, swing space, areas that stay in service |
| Submittal rules | review days, resubmittal days, required pre-construction submittals |
| Schedule rules | baseline due date, update frequency, required format (P6 / MS Project), float ownership |
| Inspections | AHJ, third party, owner inspections, testing agencies, ICRA monitoring |
| Closeout | O&M, as-builts, training, warranty, attic stock, retainage release |
| Module signals | text passed to `detectModules()` |

Write the record to the canonical `requirements.specText` (pasted or extracted text) and to the KB.
Rules that change durations or add activities become changelog entries (`source: spec <section>`),
and spec-driven tasks carry `notes: "Spec 01 32 00 §1.4.B"`.

## Conflicts

Spec rules outrank the backbone defaults. A spec rule that conflicts with a protected backbone item
is a JEV 4 item: show both, recommend, and wait for the user.
