# Pave Query Templates (JobTread)

Copy-paste Pave selection trees for common JobTread reads and writes. All run
against `POST https://api.jobtread.com/pave` with
`Content-Type: application/json`. Build the request body with `jq -n` so the
grant key is injected from `$JOBTREAD_GRANT_KEY` and JSON is escaped correctly.

Shared shell setup (from SKILL.md):

```bash
PAVE_URL="https://api.jobtread.com/pave"
OUT=./jobtread_out; mkdir -p "$OUT"
# JOBTREAD_GRANT_KEY and ORG_ID assumed set (see SKILL.md Steps 1–2)
```

A reusable helper that posts a JSON body string and saves the result:

```bash
pave() {  # usage: pave '<json body>' <outfile>
  curl -s -X POST "$PAVE_URL" -H "Content-Type: application/json" \
    -d "$1" | jq . > "$2"
  jq '.errors // empty' "$2"   # surfaces errors if any
}
```

---

## 1. Verify grant + list organizations

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" '{
  query: { "$": { grantKey: $gk },
    currentGrant: {
      id: {}, user: { id: {}, name: {}, email: {} },
      memberships: { nodes: { id: {}, organization: { id: {}, name: {} } } }
    } } }')" "$OUT/grant.json"
```

## 2. List jobs (paginated, newest first)

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" '{
  query: { "$": { grantKey: $gk },
    organization: { "$": { id: $org }, id: {}, name: {},
      jobs: {
        "$": { size: 25, sortBy: [{ field: "createdAt", order: "desc" }] },
        count: {}, nextPage: {},
        nodes: {
          id: {}, name: {}, number: {}, createdAt: {}, closedOn: {},
          location: { id: {}, name: {}, address: {} },
          account:  { id: {}, name: {} }
        } } } } }')" "$OUT/jobs.json"
```

Next page — pass the prior `nextPage` value into `$.page`:

```bash
PAGE=$(jq -r '.organization.jobs.nextPage' "$OUT/jobs.json")
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" --arg p "$PAGE" '{
  query: { "$": { grantKey: $gk },
    organization: { "$": { id: $org },
      jobs: { "$": { size: 25, page: $p,
                     sortBy: [{ field: "createdAt", order: "desc" }] },
        nextPage: {}, nodes: { id: {}, name: {}, number: {} } } } } }')" \
  "$OUT/jobs_p2.json"
```

## 3. Only open jobs (filter with `where`)

`where` is a list of `[field, operator, value]` triples (implicitly ANDed).
Operators include `=`, `!=`, `>`, `>=`, `<`, `<=`, `like`, `in`.

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" '{
  query: { "$": { grantKey: $gk },
    organization: { "$": { id: $org },
      jobs: { "$": { size: 50, where: [["closedOn", "=", null]] },
        count: {}, nodes: { id: {}, name: {}, number: {} } } } } }')" \
  "$OUT/open_jobs.json"
```

## 4. One job with documents and line items

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg job "$JOB_ID" '{
  query: { "$": { grantKey: $gk },
    job: { "$": { id: $job },
      id: {}, name: {}, number: {},
      documents: { "$": { size: 25 },
        nodes: {
          id: {}, type: {}, status: {}, issueDate: {},
          lineItems: { nodes: {
            id: {}, name: {}, quantity: {}, unitCost: {}, unitPrice: {} } }
        } } } } }')" "$OUT/job_documents.json"
```

## 5. List accounts (customers & vendors) with contacts

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" '{
  query: { "$": { grantKey: $gk },
    organization: { "$": { id: $org },
      accounts: { "$": { size: 50 },
        count: {}, nextPage: {},
        nodes: {
          id: {}, name: {}, type: {},
          contacts: { nodes: { id: {}, name: {}, email: {}, phone: {} } }
        } } } } }')" "$OUT/accounts.json"
```

## 6. Tasks for a job

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg job "$JOB_ID" '{
  query: { "$": { grantKey: $gk },
    job: { "$": { id: $job }, id: {}, name: {},
      tasks: { "$": { size: 100, sortBy: [{ field: "startDate", order: "asc" }] },
        nodes: {
          id: {}, name: {}, startDate: {}, endDate: {}, progress: {},
          assignedTo: { nodes: { id: {}, name: {} } }
        } } } } }')" "$OUT/job_tasks.json"
```

## 7. Daily logs for a job

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg job "$JOB_ID" '{
  query: { "$": { grantKey: $gk },
    job: { "$": { id: $job }, id: {},
      dailyLogs: { "$": { size: 50, sortBy: [{ field: "date", order: "desc" }] },
        nodes: { id: {}, date: {}, notes: {},
          createdByUser: { id: {}, name: {} } } } } } }')" \
  "$OUT/daily_logs.json"
```

## 8. Custom field values (on a job)

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg job "$JOB_ID" '{
  query: { "$": { grantKey: $gk },
    job: { "$": { id: $job }, id: {}, name: {},
      customFieldValues: { nodes: {
        value: {}, customField: { id: {}, name: {}, type: {} } } } } } }')" \
  "$OUT/job_custom_fields.json"
```

## 9. Search jobs by free text

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" --arg q "kitchen" '{
  query: { "$": { grantKey: $gk },
    organization: { "$": { id: $org },
      jobs: { "$": { size: 25, search: $q },
        count: {}, nodes: { id: {}, name: {}, number: {} } } } } }')" \
  "$OUT/job_search.json"
```

---

## Writes (confirm the payload with the user first)

> Exact input/return field names per object are authoritative in the
> interactive explorer at https://app.jobtread.com/docs. If a mutation errors
> on an unknown argument, check there (or use the JobTread MCP
> `jobtread_create_*` / `jobtread_update_*` tools, which encode the right
> fields). Add `notify: false` to the top-level `$` to suppress notifications
> during bulk writes.

## 10. Create a job

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" \
      --arg name "123 Main St Remodel" --arg loc "$LOCATION_ID" '{
  query: { "$": { grantKey: $gk },
    createJob: { "$": { organizationId: $org, name: $name, locationId: $loc },
      createdJob: { id: {}, name: {}, number: {} } } } }')" \
  "$OUT/create_job.json"
```

## 11. Create a customer (account) + contact

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg org "$ORG_ID" \
      --arg name "Acme Homes" '{
  query: { "$": { grantKey: $gk },
    createAccount: { "$": { organizationId: $org, name: $name, type: "customer" },
      createdAccount: { id: {}, name: {}, type: {} } } } }')" \
  "$OUT/create_account.json"
```

## 12. Update a job field

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg id "$JOB_ID" \
      --arg name "Updated Job Name" '{
  query: { "$": { grantKey: $gk },
    updateJob: { "$": { id: $id, name: $name },
      job: { id: {}, name: {} } } } }')" "$OUT/update_job.json"
```

## 13. Create a task on a job

```bash
pave "$(jq -n --arg gk "$JOBTREAD_GRANT_KEY" --arg job "$JOB_ID" \
      --arg name "Order materials" --arg start "2026-06-15" --arg end "2026-06-16" '{
  query: { "$": { grantKey: $gk },
    createTask: { "$": { jobId: $job, name: $name, startDate: $start, endDate: $end },
      createdTask: { id: {}, name: {}, startDate: {}, endDate: {} } } } }')" \
  "$OUT/create_task.json"
```

---

## Export patterns

Append every page's nodes to a newline-delimited JSON file, then convert:

```bash
# After each page call:
jq -c '.organization.jobs.nodes[]' "$OUT/jobs.json" >> "$OUT/all_jobs.ndjson"

# To CSV (id, number, name):
jq -r '[.id, .number, .name] | @csv' "$OUT/all_jobs.ndjson" > "$OUT/jobs.csv"
```

Loop until `nextPage` is null to capture the full set.
