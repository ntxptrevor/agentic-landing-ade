# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this repository is

This is a **Claude Code plugin marketplace** named `agentic-landing-ade`. It ships
two skills plus a standalone React web app. It is *not* a single application — it
is a distribution package for Claude Code extensions.

The repository contains three distinct deliverables:

1. **`landing-ade` skill** — an interactive document-extraction wizard wrapping
   LandingAI's Agentic Document Extraction (ADE) REST API (parse / extract / split / async parse jobs).
2. **`bidforge-schedules` skill** — an interactive construction Work Breakdown
   Structure (WBS) schedule generator that builds on the same ADE API, plus
   critical-path scheduling and multi-format export.
3. **`web/` BidForge Schedules app** — a React + Vite single-page app that
   implements the BidForge wizard as a GUI. Its production build is checked in
   under `docs/` for static deployment.

## Starting new work: create a new repo by default

When a new program, skill, or project is requested, **default to creating a new,
dedicated repository for it** rather than adding it to this repo.

- If a new conversation begins with no context tying the work to an existing
  repository, **automatically create a new repo** for it.
- Only package the new work into an existing repository (this one or another)
  when the user **explicitly confirms** that the skill or development is related
  to that existing repo and should live alongside it.
- When in doubt, ask whether the work belongs in an existing repo; if no answer
  or context is given, create a new repo.

This keeps unrelated programs cleanly separated and prevents this marketplace
repo from accumulating unrelated code.

## Repository layout

```
.
├── .claude-plugin/
│   ├── marketplace.json     # Marketplace manifest: lists both plugins for discovery
│   └── plugin.json          # Plugin manifest: registers the two skills + paths
├── skills/
│   ├── landing-ade/SKILL.md         # ADE document-extraction skill (curl-based wizard)
│   └── bidforge-schedules/SKILL.md  # Construction WBS schedule generator skill
├── web/                     # React + Vite source for the BidForge Schedules app
│   ├── src/
│   │   ├── App.jsx          # Top-level wizard state machine (5 steps)
│   │   ├── components/      # One component per wizard step + view renderers
│   │   ├── utils/           # scheduler.js (CPM), exporters.js, dateUtils.js
│   │   └── data/            # constructionPhases.js (phase/task domain data)
│   ├── package.json         # name: bidforge-schedules, type: module
│   └── vite.config.js
├── docs/                    # Checked-in production build (Hostinger Git deploy)
│   ├── index.html
│   └── assets/              # Hashed JS/CSS bundles
├── README.md                # End-user install + usage docs for the plugins
└── LICENSE                  # MIT
```

## The two manifests must stay in sync

When you add, rename, or re-version a skill, update **both** manifest files:

- `.claude-plugin/marketplace.json` — the `plugins[]` array (name, description,
  version, author, category, tags, homepage). This is what `claude plugin
  marketplace add` reads.
- `.claude-plugin/plugin.json` — the `skills[]` array (name, description, `path`).
  Paths point at `skills/<name>/SKILL.md`.

Skill descriptions in the manifests should match the intent of the skill's
own frontmatter `description`. Versions are currently `1.0.0` for both plugins.

## Skills: conventions to follow

Both `SKILL.md` files are the source of truth for how the skills behave. Each
begins with YAML frontmatter (`name`, `description`) — the `description` is the
trigger contract that tells Claude when to activate the skill, so keep it
specific and keyword-rich.

Hard rules shared by both skills (do not violate when editing them):

- **Never write Python.** All API calls use `curl` via Bash; all file work uses
  Bash (`jq`, `grep`, `head`, `tail`, `wc`).
- **Auth is `Authorization: Bearer $API_KEY`**, never Basic.
- **Use `-F` (multipart form)**, never `-d` (JSON body), for ADE calls.
- **Parse before extract/split.** The `/extract` and `/split` endpoints accept
  *markdown* (field names `markdown`), not raw files. Only `/parse` accepts a
  raw `document`.
- **Never read full ADE output files into context.** Parse output is ~55k tokens
  *per page*. Always pipe `curl ... | jq . > output.json` and then show a small
  `jq` summary. Do not use the Read tool on parse/extract/split output files.
- **Collect all configuration via `AskUserQuestion`** before executing — these
  are guided wizards, not silent automations.

API key environment variables:

- `landing-ade` uses `VISION_AGENT_API_KEY`.
- `bidforge-schedules` prefers `LANDING_AI_API_KEY`, falling back to
  `VISION_AGENT_API_KEY`.

ADE regions: US → `https://api.va.landing.ai`, EU →
`https://api.va.eu-west-1.landing.ai`. Models: `dpt-2-latest` (parse),
`extract-latest`, `split-latest`.

The `bidforge-schedules` skill additionally encodes a critical-path-method (CPM)
algorithm (forward/backward pass, float, critical path), a canonical
`bidforge-schedule-v1` JSON data model, ASCII Gantt/list/calendar renderers,
four export formats (JSON, CSV, Markdown, MS Project XML), and a body of
construction domain knowledge (standard phases, typical durations, dependency
patterns, CSI MasterFormat division mapping). The web app is the GUI
implementation of this same logic — keep the two conceptually aligned (data
model, phases, export formats, scheduling rules).

## Web app: development workflow

The web app is a plain React 18 + Vite 6 SPA. There is **no test suite, linter,
or TypeScript** configured — keep changes consistent with the existing plain-JS,
function-component style.

```bash
cd web
npm install        # install deps (node_modules is gitignored)
npm run dev        # Vite dev server with HMR
npm run build      # production build → web/dist/ (gitignored)
npm run preview    # serve the production build locally
```

Architecture:

- `App.jsx` is a step-based state machine. `STEPS` defines the five wizard
  stages (`setup → phases → tasks → review → view`). All shared state
  (`project`, `selectedPhaseIds`, `computed`) lives here and flows down via props
  and callbacks. There is no router and no external state library.
- `components/` holds one component per wizard step (`ProjectSetup`,
  `PhaseSelection`, `TaskEditor`, `ReviewGenerate`) plus the view renderers
  (`ScheduleViewer`, `GanttChart`, `ListView`, `CalendarView`, `ExportPanel`).
- `utils/scheduler.js` — `calculateSchedule(project)` runs the CPM passes;
  `detectCircularDependencies(tasks)` guards against dependency cycles.
- `utils/dateUtils.js` — working-day arithmetic (skips weekends + holidays),
  date formatting/parsing, `getUSFederalHolidays(year)`.
- `utils/exporters.js` — `exportJSON`, `exportCSV`, `exportMSProjectXML`,
  and the `downloadFile` browser helper.
- `data/constructionPhases.js` — `CONSTRUCTION_PHASES`, the seed phase/task data.

Conventions in this codebase: ES modules (`type: "module"`), `.jsx` extensions
in imports, function components with hooks (`useState`, `useCallback`), no CSS
framework (`index.css` + inline styles). Durations are stored internally in
**working days**.

## Deploying the web app (docs/)

`docs/` contains a **committed production build** used for static hosting
(Hostinger Git deploy, per the commit history). The asset references in
`docs/index.html` are **root-absolute** (`/assets/...`), so the site is served
from a domain root, not a subpath.

To refresh the deployed site after changing `web/`:

```bash
cd web && npm run build      # produces web/dist/
# then copy web/dist/* into docs/ (index.html + assets/), replacing old hashed bundles
```

Because the asset filenames are content-hashed, replacing `docs/` wholesale (not
merging) avoids leaving stale bundles behind. If you change the deploy target to
a subpath, set Vite's `base` in `web/vite.config.js` accordingly — it is
currently unset (defaults to `/`).

## Git workflow

- Work on the branch you were assigned; create it locally if needed. Do not push
  to other branches without explicit permission.
- Push with `git push -u origin <branch>`; after pushing, open a **draft** PR if
  one does not already exist.
- Commit messages in history are short, imperative, and scope-prefixed by area
  (e.g. "Add NTXP BidForge Schedules skill...", "Add production build to docs/...").
  Match that style.

## Quick orientation for common tasks

| Task | Where to look |
| --- | --- |
| Change ADE API behavior / curl commands | `skills/landing-ade/SKILL.md` |
| Change construction scheduling logic or domain data (skill) | `skills/bidforge-schedules/SKILL.md` |
| Change the scheduling GUI | `web/src/` |
| Fix CPM / critical-path math (app) | `web/src/utils/scheduler.js` |
| Add/adjust an export format (app) | `web/src/utils/exporters.js` |
| Register a new skill / change versions | both files in `.claude-plugin/` |
| Update the deployed site | `web/` build → `docs/` |
| End-user install/usage instructions | `README.md` |
