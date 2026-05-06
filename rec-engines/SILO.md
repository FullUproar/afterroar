# Rec Engine Silo Rules

This directory contains experimental recommendation engines under construction. Each subdirectory (`content-similarity/`, future `ppr/`, `embeddings/`, `simulator/`, `gene-graph/`, etc.) is a single engine implementation in isolation.

## Why silos exist

Recommendation engines are a "subtly wrong is worse than absent" class of feature. A recommender that's right 70% of the time damages trust more than no recommender at all. The silo discipline ensures:

1. New engines are built and proven in isolation before any production code depends on them.
2. Multiple engine implementations can coexist for A/B testing without crosstalk.
3. Production code paths are insulated from in-progress work.
4. Reverting an experiment is mechanical (delete the engine directory).

## The rules

### 1. No production code imports from `rec-engines/`

Production apps (`apps/me`, `apps/ops`, future `apps/hq`) MUST NOT import from this directory. Period. The compiler should enforce this via tsconfig path restrictions when type checking is added.

### 2. The integration boundary is the API, not code

Rec engines expose HTTP endpoints. Production code calls those endpoints. There is no shared library, no shared types beyond what travels over the wire, no direct function call across the boundary. **The HTTP API is the silo enforcer.**

### 3. Schema is namespaced

All database tables created by rec engines use the `rec_*` prefix. Production code may not write to these tables. Engines may read from production tables (via canonical sources or a read replica) but never write.

### 4. All endpoints are feature-flagged

Engine HTTP routes are namespaced (`/api/recs/<engine-name>/...` when wired up) and gated by feature flags that default to off in production. No customer hits an engine without an explicit flag flip.

### 5. Engines compete; production picks winners

A graduation criterion (defined per engine in its README) determines when an engine is ready to leave silo. Graduation means: a portion of production traffic is routed to it via flag, observed in shadow mode, then gradually promoted as evidence accumulates.

### 6. No engine is the canonical engine

Even after graduation, multiple engines can run in parallel. Production calls a "rec router" (lives in production code, not in `rec-engines/`) that distributes traffic per A/B configuration. The router belongs to production; engines remain in silo.

### 7. Subtle-wrongness assertions are required

Every engine's test suite must include assertions that catch the recommendation-specific failure modes:

- **Negative-signal propagation:** if a player has a `voted-nope` or `traded-in` edge to game X, X must not appear in their next 10 recs.
- **Constraint respect:** player count, length, exclusion lists are honored.
- **Diversity:** no single designer dominates the top-K (cap at 2 of any single designer in top 10).
- **Cold-start safety:** insufficient-data inputs produce a low-confidence response, not nonsense.
- **Stale-cache safety:** results carry a `computed_at` and respect invalidation when underlying signals change.

These are required, not aspirational. An engine cannot graduate without them passing.

## Adding a new engine

1. Create `rec-engines/<descriptive-name>/` with:
   - `README.md` — what this engine is, what makes it different, current phase, graduation criteria
   - `docs/` — design docs and decisions specific to this engine
   - `migrations/` — SQL files (engine-specific or shared `rec_*` tables)
   - `src/` — implementation
   - `tests/` — test suite (must include the subtle-wrongness assertions above)
   - `package.json` — independent package, no cross-engine imports

2. The first commit only adds scaffolding. Real code follows in subsequent commits per the sprint discipline (one PR, one deploy, one observable change).

## Removing an engine

1. Disable any feature flags pointing to it.
2. Wait for any in-flight requests to drain (typically <5 min).
3. Delete the directory in a single PR.
4. Run engine-specific table drops in a separate migration if data should not persist (most experimental data should persist for offline analysis).

## Cross-engine coordination

Multiple engines may share the `rec_*` schema namespace. Migrations that affect shared tables go in the foundation engine (`content-similarity/migrations/`). Migrations specific to one engine (e.g., `rec_embeddings_v2` for the embedding engine) go in that engine's own `migrations/`. The migration runner is engine-aware.

If two engines need the same new shared table, the convention is: the engine that needs it first creates the migration in its directory, and other engines depend on it being applied. Alternative: a `rec-engines/shared/migrations/` directory for genuinely cross-engine schema (TBD if that pattern is needed).

## Engines in this directory

| Engine | Phase | Status | Notes |
|---|---|---|---|
| `content-similarity` | Phase 0 | Scaffolding | Foundation engine; pure metadata-based scoring; the always-available cold-start baseline |

(Update this table as engines are added, graduated, or removed.)
