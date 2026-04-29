# Data Integrations Strategy

**Thesis.** Generic POS systems (Clover, Square, Toast) win on breadth — they cover every retail vertical with the same surface. Their inventory model is "name, sku, price, qty." That's where they stop. They cannot tell a foil card from a non-foil card. They cannot tell Cover A from Cover B. They cannot tell a 40k Space Marine box from a Star Wars Legion squad. For specialty shops these gaps aren't edge cases — they're the operating reality, every day, on every receive and every sale.

Afterroar's wedge is the inverse: **deep depth in indie retail by being the POS that knows the data.** And we get that knowledge for nearly free by integrating with the community-curated databases that *already* know it. BoardGameGeek for board games. Scryfall for MTG. Grand Comics Database for comics. Discogs for vinyl. Each of these is a decade-plus of community-contributed metadata that no competitor can replicate quickly. If we plug into all of them natively, we sit on top of a moat that any generic POS would need years and serious investment to fill.

> **"Your POS shouldn't make you re-type what BGG/Scryfall/GCD already know."**

This doc is the strategy framing, the inventory of integrations today, the priority order for what's next, and the architecture that lets us scale this without forking the system per source.

Last updated 2026-04-29 (overnight session).

---

## Why this is a moat (and not just a feature)

Each integration produces compound value:

| Dimension | What it gives | Why competitors can't copy |
|---|---|---|
| **Demo unlock** | Scan a card → it auto-populates with set, foil status, current market price, image | Competitors don't have the data, can't fake the wow moment |
| **Daily time-saver** | Receiving a comic shipment goes from 30s/issue to 3s/issue | Aggregates across thousands of products, hundreds of shipments/year |
| **Pricing intelligence** | Live secondary market data feeds pricing decisions | The data sources won't license to a generic POS that gives them no upside |
| **Network effect** | More shops on Afterroar → more verified catalog data → better metadata for everyone | Standard supply-side network effect; flywheel for those who go first |
| **Vertical optionality** | Same architecture supports bookstore (Open Library), record store (Discogs), etc. | Generic POS can't do this without forking their schema per vertical |

Generic POS *can't catch up here* without acquiring one of these data sources. Most are non-profits or community-driven and don't sell. The ones that are commercial (TCGPlayer for example) gate access tightly enough that no horizontal POS will pay the partnership cost for a feature ~5% of their customers care about.

Afterroar is built so that 100% of our customers care.

---

## State of integrations today

Status legend: ✅ live · ⏳ blocked · 📋 queued · ❌ gap · 🌟 future-vertical

### TCG-side
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **Scryfall** | ✅ Live | MTG: oracle_id, mana cost, type line, rarity, prices, image, legalities | TCG singles, sealed |
| **TCGPlayer** | ⏳ Blocked on biz call | Cross-TCG pricing + listing | All TCG categories |
| **ManaPool** | ✅ Wired (outbound) | TCG marketplace listings | TCG singles |
| **CardTrader** | ✅ Wired (outbound) | TCG marketplace listings | TCG singles |
| **eBay** | ✅ Wired (outbound) | Marketplace listings | All categories |
| **Pokemon TCG API** | 📋 This session | Pokemon catalog (Scryfall is MTG-only) | TCG singles (Pokemon) |
| **One Piece TCG / Lorcana / FAB** | ❌ Gap | These don't have great public APIs; light scraping or community-DB-of-the-month | TCG singles (long tail) |

### Board games
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **BoardGameGeek (BGG)** | ✅ Live | id, rating, weight, players, play_time, mechanics, themes | Board games, RPGs (via RPGGeek subset) |
| **BoardGameAtlas** | ⛔ Shut down (early 2026, DNS no longer resolves) | Was the planned BGG fallback | Board games |
| **Geekdo XML2** | (subset of BGG) | Bulk price tracking | Board games (advanced) |

### RPGs
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **RPGGeek (BGG subset)** | ✅ Partial | RPG metadata via BGG's RPGGeek subset | RPGs |
| **DriveThruRPG** | 📋 This session | Authoritative RPG retail catalog | RPGs |
| **Roll20 / D&D Beyond product linking** | ❌ Future | Premium link-out for VTT compatibility | RPGs (premium) |

### Comics
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **ComicVine** | 📋 This session | Series, issue, creators, variants — multi-publisher | Comics |
| **Grand Comics Database (GCD)** | ❌ Gap | Deepest community-curated comics metadata; no clean public API but bulk data dumps available | Comics |
| **Diamond / Lunar / PRH** | ❌ Gap | Weekly distributor catalogs (NCBD prep, buy sheets) | Comics ops |
| **CGC / CBCS** | ❌ Gap | Graded comic slab serial lookups | Comics secondary market |
| **Marvel / DC official APIs** | ❌ Gap | Limited but exist | Comics (publisher-specific) |

### Miniatures
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **Games Workshop** | ❌ Gap | 40k / AoS catalog. No public API but webstore is reliably parseable | Miniatures (40k, AoS) |
| **Wargames Atlantic** | ❌ Gap | Indie historical miniatures | Miniatures (historical) |
| **Atomic Mass Games** | ❌ Gap | Star Wars Legion, Marvel Crisis Protocol | Miniatures (modern) |
| **Catalyst (Battletech)** | ❌ Gap | Battletech catalog | Miniatures (mech) |

### Collectibles
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **Funko Pop database / Pop Price Guide** | ❌ Gap | Funko catalog + secondary pricing | Collectibles (Funko-heavy) |
| **Hot Toys / Sideshow** | ❌ Gap | High-end collectible catalog | Collectibles (premium) |

### Universal / cross-category
| Source | Status | What it gives | Used by |
|---|---|---|---|
| **Open Library + ISBN** | ✅ Live | Books (graphic novels, RPG books, anything with ISBN) | Comics (TPBs/HCs), RPGs, books |
| **UPC database** | ✅ Live | Barcode → name/manufacturer for unknown products | Universal fallback on receive |
| **Open Food Facts** | ✅ Live | Cafe nutrition + allergens + ingredients + barcode + name search | Cafe + food_drink retail |

### Future-vertical (when we expand beyond games/comics)
| Source | Status | Future use |
|---|---|---|
| **Discogs** | 📋 Adapter scaffolded, inactive (no `vinyl` ItemCategory yet) | Vinyl / record stores |
| **MusicBrainz** | 📋 Adapter scaffolded, inactive | Backup music metadata |
| **Edelweiss / Above the Treeline** | ❌ Gap | Indie bookstore inventory + ordering |
| **WorldCat** | ❌ Gap | Backup book metadata |

---

## Priority order (now → next quarter)

In order of demo-impact-per-effort. Estimates assume the architecture pattern (catalog adapter module → maps to PosCatalogProduct external_ids + attributes) is reusable, which it is.

1. **ComicVine adapter** (~2-3h once the API key is in env). Lifts Comics from A- to A. Comic shop demo unlock.
2. **DriveThruRPG adapter** (~2-3h). Public-or-near-public catalog. Lifts RPGs from A- to A.
3. **Pokemon TCG API adapter** (~1.5h). Public. Closes the "we're MTG-only" gap.
4. **Open Library / ISBN adapter** (~1.5h). Universal book metadata. Useful for graphic novels + RPG books + future bookstore vertical.
5. **UPC fallback adapter** (~1.5h). Public sources for unknown barcodes — useful on first receive for products we don't yet have catalog records for.
6. **TCGPlayer** (blocked on biz, ~3-4h once unblocked). Single biggest TCG-side win when access opens.
7. **Games Workshop / Wargames Atlantic** (~4-6h each). No public API — careful structured parsing of webstore. Demo unlock for miniatures-heavy shops.
8. **Diamond/Lunar/PRH weekly catalog** (~6-8h). Operational, not metadata. Killer feature for pure-comics shops. Worth its own focused session because it touches receiving + buy-sheet generation, not just metadata enrichment.
9. **Funko / Pop Price Guide** (~3-4h). Collectibles depth.
10. **CGC / CBCS slab lookups** (~2-3h). High-end TCG/comic resale workflow.

---

## Architecture pattern

The adapter pattern is already established by Scryfall:

```
                   ┌─────────────────────┐
                   │ External data source │   (Scryfall / BGG / ComicVine / …)
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Source adapter     │   apps/ops/src/lib/integrations/<source>.ts
                   │  - search(q)         │   Each adapter exports a small uniform
                   │  - lookup(id)        │   surface; concrete implementation per source.
                   │  - mapToCatalog(rec) │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ PosCatalogProduct   │   external_ids JSON has every source's ID.
                   │  + external_ids     │   attributes JSON has source-mapped fields.
                   │  + attributes       │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ PosInventoryItem    │   Per-store cache of the catalog record,
                   │  - catalog_product_id│   with store-specific price, qty, condition
                   └─────────────────────┘
```

Concretely, for any new source:

1. Add an entry in `lib/integrations.ts` registry (declares status, env-var requirements, capabilities, last-tested timestamp).
2. Implement an adapter at `lib/integrations/<source>.ts` that exposes:
   - `search(query: string)` — text search returning candidate matches
   - `lookup(externalId: string)` — fetch a single record by source's ID (or barcode)
   - `mapToCatalog(record)` — normalize the source's shape into our catalog/attribute fields
   - `testConnection()` — health-check ping for the integrations dashboard
3. Add API route(s) at `/api/catalog/<source>/...` for the inventory edit page to call.
4. Wire a "Lookup from <source>" button on the inventory edit page (gated by category + adapter availability).

That's the whole pattern. Adding a new source is "follow the Scryfall implementation in N hours."

### Per-store API key model

Some sources (ComicVine, eventually TCGPlayer) require an API key. We ship the adapter wired to read from a configured key, with three options for where the key lives:

1. **Platform-wide key** — Afterroar holds the partnership, all stores share. Best for free/cheap APIs.
2. **Per-store key** — store enters their own in `/dashboard/settings/integrations`. Best for paid APIs where the store has their own account.
3. **Hybrid** — platform key as fallback, store can override.

Default: platform-wide for free APIs, per-store for paid. The integrations dashboard surfaces "needs key" status when missing.

---

## What this gives us in pitches

Three sentences for sales decks:

> Afterroar is the only POS that natively integrates with the data platforms FLGS and indie retailers actually use. Receiving a Magic shipment is one barcode scan and the card record auto-populates with current market price. Receiving a comic shipment is one scan and you get series, issue, cover variant, and creator credits — all without leaving the POS.

For comparisons:

| Capability | Square / Clover / Toast | Afterroar |
|---|---|---|
| Add a foil card to inventory | Type the name + variant manually | Scan barcode → done |
| Add a comic with cover variant | Type series + issue + variant manually | Scan barcode → done |
| Receive a board game | Type name → maybe Google for player count | Scan barcode → BGG metadata auto-populates |
| Receive a Funko Pop | Type name + figure number manually | Scan barcode → catalog match |
| Track market pricing for TCG singles | Manual + spreadsheet | Live from Scryfall, soon TCGPlayer |
| Run a tournament | "What's a tournament?" | Built-in: tickets, prize pool, bracket, check-in |

This is the version of the deck we want to build toward.

---

## What this doc is NOT

- This is **not a partnership pitch deck** for the data sources themselves. Most don't need to be "partners" — Scryfall, BGG, Open Library, ComicVine all serve our needs through their public APIs without formal partnerships.
- This is **not a free-pass to scrape**. For sources without public APIs (Games Workshop, Diamond), we go through the right channels first — affiliate programs, partner programs, retailer-only feeds. Scraping is the last resort and only when their TOS allows it.
- This is **not the FLGS roadmap**. FLGS-specific feature work (Connect, HQ, etc.) is its own track. This doc covers the data-integration layer that all that work sits on top of.
