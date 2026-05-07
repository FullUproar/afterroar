# Saga — Sprint Log

Per-sprint development history.

---

## Initial scaffold (2026-05-06) — landed via Mimir Sprint 1.0.17

Saga engine scaffolded with full design-doc set covering the breakthrough architecture: Monte Carlo simulator + per-player fun model trained on recap data. Three docs lock the architecture:

- `docs/design-notes.md` — saga's algorithmic choices, why a simulator vs. a regression, integration with the dimension framework + seidr profiles + the rec router, subtle-wrongness assertions specific to saga
- `docs/simulator-architecture.md` — the Monte Carlo machinery, single-simulation step, N-simulation aggregation, latency budget, reproducibility/audit, failure modes
- `docs/recap-as-training-data.md` — the training corpus dependency, what recap data gives saga, what features are derivable, training pipeline, graduation thresholds (≥3000 recap records, ≥200 active players, ≥6 months of corpus)

No source code. No DB writes. No simulator implementation. Per the saga README's "Why this is a Phase 0 scaffold (and not implementation)" section: the simulator could be coded today and would be useless without the training corpus, so the right Phase 0 work is locking the architecture and waiting for data.

See `mimir/SPRINT_LOG.md` Sprint 1.0.17 for the full provenance.

---

## Future sprints (drafts)

### Sprint Saga-0.0 — First implementation sprint

**Trigger:** ALL graduation thresholds in `recap-as-training-data.md` met:
- ≥3000 recap records in production
- ≥200 active players with ≥10 recaps each
- ≥150 distinct games with ≥30 recaps each
- ≥6 months of corpus
- Seidr deployed and profile coverage ≥40% of active players (provides priors)
- Sprint 1.0.18 (game profiling v0) complete (provides 24-dim game vectors)

**Realistic horizon:** 12–18 months from platform launch.

**Scope:** Saga's first migration creating `rec_saga_population_params`, `rec_saga_game_outcome_params`, `rec_saga_player_fun_params`, `rec_saga_simulation_log` tables. Pure schema; no implementation yet.

### Sprint Saga-0.1 — Training pipeline (offline)

**Scope:** Implement the 5-step training pipeline from `recap-as-training-data.md` § "Training pipeline (specification)". Runs nightly. Outputs to the saga-namespaced tables.

### Sprint Saga-0.2 — Simulator core (deterministic, with rng_seed)

**Scope:** Implement `simulate(G, group, context, rng_seed) → per_player_fun_vector`. Deterministic given the seed. Tested with synthetic players + synthetic Catan-like game.

### Sprint Saga-0.3 — N-simulation aggregator + per-candidate scorer

**Scope:** Wrap the simulator with N=1000 sampling, compute aggregates (expected_fun, P_misery, variance), score candidates, apply diversification + designer cap.

### Sprint Saga-0.4 — Subtle-wrongness assertion suite

**Scope:** All assertions per `design-notes.md` § "Subtle-wrongness assertions specific to saga". Tests must pass before the engine can graduate.

### Sprint Saga-0.5 — HTTP API surface + integration with rec router

### Sprint Saga-0.6 — Calibration validation against held-out recap data; graduation review

---

## Cross-engine notes

- Saga shares the `rec_*` schema namespace with mimir + huginn + seidr per SILO.md.
- Saga does NOT import from any sibling engine. Independent engines per SILO.md § 8.
- Saga consumes the dimension framework added in Sprint 1.0.15 (4 node types).
- Saga consumes seidr's 24-dim profile (Sprint 1.0.16) as a player prior.
- Saga consumes recap data per the contract in Sprint 1.0.13.
- Saga is the engine that monetizes the recap data moat — without recap UI capturing structured data, saga has no training signal and no other rec system can replicate this engine.
