# Rec Engines

Experimental recommendation engines built under silo discipline. The platform's long-term recommendation strategy is multiple engines running in parallel with A/B-tested traffic distribution; this directory is where they live during development.

## Read first

- [`SILO.md`](./SILO.md) — the constitution. Rules every engine here must follow.
- [`content-similarity/docs/recommendation-engine-design.md`](./content-similarity/docs/recommendation-engine-design.md) — the architectural design doc that informs all engines in this directory. Lives under `content-similarity/` because that's the foundation engine all others build on, but applies to the whole roadmap.

## Engines

- [`content-similarity/`](./content-similarity/) — Foundation engine. Pure BGG metadata-based scoring. Phase 0 scaffolding.

## Adding a new engine

See [`SILO.md`](./SILO.md) § "Adding a new engine".

## Integration with production

Production code never imports from this directory. Integration happens via HTTP only (the rec engines expose endpoints under `/api/recs/<engine-name>/...`). A production-side "rec router" (not yet built; lives in `apps/me` or a dedicated package) is responsible for:

- Routing recommendation requests to the appropriate engine(s) based on A/B configuration
- Aggregating results when running shadow mode (multiple engines on same request, log all, return one)
- Feature-flag enforcement
- Caller authentication (which production app is asking)

The rec router is a Phase 1+ concern. During Phase 0, engines are accessed only via internal admin tooling.
