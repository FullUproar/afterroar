# Rec Engines — 60-Second Quickstart

Welcome back. This file is your "I just sat down at a laptop and want to see seidr work" guide. For deep context, read [`HANDOFF.md`](./HANDOFF.md) and the per-engine `SPRINT_LOG.md` files.

## What works today

- **Seidr** is fully runnable end-to-end (no DB, no LLM, no network needed) against a **225-game seed corpus**: quiz-UI export JSON → ranked recommendations with natural-language explanations.
- **Mimir** is sandbox-validated: schema (3 migrations, 23 tables, 42 seed-taxonomy rows) applies cleanly to local Postgres. **182/182 tests green.**
- **Huginn** + **saga** are scaffolds (huginn: PPR future; saga: forward simulator architecture-locked, awaits recap data).

## Smoke-test seidr in 60 seconds

```bash
cd rec-engines/seidr
npm install
npm test                                  # expect 264/264 passing
```

## Run recommendations against the full 225-game corpus

```bash
# Built-in archetype: heavy strategist
node scripts/run-rec.mjs --archetype heavy-strategist \
  --game-profiles data/seed-game-profiles.json \
  --bgg-dir ../mimir/tests/fixtures/bgg --limit 5

# Real quiz UI export (the file the deployed quiz writes via Copy/Download)
node scripts/run-rec.mjs \
  --player-profile data/sample-quiz-export.json \
  --game-profiles data/seed-game-profiles.json \
  --bgg-dir ../mimir/tests/fixtures/bgg --limit 5 --detail short

# Compact JSON output for piping
node scripts/run-rec.mjs --archetype party-extravert \
  --game-profiles data/seed-game-profiles.json \
  --limit 3 --json
```

Without `--game-profiles`, the runner falls back to the 7 reference profiles in `data/reference-profiles.json` — useful for quick sanity checks against canonical games (Terraforming Mars, Codenames, TI4, Wingspan, Cascadia, Pandemic, Ark Nova).

The 225-game corpus covers all 8 BGG subdomains (Strategy/Thematic/Family/Party/Wargames/Customizable/Children's/Abstract) plus top-100 overall. Top picks per archetype:
- **heavy-strategist** → Terraforming Mars (0.98), On Mars, Lisboa, Ark Nova
- **party-extravert** → Codenames (0.95), Monikers
- **coop-puzzler** → The Crew variants (0.93)

## The deployable quiz UI

```bash
# Open in browser locally
open rec-engines/seidr/quiz-ui/index.html

# Or serve via static host
cd rec-engines/seidr/quiz-ui && python -m http.server 8000
# then visit http://localhost:8000
```

The quiz emits a profile JSON via Copy / Download. Pipe that JSON back into the CLI runner above.

The full demo loop:
1. Real user takes the 18-question quiz on their phone → exports JSON via Copy or Download
2. They send the JSON to you
3. You run:
   ```bash
   node scripts/run-rec.mjs \
     --player-profile <their-file.json> \
     --game-profiles data/seed-game-profiles.json \
     --bgg-dir ../mimir/tests/fixtures/bgg
   ```
4. Seidr produces ranked recommendations with natural-language explanations

## Apply the schema to a real DB

Sandbox-validated against local Postgres 16. To apply against your Neon dev branch:

```bash
# Mimir's foundation schema + seed taxonomies (3 migrations)
cd rec-engines/mimir
DATABASE_URL='postgres://...your-neon-dev-branch...' npm run migrate:dry-run
DATABASE_URL='postgres://...' npm run migrate

# Seidr's engine-specific tables (1 migration)
cd ../seidr
DATABASE_URL='postgres://...' npm run migrate:dry-run
DATABASE_URL='postgres://...' npm run migrate
```

The runner refuses any URL containing `prod` / `production` / `-live` unless you pass `--allow-prod` (don't, in Phase 0).

After both runs you should have **23 rec_\* tables** with **42 seed-taxonomy rows** (Bartle archetypes, OCEAN traits, SDT needs, MDA aesthetics, emotional palette, cognitive dimensions, named contexts).

Verify:
```sql
SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'rec_%';
-- Expect: 23 (22 schema + rec_migrations bookkeeping)

SELECT (SELECT count(*) FROM rec_personality_profile) AS personality,
       (SELECT count(*) FROM rec_emotion) AS emotion,
       (SELECT count(*) FROM rec_cognitive_profile) AS cognitive,
       (SELECT count(*) FROM rec_context_type) AS context_type;
-- Expect: 12 / 14 / 6 / 10
```

## What's left to ship seidr to real users

1. **Apply migrations to your Neon dev branch** (commands above).
2. **Real-user quiz testing** — deploy the quiz UI, share with friendly testers, feed their JSON exports through the CLI.
3. **Wire the production rec router** (out of scope for this directory; lives in `apps/me` or a new `packages/rec-router/`).
4. **Optional: top-500 LLM-API run** for full corpus calibration. The pipeline at `seidr/scripts/profile-game.mjs` is ready; needs `ANTHROPIC_API_KEY` + per-game BGG metadata. The 225-game seed corpus is sufficient for offline real-user testing today.

Until the rec router is wired, the loop is offline-only — which is exactly what the discipline says it should be (subtly-wrong recommendations are worse than no recommendations).

## Engine status

| Engine | Status | Tests | Sprint last touched |
|---|---|---|---|
| `mimir` | End-to-end validated, 3 migrations sandbox-applied | **182/182** | Sprint 1.0.22 |
| `huginn` | Phase 0 scaffold | scaffold-only | Sprint 1.0.12 |
| `seidr` | End-to-end runnable via CLI against 225-game corpus | **264/264** | Sprint 1.0.28 |
| `saga` | Architecture locked; awaits recap data | scaffold + 3 design docs | Sprint 1.0.17 |

## Three useful archetypes for demos

- `heavy-strategist` — long sessions, optimization-heavy, low-conflict. Top picks vs. 225-game corpus: Terraforming Mars, On Mars, Lisboa, Ark Nova.
- `party-extravert` — large groups, light, humorous, fast. Top pick: Codenames; Monikers close behind.
- `coop-puzzler` — peaceful, low-conflict. Top picks: The Crew variants (Mission Deep Sea + Quest for Planet Nine).

Each demonstrates a different region of the 24-dim space. If a sanity check ever fails on these, something dimensional in the matcher has drifted — the seidr test suite covers all three as subtle-wrongness assertions.

## File map

- [`HANDOFF.md`](./HANDOFF.md) — full session-resume context (start here for deeper pickup)
- [`SILO.md`](./SILO.md) — silo rules + naming convention + sprint discipline (the constitution)
- [`README.md`](./README.md) — short engine-list summary
- `mimir/`, `huginn/`, `seidr/`, `saga/` — per-engine code + docs + sprint logs

For anything beyond a 60-second pickup, start with `HANDOFF.md` then drill into the engine-specific `SPRINT_LOG.md`.
