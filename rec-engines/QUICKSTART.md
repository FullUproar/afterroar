# Rec Engines — 60-Second Quickstart

Welcome back. This file is your "I just sat down at a laptop and want to see seidr work" guide. For deep context, read [`HANDOFF.md`](./HANDOFF.md) and the per-engine `SPRINT_LOG.md` files.

## What works today

- **Seidr** is fully runnable end-to-end (no DB, no LLM, no network needed):
  quiz-UI export JSON → ranked recommendations with natural-language explanations.
- **Mimir** is sandbox-validated: schema (3 migrations, 23 tables, 42 seed-taxonomy rows) applies cleanly to local Postgres. 182/182 tests green.
- **Huginn** + **saga** are scaffolds (huginn: PPR future; saga: forward simulator architecture-locked, awaits recap data).

## Smoke-test seidr in 60 seconds

```bash
cd rec-engines/seidr
npm install
npm test                                  # expect 173/173 passing
```

Try the offline CLI runner (no DB, no network):

```bash
# Built-in archetype: heavy strategist
node scripts/run-rec.mjs --archetype heavy-strategist \
  --bgg-dir ../mimir/tests/fixtures/bgg --limit 5

# Real quiz UI export (the file the deployed quiz writes via Copy/Download)
node scripts/run-rec.mjs --player-profile data/sample-quiz-export.json \
  --bgg-dir ../mimir/tests/fixtures/bgg --limit 3 --detail short

# Compact JSON output for piping
node scripts/run-rec.mjs --archetype party-extravert \
  --bgg-dir ../mimir/tests/fixtures/bgg --limit 3 --json
```

You should see ranked recommendations against the 7 reference games (Terraforming Mars, Codenames, Twilight Imperium, Wingspan, Cascadia, Pandemic, Ark Nova) with explanations grounded in the 24-dim taxonomy.

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
1. Real user takes the quiz on their phone → exports JSON
2. They send the JSON to you
3. You run `run-rec.mjs --player-profile <their-file.json> --bgg-dir ../mimir/tests/fixtures/bgg`
4. Seidr produces ranked recommendations with explanations

## Apply the schema to a real DB

Sandbox-validated against local Postgres 16. To apply against your Neon dev branch:

```bash
# Mimir's foundation schema + seed taxonomies
cd rec-engines/mimir
DATABASE_URL='postgres://...your-neon-dev-branch...' npm run migrate:dry-run
DATABASE_URL='postgres://...' npm run migrate

# Seidr's engine-specific tables
cd ../seidr
DATABASE_URL='postgres://...' npm run migrate:dry-run
DATABASE_URL='postgres://...' npm run migrate
```

The runner refuses any URL containing `prod` / `production` / `-live` unless you pass `--allow-prod` (don't, in Phase 0).

After both runs you should have **23 rec_\* tables** populated with **42 seed-taxonomy rows** (Bartle archetypes, OCEAN traits, SDT needs, MDA aesthetics, emotional palette, cognitive dimensions, named contexts).

## What's left to ship seidr to real users

1. **Top-500 LLM-generated game profiles** (Sprint 1.0.23, requires laptop + ANTHROPIC_API_KEY). The pipeline at `seidr/scripts/profile-game.mjs` is ready; just needs invocation. BGG metadata fetch (`mimir/scripts/fetch-bgg.mjs`) needs to run from a non-datacenter IP — BGG 403s the dev sandbox.
2. **Apply migrations to your Neon dev branch** (Sprint 0.3, was always laptop-side).
3. **Wire the production rec router** (out of scope for this directory; lives in `apps/me` or `packages/rec-router/`).

Until all three are done, the loop is offline-only — which is exactly what the discipline says it should be (subtly-wrong recommendations are worse than no recommendations).

## Engine status

| Engine | Status | Tests | Sprint last touched |
|---|---|---|---|
| `mimir` | End-to-end validated, schema sandbox-applied | 182/182 | Sprint 1.0.22 |
| `huginn` | Phase 0 scaffold | scaffold-only | Sprint 1.0.12 |
| `seidr` | End-to-end runnable via CLI; offline demo loop closed | 173/173 | Sprint 1.0.21 |
| `saga` | Architecture locked; awaits recap data | scaffold + 3 design docs | Sprint 1.0.17 |

## Three useful archetypes for demos

- `heavy-strategist` — long sessions, optimization-heavy, low-conflict. Top picks: Terraforming Mars, Ark Nova.
- `party-extravert` — large groups, light, humorous, fast. Top pick: Codenames.
- `coop-puzzler` — peaceful, low-conflict. Top pick: Pandemic; Wingspan + Cascadia close behind.

Each demonstrates a different region of the 24-dim space. If a sanity check ever fails on these, something dimensional in the matcher has drifted.

## File map

- [`SILO.md`](./SILO.md) — silo rules + naming convention + sprint discipline (the constitution)
- [`HANDOFF.md`](./HANDOFF.md) — full session-resume context
- [`README.md`](./README.md) — short engine-list summary
- `mimir/`, `huginn/`, `seidr/`, `saga/` — per-engine code + docs + sprint logs

For anything beyond a 60-second pickup, start with `HANDOFF.md` then drill into the engine-specific `SPRINT_LOG.md`.
