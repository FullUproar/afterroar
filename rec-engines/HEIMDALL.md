# Heimdall — Recommendation Orchestrator (design anchor)

> *Heimdall, watcher at the bridge of the gods. He sees and hears across all the worlds — far enough to hear grass grow on the earth and wool grow on a sheep's back. He decides who passes onto Bifröst. He is not one of the engines; he is the one who knows them all.*

**Status:** design anchor only. No code yet. This doc establishes the role, the name, and the composition patterns Heimdall will eventually implement.

**Lives outside `rec-engines/`.** Per `README.md`, the orchestrator is a production-side concern that imports the engines via HTTP, not a sibling under this directory. When implementation begins, Heimdall lives at `apps/me/lib/heimdall/` or a dedicated `packages/heimdall/`. The choice is deferred — both are viable.

---

## Why Heimdall is needed

The README and SILO doc currently describe a "rec router" — a piece that picks one engine per request and runs others in shadow mode. That's a thin slice of what's actually required.

The engines aren't meant to be *alternatives* to each other. They're a **stacked dependency graph** with mimir as the foundation and huginn / seidr / saga as specialized layers that consume mimir's data and produce signal of their own. (See "How they relate" below.)

Once a player has done the quiz **and** has graph edges, the right answer isn't "pick seidr or pick huginn." It's "feed seidr's profile vector into huginn's PageRank seeding, run saga conditioned on the group, blend outputs by confidence." That's composition, not routing — and that's Heimdall's job.

The router framing is technically correct but undersells the role. Heimdall encompasses routing AND composition AND the feedback loop between engines.

---

## How the engines relate (the dependency graph Heimdall navigates)

```
                   ┌──────────────────────────────────────────┐
                   │ MIMIR (foundation: schema + edges + log) │
                   │ ── rec_player, rec_game, rec_edge        │
                   │ ── taxonomies, designers, mechanics      │
                   │ ── play/vote/trade history (edges)       │
                   │ ── logging signal for everyone above     │
                   └──────────────────────────────────────────┘
                          │              │              │
              ┌───────────┘              │              └────────────┐
              ▼                          ▼                           ▼
   ┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
   │ HUGINN           │     │ SEIDR                │     │ SAGA                 │
   │ Random walk over │     │ Quiz emits player    │     │ Monte Carlo over     │
   │ mimir's graph    │     │ vector; matches      │     │ recap data + groups  │
   │ ── pure consumer │     │ against game vectors │     │ ── consumes recap +  │
   │    of rec_edge   │     │ ── owns rec_seidr_*  │     │    edges + profile   │
   │ ── no own state  │     │ ── refs rec_player   │     │ ── consumes Saga's   │
   │                  │     │                      │     │    own simulation    │
   └──────────────────┘     └──────────────────────┘     │    state (later)     │
                                                          └──────────────────────┘
                          ▲              ▲              ▲
                          └──────────────┼──────────────┘
                                         │
                                  ┌──────────────┐
                                  │  HEIMDALL    │
                                  │  (apps/me or │
                                  │   packages/) │
                                  └──────────────┘
                                         │
                                         ▼
                                  Production caller
                                  (HQ, afterroar.me,
                                   FU site, FLGS API)
```

Mimir is *both* an engine *and* the data foundation. It runs on every request — when it ranks games AND when it captures the edges that huginn and saga consume.

---

## The four roles Heimdall plays

### 1. Routing

Decide which engines run for a given request.

- New player, no edges, no quiz → **mimir only**
- Player has done quiz → **mimir + seidr**
- Player has 5+ edges → **mimir + seidr + huginn**
- Group context + ≥3000 recap records exist → **mimir + seidr + huginn + saga**

Mimir always runs because of the dual role (engine + data layer).

### 2. Composition

When multiple engines are eligible, thread their outputs into each other:

| Engine A's output | Engine B uses it as | Why |
|---|---|---|
| Seidr's 24-dim player vector | Huginn's PageRank seeding (start traversal at games near the player's profile region) | Huginn cold-starts faster — doesn't need 5 edges before producing useful results |
| Huginn's "players similar to you" cluster | Seidr's quiz prior (predict missing answers from neighbors) | Seidr can recommend after 8 questions instead of 18 |
| Saga's per-game fun-prediction error | Seidr's game-profile updates (bend 24-dim vectors toward observed reality) | Closes the loop — saga's recap learnings refine seidr's offline matching |
| Recap data | Mimir's edge table (each recap = many played-edges) | Mimir's graph fattens organically; huginn's traversal richens automatically |

Heimdall is responsible for this threading. No engine should reach into another's storage; they pass results to Heimdall, who decides what to feed where.

### 3. Aggregation

When two or more engines produce a candidate ranking for the same request, Heimdall combines them. Options under consideration (decide later):

- **Confidence-weighted ensemble** — each engine returns its candidates with a confidence score; Heimdall takes a weighted sum
- **Specialization-by-context** — saga wins when group + recap is rich; seidr wins when quiz is fresh; huginn wins when the graph is dense; weights shift by context
- **Stacking** — Heimdall trains a meta-model that learns when to trust which engine

The exact aggregation strategy is a Phase 1+ open question. The architecture must let it be swapped without changing engines.

### 4. Learning loop coordination

When recap data arrives, Heimdall fans the signal back out:

- Mimir gets new played-edges (graph fattens)
- Saga gets new training examples (per-player fun model improves)
- Seidr's game profiles get refined (24-dim vectors bent toward observed-fun reality)
- Huginn's PageRank seeds get re-weighted (edges that led to high-fun outcomes get stronger)

This is what makes the engines compose into a *system* rather than a portfolio.

---

## What Heimdall is NOT

- **Not a fifth engine.** It does not produce its own recommendations. It runs the engines and combines them.
- **Not under `rec-engines/`.** That directory is for the engines themselves. Heimdall is the consumer.
- **Not the federation layer.** Cross-store learning is `yggdrasil`'s job (different problem — privacy, cross-tenant training, etc.).
- **Not yet built.** This doc is a design anchor, not a spec. Activation begins when (a) the rec router becomes a real product surface and (b) two or more engines are functional in production.

---

## Activation criteria

Heimdall implementation begins when **two of the four engines are functional** AND **a real production caller wants recommendations**. Until both conditions hold, internal admin tooling can call engines directly — no orchestrator needed.

Today (2026-05-06): mimir + seidr are functional. **First condition met.** No production caller is wired yet — second condition pending. So this doc is anchor-only.

---

## Where it lives (when built)

Two viable homes:

1. **`apps/me/lib/heimdall/`** — Passport is the most natural caller (player identity, quiz state). Heimdall lives where the player profile lives.
2. **`packages/heimdall/`** — Standalone package. Any app (apps/me, apps/ops, future apps) can import it. Higher initial setup but better long-term.

**Lean toward `packages/heimdall/`** if Heimdall ends up needing to be called from multiple apps (HQ for game-night recs, ops for store-floor recs, afterroar.me for player onboarding). Lean toward `apps/me/lib/heimdall/` if calling-from-Passport is the only near-term integration.

Final decision: deferred to first concrete caller.

---

## Open questions to close before building

1. **Engine API contract** — what does each engine return? Probably `{ candidates: GameId[], scores: number[], features?: jsonb }` but the exact shape needs locking.
2. **Latency budget** — Heimdall calling 4 engines in parallel each with their own DB queries... what's the target? Sub-200ms for an interactive rec? Sub-2s for a batched recommendation refresh?
3. **Caching strategy** — engine outputs are partially deterministic (same inputs → same outputs until the data changes). Cache layer at engine? At Heimdall? Both?
4. **A/B / shadow mode** — how does Heimdall declare experiments and measure outcomes? Probably ties to the analytics/eventing infrastructure that doesn't exist yet either.
5. **Failure modes** — if huginn is slow or down, does Heimdall return without it? How does it degrade gracefully when the request is complete-feedback-loop-dependent?
6. **Vertical scaling** — when `mimir-books`, `mimir-vinyl`, etc. exist, does each vertical have its own Heimdall, or one Heimdall that knows about verticals?

These don't need answers today. They DO need to be answered before Heimdall is built — they define the architecture and they can't be retrofitted.

---

## Why "Heimdall"

Heimdall is the watcher at Bifröst, the bridge between the world of the gods (Asgard) and the world of mortals (Midgard). His role: see across all nine worlds (engines), hear what's happening in each, and decide who/what passes through onto the bridge.

That's exactly the orchestrator's role:

- **Sees across** — knows the state of every engine, every player, every request
- **Decides who passes** — routes requests to the right engines, picks which output to surface
- **Bridges worlds** — sits between the engines (developer-facing internal services) and production callers (player-facing apps)

Two near-misses considered and rejected:

- **Forseti** (god of judgment / reconciliation) — fits the ensemble-aggregation framing but feels too narrow. Heimdall's role is bigger than judging; it includes routing, composition, and feedback coordination.
- **Norns** (already-reserved name) — the weaving-three-threads metaphor fits ensemble nicely, but `norns` is reserved for an emergent-dimensionality gene-graph engine in `SILO.md`. Re-purposing would create confusion.

Heimdall is also satisfyingly distinct from the engines — they're knowledge / thought / divination / story, all *content* mythologies. Heimdall is *position* mythology — about being at the right place to see and decide. That positional role matches the orchestrator's shape.

---

## What to do with this doc

- **Read before:** designing the rec router, picking the home for orchestration, deciding the engine API contract, planning the first production rec integration.
- **Update when:** any of the open questions above gets closed; the activation criteria are met; an engine's output shape changes; a new engine is scaffolded that Heimdall will need to call.
- **Don't:** start building Heimdall before activation criteria are met. Pre-building an orchestrator before there's anything to orchestrate produces over-engineered plumbing.

---

## Revision log

| Date | Change |
|---|---|
| 2026-05-06 | Initial — name + role + composition patterns + activation criteria. No implementation yet. |
