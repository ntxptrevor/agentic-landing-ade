# Model routing (mini-JEV)

Code and data: `web/src/utils/modelRouter.js` (also shown in the app's Environment tab).

## Precedence

1. **Council configuration** decides which seats exist and are authorized (keys, ceilings,
   confidentiality: DeepSeek/GLM never see owner, bid, pricing, personnel content).
2. **This router** chooses the executor among authorized seats for every BidForge action. It
   supersedes other routing for model *selection*, including ntxp-model-router's "user names a
   model → step aside" rule: inside this skill a named model is read as an **intent**, a
   capability floor (e.g. "use Sonnet" → any seat with capability ≥ Sonnet's that is cheapest).
3. **Hard no-list still holds**: owner/architect-facing text, pay apps, RFI/submittal responses,
   CO/contract language stay with Claude.

## Scoring

Each action carries **impact** (0–100: likelihood × magnitude of effect on the project, positive
or negative) and **intelligence** (1–100; 1 = Haiku/Luna medium effort, 100 = Fable/Astra frontier
high effort).

```
deterministic action        → script (no model)
required = intelligence
impact ≥ 70                 → required = max(required, 80)
named model                 → required = max(required, capability(named), ≤95)
pick = cheapest authorized seat with capability ≥ required
effort = high (≥90) · medium (≥60) · low
```

Registry fields: capability (cutting-edge score), cost (relative), cost-efficient score =
capability ÷ cost, efforts, restricted flag. Refresh capability/cost from the ntxp-model-router
registry and the council sheet at initialization; the file values are fallbacks.

## Budget intent

Frontier only for: initial schedule generation, Project Manual / spec reading, high-argument
complex resequencing, milestone-impact judgment, final pre-publish audit, lessons-learned
conclusions. Logistics (collecting sync sources, logging, exports, diffing, rule checks) run as
scripts or low tiers. Log `route.py log-outcome` after delegated work; executors with >20% rework
on a class are demoted automatically.
