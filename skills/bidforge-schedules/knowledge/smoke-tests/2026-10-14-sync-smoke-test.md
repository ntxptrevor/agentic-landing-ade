# Sync smoke test — 2026-10-14 (dedicated test records, user-approved)

Test project: **BidForge Smoke Test** (pursuit, v1, 107 activities, forecast SC 2027-03-16).
Every record is labelled "TEST - safe to delete".

| Destination | What was written | Result |
|---|---|---|
| Google Drive (bid folder) | `!Active Bids/BidForge Smoke Test (TEST - safe to delete)/Schedules/` + version summary | ✅ created, read back |
| Knowledge base (Drive `!!NTXP Knowledge Base`) | `BidForge Smoke Test (TEST…)/Project Coda.md`, `schedule/changelog.md`, `schedule/activity_stream.json` (Plans-Atlas schema) | ✅ created |
| JobTread (org 22PEKtgSScq2) | Test customer + location + job **#1125218 "TEST BidForge Smoke Test"**; 3 schedule tasks (NTP, Mobilization, SC); Project Coda block in job field "Notes" | ✅ written; Coda verified by read-back (`status: written`, sha 44bcc765, 944 chars) |
| Lightfield CRM | Test account + sync note (version, live link, SC, milestones, Drive, JobTread) | ✅ created |
| Hosted site (local php -S) | publish → load → drag re-sequence → save v7 → instant schedule from files → save v4 (bid folder) | ✅ |
| 11x17 output | PDF 17×11 in, 5 pages, header band on every page, page n of N bold italic navy | ✅ |

Findings fixed during the test:
1. JobTread text custom fields cap at **1,024 characters**; the Coda builder assumed 1,800. It now
   budgets against the real limit (team notes + block) and keeps the live-schedule link whole.
2. JobTread job names cap at 30 characters and this org requires the **Bid Due Date** custom field
   on new jobs.
3. A batched multi-`createTask` request returned a JobTread server error after creating the first
   task; single requests work. Push tasks one request at a time and read back.
4. Instant schedules kept the previously opened project's server version → false 409; fixed.
5. Folder routing now uses the real Drive roots (`!Active Bids`, `!Active Projects`).

Cleanup when no longer needed: delete the JobTread test job/location/customer, the Lightfield test
account and note, and the two Drive folders named "BidForge Smoke Test (TEST - safe to delete)".
