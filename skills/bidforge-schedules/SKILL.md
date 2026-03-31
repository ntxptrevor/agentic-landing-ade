---
name: bidforge-schedules
description: Use when the user mentions construction scheduling, WBS generation, bid document schedule extraction, Gantt charts for construction, project scheduling from bid packages, BidForge, or wants to create a work breakdown structure from construction documents
---

# NTXP BidForge Schedules

Generate construction Work Breakdown Structure (WBS) schedules from bid documents, plans, and specifications using LandingAI document extraction and an interactive wizard-style configuration.

## When to Use

- User wants to generate a construction schedule or WBS from bid documents
- User wants to create a Gantt chart, list view, or calendar view from construction plans
- User wants to extract schedule data from PDFs of bid packages, specs, or plans
- User mentions BidForge, construction scheduling, or WBS generation
- User wants to export a schedule as JSON, CSV, Markdown, or MS Project XML

## Prerequisites

Before starting, verify the API key is available:

```bash
if [ -z "$LANDING_AI_API_KEY" ] && [ -z "$VISION_AGENT_API_KEY" ]; then
  echo "ERROR: No API key set. Set LANDING_AI_API_KEY or VISION_AGENT_API_KEY"
fi
```

Use `$LANDING_AI_API_KEY` if set, otherwise fall back to `$VISION_AGENT_API_KEY`.

## CRITICAL RULES

1. **Always use `AskUserQuestion` for wizard steps.** Never assume user preferences.
2. **Auth is Bearer, not Basic.** Header: `Authorization: Bearer $API_KEY`
3. **Parse documents before extracting schedule data.** Raw PDFs must go through ADE parse first.
4. **Duration is always in working days** internally. Convert at display time.
5. **Never read full ADE output files into context.** Pipe to file and use `jq` summaries.
6. **Never write Python.** Always use curl for API calls and Bash for file operations.

## TOKEN WARNINGS

ADE parse output is ~55,000 tokens per page. Always:
- Pipe curl output to a file: `| jq . > output.json`
- Show a small `jq` summary after each operation
- Never use the Read tool on parse output files
- Use `jq`, `grep`, `head`, `tail` to query output files

## Entry Points

### Full Wizard (default)
Invoked with `/bidforge-schedules`. Runs the complete flow: document scanning → wizard → schedule generation → view rendering → export.

### From Existing Data
Invoked with `/bidforge-schedules --from-json <path>`. Loads a previously saved BidForge schedule JSON and allows modification or re-rendering.

### View Only
Invoked with `/bidforge-schedules --view <gantt|list|calendar> <path>`. Renders an existing BidForge schedule JSON in the requested format.

---

## Phase 1: Document Scanning

Reuses the LandingAI ADE API with the same curl patterns as the `landing-ade` skill.

### Step 1: Upload and Parse Document

```bash
curl -s -X POST "${BASE_URL}/v1/ade/parse" \
  -H "Authorization: Bearer ${API_KEY}" \
  -F "document=@/path/to/document.pdf" \
  -F "model=dpt-2-latest" | jq . > ${OUTPUT_DIR}/parse_output.json
```

For URL input: replace `-F "document=@..."` with `-F "document_url=https://..."`.

| Region | Base URL                              |
| ------ | ------------------------------------- |
| US     | `https://api.va.landing.ai`           |
| EU     | `https://api.va.eu-west-1.landing.ai` |

### Step 2: Show Summary

```bash
jq '{md_preview: (.markdown | .[0:500]), chunks: (.chunks | length), types: ([.chunks[].type] | unique), metadata: .metadata}' parse_output.json
```

### Step 3: Extract Schedule-Relevant Data

After receiving parsed document text, analyze the extracted content and identify:

- **Task indicators**: action verbs, work item descriptions, CSI division references
- **Duration indicators**: numeric values followed by time units ("days", "weeks", "calendar days", "working days")
- **Sequence indicators**: "after", "following", "prior to", "concurrent with", "upon completion of"
- **Milestone indicators**: "substantial completion", "final inspection", "certificate of occupancy", "notice to proceed"
- **Phase indicators**: section headers, division numbers, scope groupings

Build an intermediate extraction structure:

```json
{
  "extractedItems": [
    {
      "text": "Install structural steel framing",
      "source": "filename.pdf, page 12",
      "suggestedPhase": "Structural",
      "suggestedDuration": "15d",
      "durationConfidence": "medium",
      "sequenceHints": ["after foundation complete"],
      "tradeCategory": "Structural Steel"
    }
  ]
}
```

---

## Phase 2: Interactive Wizard

Use `AskUserQuestion` for each step. The wizard has five sub-phases.

### Step A: Project Setup

**A1 — Project Name:**
Ask: "What is the project name?"
Type: freeform text.

**A2 — Project Start Date:**
Ask: "What is the project start date? (YYYY-MM-DD)"
Default suggestion: today's date.

**A3 — Working Days:**
Ask: "Which days are working days?"
Options:
1. Mon–Fri (standard 5-day)
2. Mon–Sat (6-day)
3. Custom (specify days)

**A4 — Holidays:**
Ask: "Do you want to specify any holidays or non-working periods?"
Options:
1. No holidays
2. US Federal holidays for the project year
3. Custom holiday list (provide dates)

**A5 — Working Hours:**
Ask: "How many working hours per day? (default: 8)"
Type: freeform with numeric validation.

### Step B: Document Scanning

**B1 — Document Source:**
Ask: "Do you have construction documents to scan for schedule data?"
Options:
1. Yes — scan documents now
2. No — I'll enter everything manually
3. I have a previous BidForge JSON to load

If option 1:

**B2 — Document Paths:**
Ask: "Provide the path(s) to your construction documents (PDF, images). You can provide multiple paths separated by commas, or a directory path to scan all documents within it."

**B3 — Document Type Classification (per document):**
Ask: "I found [filename]. What type of document is this?"
Options:
1. Bid Package / Scope of Work
2. Project Plans / Drawings
3. Specifications (CSI format)
4. Project Schedule (existing)
5. Contract / Agreement

**B4 — Extraction Review:**
Ask: "I extracted the following schedule-relevant items from your documents: [list items]. How would you like to proceed?"
Options:
1. Accept all extracted items
2. Review and edit items one by one
3. Accept but add more items manually
4. Discard and enter manually

### Step C: WBS Structure Definition

**C1 — Phase Selection:**
Ask: "Select the construction phases for this project (comma-separated numbers, or 'all'):"
Options presented as a numbered list:
1. Pre-Construction (permits, submittals, procurement)
2. Site Work (demolition, grading, utilities)
3. Foundation (excavation, formwork, concrete)
4. Structural (steel/wood framing, roofing)
5. MEP Rough-In (mechanical, electrical, plumbing rough)
6. Exterior Envelope (sheathing, windows, siding/masonry)
7. Interior Rough (insulation, drywall, rough carpentry)
8. Interior Finish (paint, flooring, trim, fixtures)
9. MEP Finish (fixtures, equipment, testing)
10. Commissioning & Testing
11. Closeout (punch list, final inspections, turnover)
12. Custom phase (specify)

**C2 — Per-Phase Task Review (repeat for each selected phase):**
Ask: "Phase: [Phase Name]. I suggest the following tasks based on your documents and standard construction sequences: [task list]. Options:"
1. Accept these tasks
2. Add tasks to this phase
3. Remove tasks from this phase
4. Edit task details

**C3 — Task Duration Entry (for tasks without durations):**
Ask: "Task: [Task Name] under [Phase Name]. What is the estimated duration? (e.g., '5d' for 5 days, '2w' for 2 weeks, '1m' for 1 month)"

Parse durations: `d` = days, `w` = weeks (×5 working days), `m` = months (×22 working days).

**C4 — Dependency Definition:**
Ask: "Define dependencies for [Task Name]. Current tasks: [numbered list]. Enter predecessor task numbers (comma-separated), or 'none'. Dependency types: FS (finish-to-start, default), SS, FF, SF. Example: '3FS, 5FS+2d'"

**C5 — Milestone Definition:**
Ask: "Would you like to add milestones?"
Options:
1. Auto-generate milestones (phase completions)
2. Add custom milestones
3. Both auto and custom
4. No milestones

### Step D: Trade Sequencing

**D1 — Trade Overlap Strategy:**
Ask: "How should construction trades overlap?"
Options:
1. Sequential (each trade completes before next starts) — safest
2. Fast-track (trades overlap where possible) — aggressive
3. Custom (I'll define overlaps per phase)

**D2 — Resource Constraints:**
Ask: "Do you want to define any resource constraints (e.g., single crew, limited crane time)?"
Options:
1. No constraints
2. Yes, let me define constraints

### Step E: Review and Generate

**E1 — Schedule Summary Review:**
Present summary:
- Project name, start date, calculated end date
- Number of phases, tasks, milestones
- Critical path duration
- Total calendar duration

Ask: "Proceed with schedule generation?"
Options:
1. Generate schedule
2. Go back and edit
3. Save current configuration and exit

**E2 — Output Format Selection:**
Ask: "How would you like to view the schedule?"
Options:
1. Gantt chart (ASCII)
2. Hierarchical list view
3. Calendar view
4. All three views

**E3 — Export Options:**
Ask: "Would you like to export the schedule?"
Options:
1. Save as JSON (re-importable)
2. Save as CSV
3. Save as Markdown
4. Save as Microsoft Project XML

---

## Phase 3: Schedule Calculation

After the wizard completes, perform all calculations within Claude's reasoning.

### Forward Pass (Early Start / Early Finish)

1. Tasks with no predecessors start at the project start date.
2. For each task: Early Start = max(Early Finish of all predecessors + lag).
3. Early Finish = Early Start + duration (counting only working days, skipping holidays and non-working days).

### Backward Pass (Late Start / Late Finish)

1. Project end = max(Early Finish of all tasks).
2. Late Finish of tasks with no successors = project end.
3. Late Start = Late Finish − duration.
4. For tasks with successors: Late Finish = min(Late Start of all successors − lag).

### Critical Path

- Float = Late Start − Early Start.
- Critical path = all tasks where Float = 0.
- Mark `isCritical: true` on these tasks.

### Date Arithmetic Rules

- Skip weekends based on `workingDays` configuration.
- Skip holidays from the holiday list.
- Duration always means working days unless explicitly marked as calendar days.
- Lag values follow the same working-day convention.

### Circular Dependency Detection

Before calculating, check for circular dependencies. If found, warn the user and ask them to correct the dependency chain.

---

## Phase 4: View Rendering

### Gantt Chart (ASCII)

Design for 120-character terminal width. Left label column (40 chars) + right timeline region (80 chars).

```
NTXP BidForge Schedule: [Project Name]
Start: YYYY-MM-DD  End: YYYY-MM-DD  Duration: N working days
Critical Path: N working days
═══════════════════════════════════════════════════════════════════════════════════
                                        Month YYYY        Month YYYY
WBS  Task                          Dur  |···|···|···|···|···|···|···|···|···|···|
─────────────────────────────────────────────────────────────────────────────────
1    PRE-CONSTRUCTION
1.1  ├─ Permit Acquisition         10d  ████████░░
1.2  ├─ Submittal Review            5d       ░░░░░█████
1.3  └─ Material Procurement       15d            █████████████████
                                                        ▲ M1: Permits Approved
2    SITE WORK
2.1  ├─ Mobilization                3d                   ███
2.2  ├─ Demolition                  8d                      █████████
2.3  └─ Grading                     5d                               ██████
─────────────────────────────────────────────────────────────────────────────────
Legend: ████ = critical path  ░░░░ = non-critical  ▲ = milestone  * = continues
```

Rules:
- Each character represents N calendar days (auto-calculated to fit 80 columns).
- `█` (full block) for critical path tasks, `░` (light shade) for non-critical.
- `▲` for milestones placed at their date position.
- `*` when a bar extends beyond the visible range.
- Phase names in CAPS, tasks with tree characters (`├─`, `└─`).
- If project exceeds displayable range, split into multiple pages.

### Hierarchical List View

```markdown
# WBS Schedule: [Project Name]
**Start:** YYYY-MM-DD | **End:** YYYY-MM-DD | **Duration:** N working days

## 1. Pre-Construction
   **Start:** YYYY-MM-DD | **End:** YYYY-MM-DD | **Duration:** N days

   1.1 Permit Acquisition                    10d  YYYY-MM-DD → YYYY-MM-DD  [CRITICAL]
       1.1.1 Submit permit application        1d  YYYY-MM-DD → YYYY-MM-DD  [CRITICAL]
   1.2 Submittal Review                       5d  YYYY-MM-DD → YYYY-MM-DD
       Depends on: 1.1 (FS)
       ▲ MILESTONE: Permits Approved              YYYY-MM-DD
```

Rules:
- Markdown format for readability.
- Two-level indentation matching WBS hierarchy.
- `[CRITICAL]` tag on critical path items.
- Dependency notes below tasks with predecessors.
- Milestone lines with triangle marker.

### Calendar View

```
═══════════════════════════════════════════════════════════
                    MONTH YYYY
═══════════════════════════════════════════════════════════
 Mon       Tue       Wed       Thu       Fri       Sat/Sun
───────────────────────────────────────────────────────────
                     1         2         3         4-5
                     ►1.1      1.1       1.1
                     START

 6         7         8         9         10        11-12
 1.1       1.1       1.1       1.1       1.1
                     ►1.2      1.2       ►1.3
───────────────────────────────────────────────────────────
► = task start  * = task end  ▲ = milestone
Active tasks shown by WBS code. Critical path tasks in CAPS.
```

Rules:
- One month per page.
- Mon–Fri grid, weekends collapsed to one column.
- `►` marks task start, `*` marks task end.
- Milestones shown with `▲` and name.
- Critical path task IDs in uppercase.
- Non-working days (holidays) shown with `[OFF]`.

---

## Phase 5: Export

### JSON Export

Save the full WBS data model as `<project-name>-schedule.json`. This is the canonical re-importable format.

### CSV Export

Flat table, one row per task/subtask:

```csv
WBS Code,Task Name,Phase,Duration (days),Start Date,End Date,Predecessors,Is Critical,Is Milestone,Trade,Notes
1.1,Permit Acquisition,Pre-Construction,10,2026-04-01,2026-04-14,,Yes,No,General,
```

Save as `<project-name>-schedule.csv`.

### Markdown Export

The List View format from Phase 4, saved as `<project-name>-schedule.md`.

### Microsoft Project XML Export

Minimal MS Project XML format compatible with `.xml` import:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Project Name</Name>
  <StartDate>YYYY-MM-DDT08:00:00</StartDate>
  <FinishDate>YYYY-MM-DDT17:00:00</FinishDate>
  <Tasks>
    <Task>
      <UID>1</UID>
      <Name>Task Name</Name>
      <OutlineLevel>1</OutlineLevel>
      <WBS>1</WBS>
      <Start>YYYY-MM-DDT08:00:00</Start>
      <Finish>YYYY-MM-DDT17:00:00</Finish>
      <Duration>PT80H0M0S</Duration>
      <Summary>1</Summary>
    </Task>
  </Tasks>
</Project>
```

Key mappings:
- Duration in ISO 8601 format (PT{hours}H).
- Dependency type: 0=FF, 1=FS, 2=SF, 3=SS.
- OutlineLevel: 1=phase, 2=task, 3=subtask.
- Summary=1 for phase-level items.

Save as `<project-name>-schedule.xml`.

---

## Data Schema

The canonical JSON format for BidForge schedules:

```json
{
  "$schema": "bidforge-schedule-v1",
  "project": {
    "name": "string",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD (calculated)",
    "workingDays": ["Mon","Tue","Wed","Thu","Fri"],
    "hoursPerDay": 8,
    "holidays": ["YYYY-MM-DD"],
    "calendarDuration": 0,
    "workingDuration": 0,
    "criticalPathDuration": 0
  },
  "wbs": [
    {
      "id": "1",
      "type": "phase",
      "name": "Phase Name",
      "wbsCode": "1",
      "children": [
        {
          "id": "1.1",
          "type": "task",
          "name": "Task Name",
          "wbsCode": "1.1",
          "duration": 10,
          "durationUnit": "days",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "predecessors": [],
          "successors": ["1.2"],
          "isMilestone": false,
          "isCritical": true,
          "percentComplete": 0,
          "trade": "General",
          "notes": "",
          "resources": [],
          "children": []
        }
      ]
    }
  ],
  "milestones": [
    {
      "id": "M1",
      "name": "Milestone Name",
      "date": "YYYY-MM-DD",
      "linkedTaskId": "1.1",
      "type": "phase_completion"
    }
  ],
  "dependencies": [
    {
      "from": "1.1",
      "to": "1.2",
      "type": "FS",
      "lag": 0,
      "lagUnit": "days"
    }
  ],
  "metadata": {
    "createdAt": "ISO-8601",
    "modifiedAt": "ISO-8601",
    "version": "1.0",
    "sourceDocuments": []
  }
}
```

Key design decisions:
- **Flat dependency array** plus inline predecessors/successors for easy traversal.
- **Three-level hierarchy**: phase → task → subtask.
- **WBS codes** follow dotted notation (1, 1.1, 1.1.1).
- **Duration always in working days** internally.
- **Critical path flag** on each task for highlighting in views.

---

## Construction Domain Knowledge

Standard construction phases with typical tasks and durations for reference when making suggestions to the user.

### Standard Phases and Typical Tasks

**Pre-Construction:** Permit acquisition (10–45d), submittal review (5–15d), material procurement (15–60d), shop drawings (10–20d), site surveys (2–5d).

**Site Work:** Mobilization (2–5d), demolition (3–15d), clearing/grubbing (2–5d), grading (5–15d), erosion control (1–3d), temporary utilities (2–5d).

**Foundation:** Excavation (3–10d), formwork (5–10d), rebar placement (3–7d), concrete pour (1–3d), concrete cure (7–28d), backfill (2–5d), waterproofing (3–5d).

**Structural:** Steel erection (10–30d), wood framing (10–25d), roof decking (5–10d), roofing (5–15d), structural inspections (1–2d).

**MEP Rough-In:** Plumbing rough (10–20d), electrical rough (10–20d), HVAC rough (10–20d), fire protection (5–15d), MEP inspections (1–3d).

**Exterior Envelope:** Sheathing (5–10d), windows/doors (5–10d), siding/masonry (10–25d), flashing/waterproofing (3–7d).

**Interior Rough:** Insulation (3–7d), drywall hang (5–12d), drywall finish (5–10d), rough carpentry (3–7d).

**Interior Finish:** Prime/paint (5–15d), flooring (5–12d), trim/millwork (5–10d), cabinets/countertops (3–7d), fixtures/hardware (3–5d).

**MEP Finish:** Plumbing fixtures (3–7d), electrical fixtures/panels (3–7d), HVAC equipment (3–7d), controls/testing (3–5d).

**Commissioning & Testing:** System startup (3–5d), balancing (3–5d), commissioning (5–10d), punch list (5–10d).

**Closeout:** Final inspections (2–5d), certificate of occupancy (1–5d), owner training (1–3d), project turnover (1–2d), warranty documentation (2–3d).

### Common Dependency Patterns

- Rough MEP always follows framing.
- Insulation follows MEP rough-in inspection.
- Drywall follows insulation inspection.
- Paint follows drywall finish.
- Flooring follows paint (or concurrent with trim).
- Inspections gate the next phase.
- Foundation must complete before structural.
- Roofing must complete before interior work.

### CSI MasterFormat Division Mapping

- Div 01: General Requirements → Pre-Construction
- Div 02: Existing Conditions → Site Work
- Div 03: Concrete → Foundation
- Div 04: Masonry → Exterior Envelope / Structural
- Div 05: Metals → Structural
- Div 06: Wood/Plastics/Composites → Structural / Interior
- Div 07: Thermal/Moisture Protection → Exterior Envelope
- Div 08: Openings → Exterior Envelope
- Div 09: Finishes → Interior Finish
- Div 21: Fire Suppression → MEP Rough-In
- Div 22: Plumbing → MEP Rough-In / MEP Finish
- Div 23: HVAC → MEP Rough-In / MEP Finish
- Div 26: Electrical → MEP Rough-In / MEP Finish
- Div 31: Earthwork → Site Work
- Div 32: Exterior Improvements → Site Work
- Div 33: Utilities → Site Work

---

## Error Handling

1. **Circular dependencies:** Detect during dependency entry. Warn the user and ask them to correct.
2. **ADE API failures:** Retry once, then offer manual entry fallback.
3. **Impossible schedules:** Negative float from constraint violations. Report to user with details.
4. **Very large schedules:** If tasks exceed 200, suggest summarizing the Gantt view to phase-level bars only.
5. **Date parsing errors:** Always confirm interpreted dates back to user.
6. **File write failures:** Report error, offer to display the content for manual copy.
