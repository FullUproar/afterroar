# POS Integration Reference

API documentation and migration guides for source POS systems that Afterroar Store Ops can import from.

## Migration Tiers

| Tier | Systems | Approach | Confidence |
|------|---------|----------|------------|
| 1 — Fully Automatable | Shopify, Square | API-first, CSV fallback | Green |
| 2 — Partial Automation | Clover, Lightspeed, BinderPOS, SortSwift | API or CSV depending on access | Yellow |
| 3 — Manual Assist | CrystalCommerce, ShadowPOS | CSV-only, manual field mapping | Red |
| Special | TCGplayer | Catalog/pricing reference only (not a source POS) | N/A |

## Files

- [shopify.md](shopify.md) — Shopify Admin API (GraphQL + REST)
- [square.md](square.md) — Square APIs
- [clover.md](clover.md) — Clover REST API
- [tcgplayer.md](tcgplayer.md) — TCGplayer API (catalog/pricing)
- [lightspeed.md](lightspeed.md) — Lightspeed eCom API
- [binderpos.md](binderpos.md) — BinderPOS (CSV-based)
- [migration-architecture.md](migration-architecture.md) — Canonical model, pipeline design, validation strategy
