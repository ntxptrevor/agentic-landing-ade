# Procurement Auto-Audit Skill

## Purpose

Query JobTread, Google Drive, Lightfield CRM, Gmail, and Google Calendar for procurement-related documents, approvals, and events tied to a construction project. **Write the results to JobTread as the source of truth**, then generate a JSON payload for BidForge Schedules as a secondary visualization.

## Data Flow Priority

```
JobTread (source of truth)
  ^ write-back (always)
  |
Audit Engine (this skill)
  | read
  |-- JobTread documents, tasks
  |-- Google Drive files
  |-- Lightfield CRM records
  |-- Gmail threads (optional)
  +-- Google Calendar events (optional)
  | output
BidForge JSON (visualization)
```

**JobTread is always the primary record.** Every procurement entry discovered by this skill MUST be written to JobTread first. The BidForge JSON is a secondary output for schedule visualization only.

## When to Use

Invoke this skill when a user asks to:
- Audit procurement status for a project
- Find POs, vendor orders, submittals, or approvals for a schedule
- Auto-populate procurement tasks from connected platforms
- Generate a procurement audit report
- Sync procurement data across platforms

## Input

The user provides a **project name** or **JobTread job ID**. If not provided, list active jobs from JobTread and ask the user to pick one.

## Workflow

### Step 1: Identify the Project

Get the organization ID:
```
mcp__JobTread__query({ "currentGrant": { "organization": { "id": {} } } })
```

Query JobTread for matching jobs:
```
mcp__JobTread__query({
  "organization": {
    "$": { "id": "<orgId>" },
    "jobs": {
      "$": { "size": 10 },
      "nodes": { "id": {}, "name": {} }
    }
  }
})
```

### Step 2: Query JobTread Documents (with pagination)

For the matched job, pull all documents. **Use pagination** to ensure nothing is missed on large projects:
```
mcp__JobTread__query({
  "job": {
    "$": { "id": "<jobId>" },
    "documents": {
      "$": { "size": 50 },
      "nodes": {
        "id": {}, "name": {}, "type": {}, "status": {},
        "issueDate": {}, "signedAt": {}, "closedAt": {},
        "price": {}, "cost": {}
      },
      "cursor": {}
    }
  }
})
```

**Pagination loop:** If `cursor` is returned and non-null, re-query with `"after": "<cursor>"` added to the `$` params. Repeat until `cursor` is null or no more nodes are returned.

Map document types to procurement entries:
- `vendorOrder` -> "Procurement: Purchase Order Issued -- [name]"
- `customerOrder` -> "Procurement: Customer Order Received -- [name]"
- `vendorBill` -> "Procurement: Vendor Invoice Received -- [name]"
- `customerInvoice` -> "Procurement: Customer Invoice Issued -- [name]"
- `bidRequest` -> "Procurement: Bid Request Sent -- [name]"
- `changeOrder` -> "Procurement: Change Order Issued -- [name]"
- `lienWaiver` -> "Procurement: Lien Waiver Received -- [name]"

Use `issueDate` as the task date. Use `signedAt` for contract execution dates.

### Step 3: Query Existing JobTread Tasks (Deduplication)

Pull ALL existing schedule tasks to prevent duplicates. **Use pagination:**
```
mcp__JobTread__query({
  "job": {
    "$": { "id": "<jobId>" },
    "tasks": {
      "$": { "size": 100 },
      "nodes": {
        "id": {}, "name": {}, "startDate": {}, "endDate": {},
        "progress": {}, "description": {}
      },
      "cursor": {}
    }
  }
})
```

If `cursor` is non-null, paginate with `"after": "<cursor>"`.

**Deduplication strategy (ordered by reliability):**

1. **Match by document ID in description** -- Parse existing task descriptions for document IDs (look for `Document ID:` or `documentId:` fields). If the incoming document's JobTread ID matches a description field, it is a duplicate.
2. **Match by exact task name** -- If a task named `Procurement: <type> -- <document name>` already exists, skip it.
3. **Do NOT use substring matching** on short terms (like "NTXP" or "PO") as these produce false positives.

Report skipped items in the output so the user knows what was already tracked.

### Step 4: Query Google Drive

Search for procurement-related files using specific terms (avoid overly broad terms like "PO"):
```
mcp__Google_Drive__search_files({
  "query": "fullText contains '<projectName>' and (fullText contains 'purchase order' or fullText contains 'submittal' or fullText contains 'approval' or fullText contains 'contract' or fullText contains 'insurance certificate' or fullText contains 'bond' or fullText contains 'notice to proceed' or fullText contains 'change order' or fullText contains 'lien waiver' or fullText contains 'shop drawing')",
  "pageSize": 25,
  "snippetVerbosity": "BRIEF"
})
```

**Note:** Do not use "PO" alone as a search term -- it matches too many unrelated files. Use "purchase order" instead. Search file names only when content search returns noise.

Map Drive files to procurement entries:
- Files with "purchase order" -> `vendorOrder`
- Files with "submittal" -> `submittal`
- Files with "shop drawing" -> `shopDrawing`
- Files with "approval" -> `approval`
- Files with "contract" -> `contract`
- Files with "change order" -> `changeOrder`
- Files with "lien waiver" -> `lienWaiver`
- Files with "insurance" or "COI" -> `insurance`
- Files with "bond" -> `bond`
- Files with "NTP" or "notice to proceed" -> `notice`

Use the file's `modifiedTime` or `createdTime` as the entry date. Include the Drive file link in the entry for cross-referencing.

### Step 5: Query Lightfield CRM

Search for related opportunities and tasks:
```
mcp__Lightfield__read_from_lightfield({
  "path": "/v1/opportunities?q=<projectName>&limit=5"
})
```

Also search tasks:
```
mcp__Lightfield__read_from_lightfield({
  "path": "/v1/tasks?q=<projectName>&limit=10"
})
```

Map Lightfield records to procurement entries where relevant (closed opportunities = contracts, completed tasks = approvals). Include the Lightfield record ID for traceability.

### Step 6: Query Gmail (Optional)

Search for procurement-related emails:
```
mcp__Gmail__search_threads({
  "query": "subject:(<projectName>) AND (purchase order OR submittal OR approval OR NTP OR change order OR lien waiver)",
  "maxResults": 10
})
```

### Step 7: Query Google Calendar (Optional)

Search for procurement meetings:
```
mcp__Google_Calendar__search_events({
  "query": "<projectName> pre-install OR submittal OR procurement",
  "maxResults": 10
})
```

### Step 8: Write to JobTread (REQUIRED)

**This step is mandatory, not optional.** JobTread is the project knowledge base.

#### 8a. Create or find the "Procurement" parent group task

Check if a task named "Procurement" already exists under this job's tasks (from Step 3). If not, create it:
```
mcp__JobTread__query({
  "createTask": {
    "$": {
      "input": {
        "name": "Procurement",
        "isGroup": true,
        "isToDo": false,
        "targetId": "<jobId>",
        "description": "Auto-generated procurement tracking group. Documents and approvals discovered by BidForge procurement audit."
      }
    },
    "id": {}
  }
})
```

Save the returned ID as `procurementGroupId`.

#### 8b. Create sub-tasks for each new procurement entry

For each entry NOT already in JobTread (deduplication from Step 3):
```
mcp__JobTread__query({
  "createTask": {
    "$": {
      "input": {
        "name": "Procurement: <type label> -- <document name>",
        "startDate": "<issueDate or fileDate>",
        "endDate": "<issueDate or fileDate>",
        "isToDo": false,
        "targetId": "<jobId>",
        "parentTaskId": "<procurementGroupId>",
        "progress": 1,
        "description": "Source: <source>\nDocument: <documentName>\nDocument ID: <documentId>\nType: <documentType>\nDate: <date>\nDrive Link: <driveLink if applicable>\nLightfield ID: <lfId if applicable>\nAudit Date: <today>"
      }
    },
    "id": {}
  }
})
```

**Description format is machine-parseable:** each line is `Key: Value`. The `Document ID` line is used by deduplication in Step 3 on subsequent runs.

Set `progress: 1` (100%) for historical events that already occurred. Leave `progress: null` for pending items.

Save each returned task ID. If a task creation fails, record the failure and continue with remaining entries. Track failures for the status report.

#### 8c. Post an audit summary comment to the job

```
mcp__JobTread__query({
  "createComment": {
    "$": {
      "input": {
        "targetId": "<jobId>",
        "targetType": "job",
        "name": "Procurement Audit -- <today>",
        "message": "Procurement auto-audit completed.\n\nSources checked: <list>\nEntries found: <count>\nNew tasks created: <count>\nAlready tracked (skipped): <count>\nFailed to create: <count>\n\nNew entries:\n<bulleted list of new entries with dates>\n\nSkipped (already in schedule):\n<bulleted list of skipped items>\n\nFailed:\n<bulleted list with error details>",
        "isPinned": false,
        "isVisibleToAll": true
      }
    },
    "id": {}
  }
})
```

### Step 9: Generate BidForge JSON Output

After writing to JobTread, produce the JSON payload for BidForge visualization. **Include the JobTread task IDs** so the schedule can reference the source of truth.

Determine `syncStatus`:
- `"synced"` if ALL entries were written to JobTread successfully
- `"partial"` if SOME entries were written and some failed
- `"local-only"` if JobTread write was skipped (should not happen -- Step 8 is mandatory)

```json
{
  "project": "Project Name",
  "jobId": "JobTread Job ID",
  "auditDate": "2026-10-06",
  "sources": ["JobTread", "Google Drive", "Lightfield"],
  "procurementGroupTaskId": "JobTread parent task ID",
  "syncStatus": "synced",
  "entries": [
    {
      "name": "Procurement: Purchase Order Issued -- Millwork PO",
      "date": "2025-09-24",
      "source": "JobTread",
      "documentType": "vendorOrder",
      "documentName": "Purchase Order",
      "documentId": "JobTread document ID",
      "jobTreadTaskId": "ID of the task created in Step 8b",
      "driveFileId": null,
      "lightfieldId": null,
      "duration": 1,
      "trade": "Procurement",
      "syncStatus": "synced"
    }
  ],
  "skipped": [
    {
      "name": "Procurement: Customer Order Received -- NTXP PROPOSAL",
      "reason": "Already exists as JobTread task ID xxx",
      "existingTaskId": "xxx"
    }
  ]
}
```

### Step 10: Verify Write-Back

After creating tasks, re-query JobTread tasks for the job to confirm the procurement entries appear:
```
mcp__JobTread__query({
  "job": {
    "$": { "id": "<jobId>" },
    "tasks": {
      "$": { "size": 100 },
      "nodes": {
        "id": {}, "name": {}, "startDate": {}, "endDate": {},
        "progress": {}, "description": {}
      }
    }
  }
})
```

Confirm all new entries are present. Report any that failed to write.

## Deduplication Rules

Before generating entries:
1. **Primary: Match by document ID** -- Extract `Document ID:` from existing task descriptions and compare to incoming document IDs. This is the most reliable deduplication signal.
2. **Secondary: Match by exact task name** -- Compare the full task name string. Exact match only.
3. **Never substring-match on short generic terms** -- "NTXP", "PO", "order" etc. match too broadly. Only use exact name comparison as fallback.
4. Deduplicate across sources (same document found in both JobTread and Drive) -- match by document name and date
5. Prefer JobTread as the authoritative source for document metadata
6. Prefer Drive/Gmail for supplementary documents not tracked in JobTread
7. Report all deduplication decisions in the output

## Source of Truth Hierarchy

| Data | Primary Source | Secondary Sources |
|---|---|---|
| POs / Vendor Orders | JobTread documents | Google Drive files |
| Customer Orders | JobTread documents | Gmail confirmations |
| Submittals | JobTread documents | Google Drive folders |
| Shop Drawings | JobTread documents | Google Drive files |
| Change Orders | JobTread documents | Google Drive, Gmail |
| Lien Waivers | JobTread documents | Google Drive |
| Contracts / Agreements | JobTread documents | Google Drive, Lightfield |
| Insurance / Bonds | JobTread documents | Google Drive |
| Approvals | JobTread document status | Gmail, Calendar events |
| Meeting Records | Google Calendar | Gmail, Lightfield |
| CRM Opportunity Data | Lightfield | JobTread job data |

## Error Handling

- If JobTread write fails, **stop and report** -- do not generate BidForge JSON without confirming the source of truth is updated
- **Exception for partial failures:** If some tasks were created and others failed, report `syncStatus: "partial"`, list which succeeded and which failed, and generate BidForge JSON for the successful entries only
- If a secondary connector (Drive, Lightfield, Gmail, Calendar) is unavailable, skip it, note the gap, and continue with available sources
- If no project match is found, list available jobs and ask the user
- Never expose API tokens or credentials in output
