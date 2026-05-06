# Full Uproar Recommendation Engine — Design Doc

> **Source:** Architecture discussion, May 2026.
> **Status:** Design proposal, pre-implementation. Phase 0 scaffolding committed.
> **Caveat:** This doc was written from a strategic conversation, not by reading the live codebase. Where it references existing models/tables (e.g. `BoardGameMetadata`, `pos_catalog_products`), verify against the current schema before wiring up — the platform is a moving target. Flag inconsistencies as you encounter them.

---

## 0. TL;DR

We're building a recommendation engine that:

1. **Ships a useful v0 in days** using only BGG metadata and a 30-second onboarding flow. No internal data required.
2. **Grows into a genuinely differentiated system** as game-night plays, votes, trades, and store data accumulate — without re-architecting.
3. **Powers three distinct surfaces** off a shared core: HQ game-night picker, Passport personal library/next-game suggestions, POS store-inventory buy-side intelligence.
4. **Eventually beats BGG** not through cleverer ML, but by having data BGG structurally cannot collect: real attributed plays with group context, willingness votes, trade-in events (negative signal!), and cross-store velocity.

The architectural commitment: **the graph schema and the recommendation API contract are stable from day one. The ranker behind the API is swappable.** That's what lets us ship the dumbest possible thing first and evolve into a Monte Carlo social simulator without changing the surfaces or the data layer.

---

*[Full design doc content preserved from prior commit; see git history of `rec-engines/content-similarity/docs/recommendation-engine-design.md` at commit f5d54ef for the complete spec. The doc was moved to this path during Sprint 0.0.1 (rename to mimir). Content is unchanged.]*

*Note for future readers: the next sprint that touches this doc should re-inline the full content rather than reference history. The above pointer is a temporary expedient during the rename sprint to keep the push payload small over a flaky connection.*
