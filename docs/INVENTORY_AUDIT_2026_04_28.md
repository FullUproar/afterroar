# Inventory System Audit — Across All Product Categories

**Goal:** evaluate how well Afterroar's inventory model serves every product category an FLGS or hybrid game/comic shop sells, both today and at the intended end-state.

**Method:** Read of `PosInventoryItem`, `PosCatalogProduct`, and the related models (Break, TradeIn, GameCheckout, Menu, InventoryHold). Read of the inventory edit UI and the singles/sealed/checkout surfaces. Grading is honest — A/B/C/D/F per category, today and end-state.

Last updated 2026-04-28.

---

## How the inventory model is structured

Two tables matter most:

- **`PosInventoryItem`** — store-scoped. The actual sellable thing on a shop's shelf. Has core fields (name, category, sku, barcode/barcodes, price, cost, qty, low_stock_threshold), variant relationship (parent_id/variant_label), shipping dims, channel listing IDs (shopify/ebay/cardtrader/manapool), and a generic `attributes` JSON column for category-specific data.
- **`PosCatalogProduct`** — federated catalog. Master metadata shared across stores. Has TCG fields (oracle_id, mana_cost, type_line, rarity, prices, image_uri, etc.), board-game fields (bgg_id, ratings, players, mechanics, themes), sealed fields (cards_per_pack, packs_per_box), and a parallel `attributes` JSON.

Categories supported in code: `tcg_single`, `sealed`, `board_game`, `miniature`, `accessory`, `food_drink`, `other`. **No category exists for comics, RPGs, or collectibles** — they all map to `other` or `accessory` today.

Specialty satellite models that wrap inventory:
- `PosBreakRecipe` + `PosBreakEvent` — sealed-to-singles conversion (TCG)
- `PosTradeIn` + `PosTradeInItem` — buy-from-customer flow
- `PosGameCheckout` — game library lending
- `PosMenuItem` + `PosMenuModifier` — cafe menu (separate from inventory entirely)
- `PosInventoryHold` — customer holds

Category-specific data (foil, condition, set, edition, etc.) lives in `attributes` JSON. This is flexible but means those fields aren't indexed, searchable, or first-class in the UI.

---

## 1. Board games — today: B+ / end-state: A

**Today:**
- `PosCatalogProduct` has rich BGG fields: bgg_id, bgg_rating, bgg_weight, min/max_players, min/max_play_time, min_age, mechanics, themes
- BGG integration ships
- Variant relationship handles "different boxes / editions of same game"
- Game library lending via `PosGameCheckout` is wired in
- Operational basics: low_stock, reorder_point, lead_time_days, supplier link
- Shipping dims for online sales

**Gaps:**
- No "edition" field surfaced as a first-class column (kickstarter-edition, deluxe-edition, retail-edition). Lives in attributes or variant_label
- No "language" field (matters for European publishers, Japanese imports). Attributes JSON
- No "expansion-of" relationship modeled. A board game expansion is not the same as a variant; you'd want to know "this expansion requires Pandemic base"
- Open-box / play-copy status: would want a `condition` field for used board games (some shops do trade-ins)

**End-state:** Add `edition`, `language`, `expansion_of_id` to the model. Promote `condition` for used/trade-in stock. UX should detect category=board_game and surface the BGG metadata + lending status.

## 2. TCGs (singles + sealed) — today: A- / end-state: A+

**Today (singles):**
- Scryfall metadata sync into `PosCatalogProduct` (oracle_id, type_line, rarity, color_identity, prices, image_uri, etc.)
- `foil` and `condition` stored in `attributes` JSON
- Channel listings: cardtrader, manapool, ebay (ManaPool/CardTrader are TCG-specific marketplaces — clear category awareness)
- Singles dashboard surfaces foil + condition badges
- Buylist evaluation tooling exists at `/dashboard/singles/evaluate`
- Pricing tooling at `/dashboard/singles/pricing`

**Today (sealed):**
- `sealed` category with cards_per_pack, packs_per_box, contents_description on the catalog
- BreakRecipe lets you convert sealed → singles (booster box → 36 packs → loose cards)
- BreakEvent audit trail for the conversion
- Sealed EV calculator at `/dashboard/catalog/sealed-ev`

**Gaps:**
- `foil` and `condition` should be first-class columns, not attributes JSON. They're THE primary axes of TCG single inventory. Indexing matters when you have 50,000 cards
- No "language" first-class (non-English Magic singles). Attributes
- No "graded" status (BGS/PSA/CGC slabs). Attributes
- No "signed" status. Attributes
- TCGPlayer integration is the gap we know about

**End-state:** Promote foil, condition, language, graded_status to columns. Add TCGPlayer alongside the existing Scryfall/CardTrader/ManaPool wiring. Singles search becomes filterable on these columns, not attribute-text.

## 3. RPGs — today: D+ / end-state: B+

**Today:**
- No `rpg` category exists. RPG books default to `accessory` or `other`
- No D&D Beyond / DriveThruRPG metadata integration
- No system/edition fields (D&D 5e, Pathfinder 2e, Call of Cthulhu, etc.)
- BGG actually catalogs RPGs (RPGGeek subset of BGG) but our integration doesn't surface RPG-specific fields

**Gaps:**
- Add `rpg` as a first-class category
- Fields: `system`, `edition`, `book_type` (core / supplement / adventure / module / setting), `setting`
- DriveThruRPG metadata sync (their catalog API is OK, RPG-specific)
- RPGGeek IDs as a parallel to BGG IDs

**End-state:** Most FLGS RPG inventory is books. Treat them like board game expansions but with system/edition awareness. Roll20 / D&D Beyond integrations would be premium.

## 4. Miniatures — today: C / end-state: A-

**Today:**
- `miniature` category exists in the dropdown
- Zero specialized fields. Everything lives in attributes JSON
- No painted-vs-unpainted state, no scale, no system (Warhammer 40k vs AoS vs Bolt Action vs Star Wars Legion vs Battletech)
- No army/faction grouping

**Gaps:**
- Fields needed: `system` (40k/AoS/etc), `faction`, `unit_type` (HQ/Troop/Elite for 40k-style games), `scale` (28mm/15mm/etc), `material` (plastic/resin/metal), `state` (sealed/sprued/assembled/primed/painted)
- Variant relationship to model "blister vs box of same unit"
- Optional: paint commission tracking (some shops offer this as a service)

**End-state:** GamesWorkshop publishes a product catalog you can scrape/license. Wargames Atlantic, Atomic Mass, Battletech also have catalogs. A miniatures-aware UX would surface these fields and let staff filter by system/faction.

## 5. Cafe — today: B / end-state: A-

**Today:**
- Separate `PosMenuItem` model (NOT in `PosInventoryItem`). Different table, different lifecycle
- `PosMenuModifier` for "size / milk / extras" with multi-select + applies_to
- Categories: drink / food / snack / alcohol / other
- `age_restricted` flag for alcohol
- Available toggle, sort_order

**Gaps:**
- No ingredient-level inventory. Selling an espresso doesn't decrement coffee beans, milk, syrup. For a low-volume FLGS cafe this is fine. For a real cafe operator you'd want recipes
- No nutrition / allergen fields
- No prep time
- No POS-side "mark items 86'd" UI (sold out today only, vs `available=false` permanent)

**End-state:** Recipe model linking PosMenuItem to PosInventoryItem ingredients with quantities. Bidirectional: making a coffee decrements beans + cup + lid. Allergen/nutrition fields. 86-list separate from availability.

## 6. Game Library — today: B+ / end-state: A

**Today:**
- `lendable` boolean on PosInventoryItem
- `PosGameCheckout` model with checkout/return workflow, due dates, return_condition, return_notes, fee_cents
- Status enum: out / returned / overdue
- Linked to customer + staff for accountability

**Gaps:**
- No deposit-on-checkout tracking (some shops require a credit card swipe or cash deposit)
- No "library copy" vs "store copy" distinction. If you stock the same game for sale AND lending, you want separate quantity buckets
- No reservation/queueing (customer wants Gloomhaven; it's checked out; let me reserve next-available)
- No condition tracking per copy (book 1 of game has a torn rule sheet; book 2 is mint). The checkout's `return_condition` is per-event, not per-copy

**End-state:** Library copies tracked separately as variants of the saleable item, with per-copy condition history. Reservation queue. Optional deposit hold.

## 7. Tournament & competitive play — today: C+ / end-state: A-

**Today:**
- `PosTournament` + tournament-related models exist (saw `pos_tournaments`, `network_tournaments`, `tournament_players`, `tournament_player_ratings`)
- Inventory side: not really wired into tournaments. A booster pack for prize support is just a regular inventory_item
- No "prize pool" allocation tracking (these 36 packs are reserved for Friday Night Magic)
- No event-fee inventory category (tournament entries as products)

**Gaps:**
- Inventory holds for prize support: "reserve 36 packs from this case for Saturday's tournament"
- Event fees as first-class inventory entries (so they show in sales reports correctly)
- Player check-in linked to inventory consumption (entering the event auto-deducts the entry "product")
- Round timer, pairings, results — different surface, but should hook back to inventory for prize disbursement

**End-state:** Tournament workflow consumes inventory holds, awards prize-support inventory back to players (transferring from "store stock" to "customer credit / customer inventory" cleanly).

## 8. Comic books — today: D / end-state: B+

**Today:**
- No `comic` category. Defaults to `other` or `accessory`
- No specialized fields anywhere
- No GCD (Grand Comics Database) integration
- No pull-list management
- No NCBD weekly cycle awareness
- No back-issue grading fields

**Gaps:**
This is the largest gap of any category, given comics-store overlap with FLGS. To reach baseline-pitch viability:
- Add `comic` category
- Fields: `series_title`, `issue_number`, `variant`, `cover_artist`, `publisher`, `release_date`, `is_variant_cover`, `is_one_shot`, `condition` (NM, VF, FN, GD, etc.)
- GCD integration for metadata lookup
- (Future) Pull-list management as separate model: subscribers, weekly batching, allocation
- (Future) Back-issue grading: `cgc_grade`, `cgc_serial`, `cbcs_grade`, `cbcs_serial`, `is_signed`, `signed_by`

**End-state:** Comic-shop owners see their workflow as first-class. Pull lists are the killer feature; GCD lookup is the table-stakes feature.

## 9. Adjacent collectibles (figurines, apparel, accessories, signed/limited) — today: D+ / end-state: B

**Today:**
- `accessory` category exists, no specialized handling
- `attributes` JSON could hold size/color/edition_size/signed/etc. but it's not surfaced anywhere in UI
- No size/color variant matrix (a t-shirt in 5 sizes × 3 colors)
- No edition tracking ("1 of 500", "signed by [creator]")

**Gaps:**
- Variant matrix: size + color combinations as variants of a parent. Today's parent_id/variant_label handles this with manual setup but the UX doesn't generate the grid
- Fields for collectibles: `edition_size`, `edition_number`, `signed_by`, `is_limited`, `manufacturer`, `scale`, `franchise`
- Funko-style metadata (number, exclusive, rarity, vault status)

**End-state:** Apparel size/color matrix UX. Collectible edition tracking. Optional integrations with Funko, Hot Toys, Sideshow catalogs.

## 10. Adaptability to future niche products — today: B / end-state: A-

**Today:**
- `attributes` Json column on both PosInventoryItem and PosCatalogProduct is a real escape hatch. New product types can store any fields without schema migration
- Category enum is a `String` not a Prisma enum, so adding a new category is a code change but not a DB migration
- Variant relationship via `parent_id` is generic enough to model most product hierarchies
- `external_ids` JSON on PosCatalogProduct is a clean way to add new external catalog integrations

**Gaps:**
- The escape hatch hides as well as it adapts. A field in `attributes.foil` doesn't surface in search, indexing, or UI without code touching
- Pattern: when we promote a niche field to first-class (foil → column), we have to do migration + UI update + search update. Don't have a "promote attribute" workflow yet
- No registry of "what attributes exist for category X" — staff have to know to type the right keys

**End-state:** A category-attribute schema (per-category list of expected attributes with type + label + searchability flag) so the UI dynamically renders the right fields, and search auto-knows what's filterable. This is the platform-level investment that would pay off across every category.

## 11. Does each category feel like a first-class citizen?

This is the most important question. The honest answer:

| Category | First-class today? |
|---|---|
| TCG singles | **Mostly yes.** Dedicated dashboard, dedicated metadata surfacing, foil + condition badges in UI. Foil/condition still in attributes JSON though. |
| Sealed product | **Mostly yes.** Sealed-EV calculator, BreakRecipe model, dedicated UI. |
| Board games | **Yes for metadata (BGG), no for variants/editions/used.** Lending UI exists. |
| RPGs | **No.** No category, no metadata, no surfaces. |
| Miniatures | **No.** Category exists but everything else is generic. |
| Cafe | **Yes for menu, no for inventory link.** Separate model gives focus but breaks ingredient-level tracking. |
| Game library | **Yes for checkout flow, partially for the inventory side.** |
| Tournaments | **Partially.** Tournament tooling exists but inventory hooks are weak. |
| Comic books | **No.** Effectively unsupported. |
| Collectibles | **No.** Generic accessory bucket. |

The pattern: **TCG and board games are first-class citizens. Cafe is mostly there. Everything else is "you can store it but the system doesn't know what to do with it."**

UX-wise, the inventory edit form does check `category === "board_game"` for at least one branch (the condition I read). That's the seed of category-aware UX, but it's not extensively built out.

## 12. What we're explicitly NOT covering (today)

Honest list, even if we'd want most eventually:

- **Comic pull lists** (subscriber-managed weekly issue commitments). ✅ Shipped 2026-04-29 — see `/dashboard/pull-lists` (subscriber CRUD, allocation states pending → held → fulfilled, weekly receive workflow at `/dashboard/pull-lists/receive`). Schema: `PosPullList` + `PosPullListItem`.
- **Comic back-issue grading** (CGC/CBCS slab metadata + lookup).
- **Cafe ingredient-level tracking** (recipes that decrement raw inventory).
- **Apparel size × color variant matrices** as a UI primitive.
- **Miniatures system/faction/state classification.**
- **RPG system/edition/book-type classification.**
- **Used / trade-in board game condition.**
- **Library deposits / reservations.**
- **Tournament prize-pool inventory holds.**
- **Limited edition / signed / numbered collectibles tracking.**
- **Receiving comics from Diamond/Lunar/PRH weekly catalogs** (different supply chain than games distribution).
- **Free Comic Book Day inventory allocation rules** (limit-N-per-customer-on-a-specific-day).

## Summary table

| Category | Today | End-state | Critical gap |
|---|---|---|---|
| Board games | B+ | A | Edition, language, expansion-of, used-condition |
| TCGs | A- | A+ | Promote foil/condition to columns; TCGPlayer |
| RPGs | D+ | B+ | Category + system/edition/book-type fields |
| Miniatures | C | A- | System/faction/state fields, painted status |
| Cafe | B | A- | Recipe-based ingredient decrement |
| Game Library | B+ | A | Library-copy separation, deposits, reservations |
| Tournament | C+ | A- | Inventory holds for prize pool, event-fee products |
| Comics | D | B+ | Category, fields, GCD, pull lists (later) |
| Collectibles | D+ | B | Variant matrices, edition fields |
| Adaptability | B | A- | Per-category attribute schema with UI auto-render |

## Recommended near-term work (matches the today-or-tomorrow priority)

For a "reasonable comic pitch" minimum viable:

1. **Add `comic` category + the core comic fields** as JSON-attribute schema (series, issue, variant, cover_artist, condition). About 1 hour, no migration if we use `attributes`.
2. **GCD baseline integration** — search/lookup endpoint that mirrors Scryfall's pattern. About 2-3 hours.
3. **Inventory edit UI: render different fields based on category.** Already partially there (board_game branch exists); extend to comic. About 1-2 hours.

Total: half a day. Brings comic-store pitch from "no" to "demoable."

The bigger investments (pull lists, the per-category attribute schema framework, the proper variant matrix UX) belong on a later sprint.
