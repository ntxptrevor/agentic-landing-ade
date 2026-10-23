---
id: module-joc_csp_admin
version: 1
updated: 2026-10-13
hash: c08e6fb66cb5
source: council consensus (jevModuleTasks.js) + taxonomy
---

# Module — JOC / CSP Administration

Class: project_management

Confirm question: Is this a JOC or CSP procurement with its own admin steps?

Detection keywords: job order contract, joc, gordian, egordian, csp, competitive sealed proposal, rsmeans, adjustment factor, purchase order, coefficient, tips, buyboard, choice partners, prevailing wage, job order, retainage, task order, unit price book, negotiation, proposal, historically underutilized, davis-bacon, certified payroll, wage rate, g702, g703

| Task | Dur | Trade | Class | Submittal/Lead | Phase | After | Par | Seats | Override |
|---|---|---|---|---|---|---|---|---|---|
| Non-Prepriced Item Sub Quotes & Backup | 5 | GC | project_management | N | preconstruction | Contract Execution |  | 2 |  |
| Owner Proposal Review & Negotiation | 7 | Owner | project_management | N | preconstruction | Contract Execution |  | 3 |  |
| Job Order / Purchase Order Issued | 1 | Owner | project_management | N | preconstruction | Contract Execution | Y | 2 |  |
| UPB Line-Item Proposal with Coefficient Submitted | 5 | GC | project_management | N | preconstruction | Contract Execution |  | 2 |  |
| HUB Progress Assessment Reports (Recurring) | 3 | GC | project_management | Y 0d | preconstruction | All Subcontracts Signed — Confirmed | Y | 3 |  |
| Prevailing Wage Certified Payrolls (Recurring) | 1 | GC | project_management | N | construction | Site Work | Y | 3 |  |
| Final Job Order Reconciliation & Close-Out | 3 | GC | project_management | N | closeout | Turnover (Project Complete) | Y | 2 |  |

## Changelog
- v1 2026-10-13 — regenerated (hash c08e6fb66cb5)
