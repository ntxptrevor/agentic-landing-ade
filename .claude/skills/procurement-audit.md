# Procurement Auto-Audit Skill

## Purpose

Query JobTread, Google Drive, Lightfield CRM, Gmail, and Google Calendar for procurement-related documents, approvals, and events tied to a construction project. Generate a JSON payload of procurement schedule entries that can be imported into BidForge Schedules as "Procurement:" tasks in the Pre-Construction phase.

## When to Use

Invoke this skill when a user asks to:
- Audit procurement status for a project
- Find POs, vendor orders, submittals, or approvals for a schedule
- Auto-populate procurement tasks from connected platforms
- Generate a procurement audit report

## Input

The user provides a **project name** or **JobTread job ID**. If not provided, list active jobs from JobTread and ask the user to pick one.

## Workflow

### Step 1: Identify the Project

```
Query JobTread for matching jobs:
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

Get the organization ID first if needed:
```
mcp__JobTread__query({ "currentGrant": { "organization": { "id": {} } } })
```

### Step 2: Query JobTread Documents

For the matched job, pull all documents:
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
      }
    }
  }
})
```

Map document types to procurement entries:
- `vendorOrder` → "Procurement: Purchase Order Issued — [name]"
- `customerOrder` → "Procurement: Customer Order Received — [name]"
- `vendorBill` → "Procurement: Vendor Invoice Received — [name]"
- `customerInvoice` → "Procurement: Customer Invoice Issued — [name]"
- `bidRequest` → "Procurement: Bid Request Sent — [name]"

Use `issueDate` as the task date. Use `signedAt` for contract execution dates.

### Step 3: Query JobTread Tasks

Pull existing schedule tasks for context:
```
mcp__JobTread__query({
  "job": {
    "$": { "id": "<jobId>" },
    "tasks": {
      "$": { "size": 50 },
      "nodes": {
        "id": {}, "name": {}, "startDate": {}, "endDate": {},
        "progress": {}
      }
    }
  }
})
```

### Step 4: Query Google Drive

Search for procurement-related files:
```
mcp__Google_Drive__search_files({
  "query": "fullText contains '<projectName>' and (fullText contains 'purchase order' or fullText contains 'PO' or fullText contains 'submittal' or fullText contains 'approval' or fullText contains 'contract' or fullText contains 'insurance' or fullText contains 'bond' or fullText contains 'NTP')",
  "pageSize": 10,
  "snippetVerbosity": "BRIEF"
})
```

Map Drive files to procurement entries:
- Files with "PO" or "purchase order" → `vendorOrder`
- Files with "submittal" → `submittal`
- Files with "approval" → `approval`
- Files with "contract" → `contract`
- Files with "insurance" or "COI" → `insurance`
- Files with "bond" → `bond`
- Files with "NTP" or "notice to proceed" → `notice`

Use the file's `modifiedTime` or `createdTime` as the entry date.

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

Map Lightfield records to procurement entries where relevant (e.g., closed opportunities = contracts, completed tasks = approvals).

### Step 6: Query Gmail (Optional)

Search for procurement-related emails:
```
mcp__Gmail__search_threads({
  "query": "subject:(<projectName>) AND (purchase order OR PO OR submittal OR approval OR NTP)",
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

### Step 8: Generate Output

Produce a JSON payload in this format:

```json
{
  "project": "Project Name",
  "jobId": "JobTread Job ID",
  "auditDate": "2026-10-06",
  "sources": ["JobTread", "Google Drive", "Lightfield"],
  "entries": [
    {
      "name": "Procurement: Purchase Order Issued — Millwork PO",
      "date": "2025-09-24",
      "source": "JobTread",
      "documentType": "vendorOrder",
      "documentName": "Purchase Order",
      "duration": 1,
      "trade": "Procurement"
    },
    {
      "name": "Procurement: Customer Order Received — NTXP PROPOSAL",
      "date": "2025-08-07",
      "source": "JobTread",
      "documentType": "customerOrder",
      "documentName": "NTXP PROPOSAL",
      "duration": 1,
      "trade": "Procurement"
    }
  ]
}
```

### Step 9: Push to JobTread (Optional)

If the user wants to push procurement tasks to JobTread's schedule:

```
mcp__JobTread__query({
  "createTask": {
    "$": {
      "input": {
        "name": "Procurement: Purchase Order Issued — [name]",
        "startDate": "<date>",
        "endDate": "<date>",
        "targetId": "<jobId>"
      }
    },
    "id": {}
  }
})
```

Group procurement tasks under a parent "Procurement" task if possible using `parentTaskId`.

## Output Format

Always output the JSON payload to the user so they can:
1. Copy/paste it into the BidForge Schedules Procurement panel
2. Save it as a `.json` file for import
3. Review before pushing to JobTread

## Deduplication

Before generating entries:
- Deduplicate across sources (same document found in both JobTread and Drive)
- Match by document name, date, and type
- Prefer JobTread as the authoritative source for document data
- Prefer Drive/Gmail for supplementary documents not tracked in JobTread

## Error Handling

- If a connector is unavailable, skip it and note the gap in the output
- If no project match is found, list available jobs and ask the user
- Never expose API tokens or credentials in output
