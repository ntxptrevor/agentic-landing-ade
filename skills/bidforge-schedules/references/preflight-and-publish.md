# Pre-flight, publish, and the error loop

Runs before every output (new schedule, sync republish, export to Drive/JobTread).

## Stage 1 — Deterministic checks (`web/src/utils/preflight.js`, shown in the app banner)

Sequence rules (NTP→mobilization, cover-up→drywall, above-ceiling→tile, underground→pourback,
abatement→demo, prime/moisture→flooring, FA acceptance→SC, ICRA inspection→removal, final
clean→SC, punch→turnover), every task dated and linked, requirements gate satisfied, milestone
variance reported, sync links present (warning), and DOM layout checks: no clipped text, ≥3px
padding between text and every border, one font family.

### Days sanity gate (`sanityChecks`)

Construction WD must fall within 0.7–1.4× the parametric envelope
(`2.13 × SF^0.379 × tier × sector × constraints`). At least 50% of construction activities must
run concurrently (NTXP actuals are 85–95%), and at most 50% may be critical. No construction
activity may exceed 10 WD. The projected SC must leave 10% float to the contract SC date when that
date is set. Preconstruction ≤ 45 WD and closeout ≤ 20 WD are warnings. A failure blocks
publishing; the engine never compresses durations to pass. Run
`node scripts/schedule_audit.mjs` to re-check the five reference scenarios after any change.

## Stage 2 — Council inspection (`agents/preflight-inspector.md`)

≥3 distinct providers (reduced Claude council if the engine is absent). Input: the deterministic
results, the canonical JSON summary (no pricing), a 17×11in screenshot of the canonical page
(Playwright at 1632×1056 CSS px per page), and the requirements record. Each seat answers yes/no
with ≤5 sentences on:

1. Compliance with skill rules (gates, protected items, milestone permission, formatting spec).
2. Logic of sequence (council rules in jev-tree.md; trade stacking; inspection placement).
3. Project-specific instructions from the uploaded requirements (work hours, phasing, durations).
4. Visual: sizes, placement, overlaps, text touching margins or rules, even fonts and sizes,
   header (navy band, reversed logo left, 20pt bold italic "PROJECT SCHEDULE" centered, red
   gradient pinstripe), phase rows black with white bold italic, footer ½" with black rule,
   project title left, version/date right.
5. File name pattern and that the output renders (PDF opens, XML parses, HTML loads).

Unanimous yes → stage 3. Any no → fix and repeat (max 3 rounds), then gate to the user.

## Stage 3 — Final integrity audit (Opus-level, `preflight_final_audit`)

Verify the established data sources and sync connections: JobTread job reachable and matching the
Coda; Drive folder writable; KB path writable; the canonical version equals what will be pushed;
`jobTreadTaskId` mapping complete; last pull newer than the last JobTread edit; the JobTread
"Notes" Coda block exists, verifies by read-back, and its sha matches the KB Coda. Record the result
in the changelog (`type: preflight`).

## Publish

1. Build: `cd web && npx vite build --outDir <out> --emptyOutDir`; add `.htaccess` (SPA rewrite).
2. Add `canonical.json` (and `sync-bundle.json` if any) beside `index.html`. The app opens
   straight to the read-only canonical view when `canonical.json` is present.
3. Host at `https://<slug>.ntxpllc.com/schedule` with hostinger-ntxp-skill (five-tier ladder:
   API → hPanel file manager → browser automation …). Create the subdomain if missing. Any
   available static host (Netlify/Vercel connector) is an acceptable fallback; record the URL in
   `links.hostUrl`.
4. If no hosting works: export HTML, 11x17 PDF and MSPDI XML to Drive and attach to JobTread
   (document/file on the job), then stop and report.
5. Off-ramp sync (KB → Drive → JobTread) per canonical-and-offramp.md.

## Error loop (agentic)

```
error → classify (auth / permission / schema / missing record / validation / rate / server)
      → search KB + council troubleshooting (council_kb_search) for a known fix
      → retry once with the obvious safe correction (cheap tier)
      → still failing: escalate one intelligence tier and retry with a different approach
      → still failing after 2 approaches or 15 min: convene council (stuck-problem rule)
      → council fails: gate to the user with options A/B/C; post the fix back (council_kb_post)
```
Never expose credentials; never bypass a gate to make an error go away.
