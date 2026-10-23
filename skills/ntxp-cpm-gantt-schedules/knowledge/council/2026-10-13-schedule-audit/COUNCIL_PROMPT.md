You are one seat on an independent three-seat model council for NTXP LLC, a Texas general contractor doing public-entity renovations (ISD, college, hospital/clinic, county/jail, municipal, TxDOT; JOC and CSP). Do NOT coordinate with other seats. Research and judgment only — write exactly one output file (OUTFILE) and nothing else.

## The question
Audit the NTXP CPM Gantt Schedules schedule engine's basic sequence and logic, especially its ability to overlap phases and tasks. Decide whether its test outputs produce a realistic overlapping schedule that passes a sanity check on days. Then recommend which changes are worth adding, borrowing from the two prior NTXP schedule skills where valuable.

## Evidence (read all of it; all paths are under DIR)
1. `backbone.md`: the engine's NTXP 3-phase backbone sequence (task | duration | trade | flags). Module rows from council consensus get spliced after anchors; see `jev-tree.md` for wiring rules.
2. `engine_audit_before.json`: five test scenarios run through the engine (total WD/CD, phase spans, % of construction tasks running concurrently, critical %, max activity, link types, ratio to benchmark).
3. `drive_benchmarks.md`: real NTXP schedules extracted from Google Drive (Parkland triage hospital, Ralls, TxDOT Rocksprings, TAMU, etc.), with durations, overlap evidence, and owner/architect review comments.
4. `ntxp_gantt_schedule_SKILL.md`: prior NTXP Gantt skill. Note its parametric formula `WD = 2.13 × AffectedSF^0.379 × sector × tier × constraints`, crew diminishing returns, procurement pull-planning, and its sequence rules.
5. `cpm_schedule_SKILL.md`, `task-database.json`, `dependency-rules.json`: prior NTXP CPM skill (DISD 01 32 16 rules: max 10 WD per activity, 10% float, precon 10–50 days, budget/scope scaling multipliers). Its engine is also serial, but it scales durations.
6. `jev-tree.md`: current engine rules (FS sequential wiring, parallel rows feed phase gates, reference milestones).
7. Online context gathered by the orchestrator: a 10,000 SF interior renovation typically runs 3–6 months of on-site work (6–8+ months total with permitting). A clinic renovation ran on a 16-week schedule. A phased NICU renovation spanned about 8 months. SS links with 1–2 day lags, paired with FF links, are the standard way to model trades following framing. Location-based flow lets trades start in released areas.

## Your output — write OUTFILE as Markdown with exactly these sections

### 1. Verdict
For each scenario A–E: PASS / FAIL on a days sanity check, with your own expected realistic range for construction WD and total CD (precon + construction + closeout), and one line of reasoning.

### 2. Root causes
A ranked list (most impactful first) of why the engine is or isn't realistic. Cite the evidence file each claim comes from.

### 3. Recommended changes
A table: `id | change | value (High/Med/Low) | effort (S/M/L) | evidence | adopt? (yes/no)`. Consider at least:
- R1: an overlap model. SS+lag / FF+lag pairs between specific trade pairs. Give concrete pairs and lag values (e.g. Wall MEP rough SS+2 after framing; drywall SS+3 after cover-up inspection by area).
- R2: scope tiers that gate backbone work (light refresh / standard / heavy MEP / full gut). Say which backbone rows each tier drops.
- R3: size scaling of durations (the parametric formula vs. per-task scaling vs. quantity rates), plus sector and constraint multipliers.
- R4: parallel preconstruction (submittals, badging, compliance plans, permits running concurrently).
- R5: the DISD rule capping activities at 10 WD (split longer ones).
- R6: procurement pull-planning from the need-by date.
- R7: area/phase location-based repetition for occupied or phased work.
- R8: a minimum float target and a sanity-check gate in pre-flight (duration vs. benchmark range).
- Any other change you consider valuable, drawn from the prior skills or the real Drive schedules.

### 4. Lag table (machine-usable)
A pipe-delimited block, one row per relationship you recommend:
`from_task | to_task | type(SS/FF/FS) | lag_wd | condition`
Use exact backbone task names from `backbone.md` where possible.

### 5. Duration model
Your recommended formula or rules for scaling durations by SF, scope tier, sector, and constraints, with the expected construction WD it produces for scenarios A–E.

### 6. Expected results after the fix
For A–E: target construction WD, total CD, and % of construction tasks running concurrently that the fixed engine should produce to pass.

Be concrete and realistic for Texas public renovation work. No prices. Keep the whole file under 1,800 words. Reply with a one-line confirmation when done.
