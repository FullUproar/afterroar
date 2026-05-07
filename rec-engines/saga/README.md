# Saga — Forward-Simulator Recommendation Engine

*Saga: Old Norse goddess of stories and history. She drinks daily with Odin from the well of memory and tells the tales that come from looking back. Where Mimir is wisdom-as-stored-knowledge and Huginn is thought-as-traversal, Saga is **story-as-simulation** — running a hundred imagined game-nights forward and seeing which one ends with everyone happy.*

---

The breakthrough recommendation engine. Saga is qualitatively different from mimir, huginn, and seidr: it does not match, traverse, or score against features. **It runs Monte Carlo simulations of game-nights and predicts expected fun per player.** The recommendation is whichever candidate game maximizes a risk-aware aggregation of those predicted fun outcomes.

This is the engine the platform's competitive moat ultimately rests on. BGG cannot do this. Geek Buddy cannot do this. The data we need to train it — full per-player recap data captured by HQ after each game-night — is the data nobody else has.

## Why this engine exists

Every other rec engine in this directory answers some variant of: **"this game is similar to games this player likes."** That's a useful question. It's not the question players actually ask.

The question players actually ask is: **"will my group of specific people actually have fun playing this specific game tonight?"**

That question depends on:

- **Who's at the table** — their preferences, conflict tolerance, table-talk style, energy level tonight
- **The game's outcome distribution** — does it produce runaway leaders, kingmaker dynamics, comebacks, decision dilemmas?
- **The interaction** — does this group's social style mesh with this game's pacing? Will the strategist dominate the casual player? Will the analyst trigger AP that exhausts the tactician?
- **The context** — player count, time available, energy in the room, whether kids are in the next room, whether someone's tipsy

Mimir, huginn, and seidr can each contribute features to that prediction, but none of them ARE that prediction. Saga is.

## Architectural distinction

| Engine | Operates on | Output | Latency budget | Training data needed |
|---|---|---|---|---|
| **mimir** | metadata + edges | similarity score | <50ms | None (rule-based) |
| **huginn** | typed graph | PPR score from random walk | <500ms | None (graph-based) |
| **seidr** | 24-dim vectors | cosine similarity | <100ms | Game-profile vectors |
| **saga** | per-player fun model + game outcome model | *probability distribution over fun outcomes* | <2000ms (1000 simulations × per-candidate) | **6+ months of recap data, ≥3000 recap records, ≥200 unique players** |

Saga does not return a score. It returns a distribution. The recommendation surface chooses how to aggregate (expected fun, fun-variance penalty, P(everyone happy), risk-aware Pareto frontier).

## Phase activation

Saga does not activate until ALL of:

1. **Recap data exists in volume.** ≥3000 recap records (Sprint 1.0.13's spec). ~6 months of platform usage at ~500 monthly active recap-completing players.
2. **Per-player fun model is trainable.** Each active player has ≥10 recap entries — the minimum to fit a per-player adjustment over the population baseline.
3. **Game outcome models are trained.** For each of the ~500 most-played games, we have ≥30 recap records spanning ≥3 distinct group sizes.
4. **Seidr profiles exist for ≥40% of active players.** Seidr's 24-dim profile is saga's prior over a player it hasn't seen much recap data for. Without seidr, saga's cold-start for any player is ~20 recaps; with seidr, it's ~3 recaps.
5. **The simulator passes correctness tests.** Forward simulation of toy games (e.g., simulated Catan with synthetic players) produces statistically reasonable outcomes vs. ground truth.
6. **Subtle-wrongness assertions pass** (per SILO.md § 7), with saga-specific additions:
   - No game with simulated P(any player has miserable time) > 0.3 appears in top-K
   - Recommendation honors player-count constraints from simulation runs (filtering done JIT, not as preprocess)
   - High-killer player (per seidr profile) doesn't get coop-only games as top picks for solo predicted fun
   - Calibration: out of 100 recommendations rated "high expected fun" by saga, ≥75 are rated ≥4/5 in their actual recap

Until all six are met, saga stays in silo. Realistic activation horizon: **12–18 months from platform launch.**

## How saga complements the other engines

Saga is **not a replacement** for mimir, huginn, or seidr. It runs in parallel. The rec router (production-side, future) blends:

- **Cold-start (no recap, no quiz):** mimir 100%
- **Cold-start with quiz:** mimir + seidr blend
- **Warm (5+ edges, no recap volume):** mimir + huginn + seidr
- **Hot (recap data accumulated for caller):** **saga as primary**, with mimir/huginn/seidr as bias correctors and explanation contributors

In the hot regime, saga is the answer. The other engines become feature inputs (mimir provides candidate pool filtering; seidr provides player priors; huginn provides graph-distance features) and explanation augmenters (saga's explanation says "high expected fun *because*: simulator predicts everyone scores 4+, and seidr predicts you specifically enjoy this game's emotional palette").

## What's inside

- `docs/design-notes.md` — Saga-specific algorithmic notes: per-player fun model architecture, game outcome model architecture, simulation loop, integration with the dimension framework + seidr profiles
- `docs/simulator-architecture.md` — The Monte Carlo machinery: how a simulation step works, what factors are sampled, what features condition the per-player fun model, latency budgets
- `docs/recap-as-training-data.md` — What recap data gives saga, what features are derivable, training pipeline, the dependency on Sprint 1.0.13's spec
- `migrations/` — (empty) Saga-specific tables (`rec_saga_player_fun_params`, `rec_saga_game_outcome_params`, `rec_saga_simulation_log`) come in a future sprint
- `src/` — (empty) Implementation lands when saga graduates from research to production
- `tests/` — (empty) Will follow the same TDD discipline as mimir, with simulator-correctness tests as a major category
- `SPRINT_LOG.md` — Sprint history, starts with this scaffold sprint
- `package.json` — Independent package; **no imports from any sibling engine** (per SILO.md § 8)

## Reading order for new contributors / future Claudes

1. [`../HANDOFF.md`](../HANDOFF.md) — cross-engine context
2. [`../SILO.md`](../SILO.md) — silo rules, naming convention, sprint discipline
3. [`../mimir/docs/recommendation-engine-design.md`](../mimir/docs/recommendation-engine-design.md) — architectural spec for ALL engines
4. [`../mimir/docs/dimension-framework-integration.md`](../mimir/docs/dimension-framework-integration.md) — Sprint 1.0.15's framework absorption (saga is its largest beneficiary)
5. [`../mimir/docs/recap-data-spec.md`](../mimir/docs/recap-data-spec.md) — Sprint 1.0.13's recap contract (saga's training corpus)
6. [`../seidr/docs/dimension-taxonomy.md`](../seidr/docs/dimension-taxonomy.md) — the 24 dimensions saga consumes as player priors
7. This README
8. [`docs/design-notes.md`](./docs/design-notes.md) — saga's design
9. [`docs/simulator-architecture.md`](./docs/simulator-architecture.md) — the Monte Carlo machinery
10. [`docs/recap-as-training-data.md`](./docs/recap-as-training-data.md) — training corpus details
11. `migrations/`, `src/`, `tests/` — implementation (when it lands)

## Why "saga"?

Three reasons:

1. **The engine tells stories forward.** Every Monte Carlo simulation IS a story: "Alex starts as engine-builder, Maya kingmakes via aggressive tile placement, Jordan stalls in turn 4, Casey closes a comeback in turn 6, final scores are X/Y/Z, Maya rates the night 5, Jordan rates it 2." That collection of stories — the sagas — is what saga distills into a fun forecast.

2. **The engine is informed by recorded history.** Just as the historical Saga (the goddess) drinks from the memory of past events, the engine learns from the recap-recorded history of past game-nights. Recap data IS the memory the engine drinks from.

3. **Platform-naming consistency.** Norse mythology naming convention per SILO.md § "Naming convention". Saga is a less famous Aesir than Mimir or Odin's ravens but a perfect fit for a memory-grounded simulator.

## Why this is a Phase 0 scaffold (and not implementation)

The simulator could be coded today. It would be useless. Saga's value is entirely in the *training* on recap data — without 6+ months of recap accumulation, the per-player fun model fits nothing meaningful and the game outcome models are too noisy. Implementing now would be subtly-wrong recommendations (per SILO.md § "Why silos exist") at scale.

The right Phase 0 work for saga is:
- Lock the architecture in design docs (this scaffold)
- Specify the training data dependency precisely so the recap UI captures everything needed (Sprint 1.0.13 already did this)
- Specify the dimension framework integration so seidr profiles flow in cleanly (Sprint 1.0.15 prepared the schema; Sprint 1.0.16 specified the player half)
- Wait for data accumulation
- Implement when the data exists
