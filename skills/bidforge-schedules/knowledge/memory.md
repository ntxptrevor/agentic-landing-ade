# Schedule Memory — global directives

Directives the user gave with "remember this", "save this to memory", "from now on", "always", "never".
Global scope only; project-scope directives live in the project KB under `## Schedule Memory`.
Read at initialization and applied before JEV defaults. User directives are canon.

| Date | Directive | Source | Applied as |
|---|---|---|---|
| 2026-10-13 | Maintain original critical path items unless the user specifically, repeatedly, or manually changes/removes them. | user (BidForge v2 spec) | Hard rule 3; `critical: true` backbone items |
| 2026-10-13 | Organize every job Preconstruction → Construction → Closeout in the NTXP sequence. | user | constructionPhases.js backbone |
| 2026-10-13 | Sub invoices are due the 20th for payment the following month; accept only with PM approval, NTXP PO and conditional waiver. | user | trackers.js rateSubInvoice |
| 2026-10-13 | Milestone dates move only with user permission. | user | Hard rule 4; sync P3 |
| 2026-10-13 | Back up the Project Coda to the JobTread job custom field "Notes" during every sync event. | user | Hard rule 9; canonical-and-offramp § 4b; scripts/coda_backup.mjs |
