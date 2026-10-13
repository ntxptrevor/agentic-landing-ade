You are one seat on an independent three-seat model council. Do NOT coordinate with anyone; produce your own answer from your own knowledge of commercial construction practice. This is research only — write exactly one output file, nothing else.

## Context
NTXP LLC is a Texas general contractor doing public-entity renovation work (JOC / CSP / competitive sealed proposals) for ISDs, colleges, municipalities, counties (incl. jails/courts), and hospitals/clinics. We are building a deterministic scheduling decision tree ("JEV tree"). Every NTXP job uses three phases: PRECONSTRUCTION -> CONSTRUCTION -> CLOSEOUT. The default construction flow is demo-to-finishes for an interior renovation.

## Your task
Produce the best-practice construction sequence as data:
1. A BASE module: every activity in a typical public-entity interior renovation across ALL relevant commercial CSI MasterFormat divisions (01 General Requirements through 33 Utilities, including 01 PM/admin items like submittals, OAC meetings, permits, inspections, pay apps), in correct execution order, demo-to-finishes, including the precon and closeout items.
2. GATED modules — added only when documents or the user confirm the scope. Use exactly these module ids:
   low_voltage, access_control, fire_alarm, fire_suppression, selective_demo, icra, medical_specialties, opci, site_work, exterior_improvements, abatement, medical_specific, imaging (x-ray/CT/MRI shielding etc), isd_college, mep_lab, complex_owner (mockups, staging, cutouts/renderings approvals), secured_building (jails, cells, holding, courts), occupied_phasing, roofing, elevator, kitchen_foodservice, joc_csp_admin.
   Add any other module you believe is common in Texas public work and vitally integrated (use a snake_case id and explain it in one line in the notes section).
For each gated module, list its activities and where each one inserts relative to base activities ("after:<base task name>").

## Output format — STRICT
Write ONE file to: OUTFILE
Pipe-delimited, one activity per line, header row first, no markdown table borders:

module|seq|task|class|trade|csi|submittal_or_lead|lead_days|phase|milestone|duration_days|insert_after|gate_keywords

- module: base or a module id
- seq: integer order within the module (base: global order)
- task: short activity name (<= 70 chars)
- class: exactly one of: standard_renovation, security, hospital, low_voltage, life_safety, inspection, oac, project_management, design, permit
- trade: subcontractor trade (e.g. Demolition, Framing/Drywall, Electrical, Plumbing, HVAC, Fire Sprinkler, Fire Alarm, Low Voltage, Flooring, Painting, Millwork, Doors/Hardware, Glazing, Roofing, Earthwork, Concrete, Landscape, Abatement, Detention Equipment, Medical Equipment, GC, Owner, Architect, AHJ)
- csi: two-digit division (00 for none)
- submittal_or_lead: Y if the item has a related submittal OR a material lead time, else N
- lead_days: typical calendar-day lead time after approval (0 if none)
- phase: preconstruction | construction | closeout
- milestone: Y or N
- duration_days: typical working days for a ~5,000-15,000 SF renovation
- insert_after: for base rows leave blank; for module rows "after:<exact base task name>"
- gate_keywords: comma-separated words that, found in specs/plans/scope, indicate this module applies (module rows only; blank for base)

After the data rows, append a line `### NOTES` followed by at most 15 short bullet lines: sequencing rules you consider non-negotiable (e.g., "above-ceiling inspection before ceiling grid closes"), and any added module ids with one-line definitions.

Aim for 120-200 base rows and 4-15 rows per module. Be exhaustive but realistic. Do not include prices. Return a one-line confirmation with the row count when finished.
