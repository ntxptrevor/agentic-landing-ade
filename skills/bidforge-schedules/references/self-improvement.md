# Self-improvement, research, and memory

## Knowledge store (the "database")

Git-versioned Markdown + JSON inside this skill (`knowledge/`), in a public GitHub repo, mirrored
to the NTXP Forge master skill (`NTXP-TX/ntxp-forge` → `skills/bidforge-schedules/`). Chosen
because it is open source, cloud-hosted, diffable, reviewable by PR, readable by every model
without a driver, and each section versions independently.

```
knowledge/
  sections/<section-id>.md    # one per backbone phase, module, classification, routing, research topic
                               # frontmatter: id, version, updated, source; body: rules + table; ## Changelog
  lessons-learned.md           # dated, removable entries (LL-YYYY-MM-DD-NN)
  memory.md                    # "remember this / from now on" directives (global and per project)
  council/                     # prompts, seat outputs, merge reports, overrides, votes
  metrics/schedule-drift.jsonl # one line per project per sync (see below)
  research/<date>-<topic>.md   # research sweep reports
```

`scripts/export_sections.mjs` regenerates sections from the data files and bumps a section's
version only when its content hash changes, so improving one module never re-versions another.
Data files remain the executable truth; sections are the readable, versioned record.

## Metrics (logistics tier — Sonnet / Luna / DeepSeek / Grok, scripts first)

Per project, appended at each sync to `metrics/schedule-drift.jsonl`:
`{date, project, version, tasks, durationChanged, resequenced, added, removed, modulesAddedAfterStart, milestoneVarianceDays, reasons:[...]}`
— computed from the canonical changelog (no inference). Reasons come from changelog `reason`
fields, normalized by a cheap model into categories (owner change, design error, RFI, weather,
sub performance, lead time, inspection fail, spec rule missed, JEV default wrong).

## Improvement loop (`--improve`, or weekly routine)

1. **Collect** (logistics tier): read KB changelogs of all active projects and other BidForge
   instances, update metrics.
2. **Conclude** (frontier tier — Opus/Sol/Fable via router): find patterns, e.g. "drywall duration
   increased on 7/9 ISD jobs → default 10d is low", "abatement module added after start on 3 jobs
   → detection keyword missing", "TAS inspection always backfilled → belongs in backbone".
   Each conclusion becomes a proposed change with evidence, expected effect, and target
   (sequence, duration, classification, module, subroutine, skill cycle).
3. **Vote**: standard model council (`council_run`, `change_type: methodology`), each seat
   yes/no with logic, recorded verbatim in the entry.
   - **Overwhelming majority** (≥75% of voting seats and no seat flags a safety/contract risk;
     with 3 seats that means unanimous) → apply automatically.
   - Anything else → status `awaiting-user`; surface at the next skill use; **the user's answer
     is canon** and is recorded as such.
4. **Apply**: edit data files (or `anchor-overrides.json`, or this skill's text), run tests/build,
   regenerate sections, append the lessons-learned entry, commit to this repo and mirror to NTXP
   Forge.
5. **Audit**: each entry carries a measurable expectation. Later metrics that show a negative
   effect → propose removal (same vote), or the user removes it directly. Removal = revert the
   entry's diff and mark the entry `removed` (never delete history).

## Lessons-learned entry format

```
### LL-2026-10-13-03 — Add TDLR TAS registration and RAS inspection to backbone
Status: applied | awaiting-user | removed      Scope: backbone/preconstruction, backbone/closeout
Evidence: council seats A, B, C notes (2026-10-13)
Change: + "TDLR TAS Project Registration & RAS Plan Review" (parallel, precon)
        + "TDLR RAS Inspection (within 1 year of SC)" (closeout, no gate)
Expected effect: fewer backfilled TAS events in sync; no change to critical path length
Vote: A yes — …; B yes — …; C yes — …   (3/3, overwhelming)
Remove by: delete rows tagged lesson: 'LL-2026-10-13-03' in constructionPhases.js
```

## Research subroutine (`--research`, monthly routine; low/mid seats such as Grok, DeepSeek)

Topics rotate: renovation, ground-up, ISD, college, healthcare, high security, municipal, site
work, landscaping, MEP-specific, industrial equipment, light refresh, service call, minor remodel,
all-finishes, and JOC/CSP classifiers that change preconstruction subroutines. Output is a
research report in `knowledge/research/` and, if it suggests a change, a **proposal** that goes
through the vote above. Research seats never edit data files directly. Public sources only; no
project, owner or pricing data is sent to restricted seats.

## Memory directives

Triggers: "remember this", "save this to memory", "from now on", "going forward", "always …",
"never …". The app captures them (Input tab → Save to memory) into canonical `memory`; the agent
then:

- **Project scope** (default when the directive names this job) → project KB `## Schedule Memory`.
- **Global scope** (applies to all schedules) → `knowledge/memory.md`, and if it changes how the
  tree works, it becomes a lessons-learned entry with status `applied (user directive — canon)`;
  user directives skip the council vote.

Read `knowledge/memory.md` at initialization and apply it before the JEV defaults.
