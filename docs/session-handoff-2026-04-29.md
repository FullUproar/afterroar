# Overnight Session Handoff — 2026-04-29

Shawn's directive at session start: *"a strategy doc and I need a place to monitor the connection status, etc. Let's do it... this is overnight work. Start building out the connections as much as possible. Priority on data connections, but do anything you can to get us to A+. Don't push, we'll look in the morning and then push. You've got many hours before I'm back, so go nuts and do it all."*

## What shipped

**Nothing pushed.** Everything is local. Type-check is clean (`npx tsc --noEmit` green in `apps/ops`).

### 1. Data integrations strategic foundation

- `docs/DATA_INTEGRATIONS_STRATEGY.md` — the doctrine doc. Thesis is: generic POS systems win on breadth, Afterroar wins on depth via the community-curated databases (BGG, Scryfall, GCD, ComicVine, Open Library, Discogs, ...). 14 integrations catalogued with status, priority order top → bottom, architecture pattern, sales-pitch table.
- `apps/ops/src/lib/integrations/registry.ts` — declarative registry of every integration: id, name, kind (metadata/marketplace/pricing/distributor/payment/barcode), categories it serves, required env vars, capabilities, active flag, priority. Single source of truth.
- `apps/ops/src/lib/integrations/types.ts` — `CatalogAdapter` interface (search / lookup / mapToCatalog / testConnection).

### 2. Five new catalog adapters

| Adapter | File | Notes |
|---|---|---|
| Pokemon TCG | `lib/integrations/pokemon-tcg.ts` | Public API, no key. Closes "we're MTG-only" gap. |
| DriveThruRPG / RPGGeek | `lib/integrations/drivethrurpg.ts` | Uses BGG xmlapi2 with type=rpgitem. |
| Open Library | `lib/integrations/open-library.ts` | ISBN + title search; categorizes books as comic/rpg/other based on subjects. |
| ComicVine | `lib/integrations/comicvine.ts` | Requires `COMICVINE_API_KEY` — adapter ships ready, status reads "unconfigured" until key lands. |
| UPC fallback | `lib/integrations/upcdb.ts` | UPCitemdb trial + Open Food Facts fallback for unknown barcodes on receive. |

All five register in `apps/ops/src/lib/integrations/index.ts` (the `getAdapter(id)` dispatcher).

### 3. Integrations dashboard + status persistence

- `PosIntegrationStatus` schema model (`packages/database/prisma/schema.prisma` ~line 1305) — one row per `(store_id?, integration_id)`. `store_id` nullable for platform-wide integrations. Holds last_tested_at, last_latency_ms, last_error, status, config JSON.
- `/dashboard/integrations` (`apps/ops/src/app/dashboard/integrations/page.tsx`) — grouped by kind, each row shows status pill + last-tested + latency + error. "Test" button per integration; "Test all" runs sequentially to avoid pummelling sources.
- API: `/api/integrations` (list + status overlay), `/api/integrations/[id]/test` (POST runs adapter.testConnection() + persists), `/api/integrations/[id]/search` (GET q=), `/api/integrations/[id]/lookup` (GET ext_id= or barcode=).
- Sidebar nav: new "Integrations" entry between Devices and Settings.

### 4. Inventory edit "Lookup from catalog" widget

- `apps/ops/src/components/inventory/catalog-lookup.tsx` — reads the integrations registry, filters by current item's category, exposes "Lookup from <source>" buttons. Each opens a search dialog; picking a result prefills name + image + category-specific attributes via the `onApply` callback.
- Wired into `apps/ops/src/app/dashboard/inventory/[id]/page.tsx` directly above the per-category attribute fields.

### 5. Comics pull-list management (full vertical)

This is the killer feature for comic-shop pitches. Schema, APIs, UI all done.

- Schema: `PosPullList` + `PosPullListItem` (already added; line ~1236 in schema.prisma). Pull list = subscription. Item = per-issue allocation, state machine pending → held → fulfilled (or skipped/expired).
- APIs:
  - `/api/pull-lists` — GET (filterable by customer/series/status) + POST (creates, rejects duplicate active lists).
  - `/api/pull-lists/[id]` — PATCH (update qty/notes/status) + DELETE (soft-cancel).
  - `/api/pull-lists/[id]/items` — GET (list) + POST (manually add an issue with default 90-day hold).
  - `/api/pull-lists/[id]/items/[itemId]` — PATCH (status transitions, stamps held_at/fulfilled_at + bumps parent's last_pickup_at on fulfill) + DELETE.
  - **`/api/pull-lists/allocate`** — POST bulk-allocate this week's incoming issues to all matching active subscribers. Skips dups; respects `wants_variants`.
- UI:
  - `/dashboard/pull-lists` — list, KPI strip (active subs, paused, issues pending, issues held), status filter pills, search by series, create dialog with customer typeahead.
  - `/dashboard/pull-lists/[id]` — subscriber detail + allocations grid with state-transition action buttons (Mark Held / Picked Up / Skip / Reopen). Pause/Resume/Cancel List in the header.
  - `/dashboard/pull-lists/receive` — **the weekly Wednesday workflow.** Paste a comma/tab/pipe-separated list of incoming issues, hit Allocate, get a per-row report of `+N allocated`, `M duplicates`, or `no pull list`. Variants only allocate to subscribers who opted in.
- Sidebar nav: new "Pull Lists" entry between Customers and Reports.

## How to verify in the morning

1. **Run dev server:** `cd apps/ops; pnpm dev` (or whatever you usually run).
2. **Integrations dashboard:** navigate to `/dashboard/integrations`. You should see all 14 sources grouped by kind. ComicVine + UPCitemdb will be `Unconfigured` (need keys); Pokemon TCG / Open Library / DriveThruRPG should test green.
3. **Lookup widget:** open any inventory item with category=comic or category=rpg. Below the "Catalog metadata" section, "Lookup from catalog" panel surfaces the adapters relevant to the item's category.
4. **Pull lists end-to-end:**
   - `/dashboard/pull-lists` → New Pull List → pick a customer → create.
   - Click into the new list → Add Issue → fills in.
   - Mark Held → Picked Up → confirm last_pickup_at populates on the list.
   - `/dashboard/pull-lists/receive` → click "Use sample" → Allocate → watch the per-row results.

## Known gaps / not done

- **Did not push.** Per directive.
- **Did not run the full test suite.** Type-check is clean; runtime untested. Recommend a quick smoke before push.
- **Tournament prize-pool inventory holds:** schema already supports this (`PosInventoryHold.event_id` exists) but no dedicated UI was built this session — prioritized the pull-list workflow over it for FLGS pitch impact.
- **Game library copy separation:** would need a small schema migration (`library_copy_quantity` on `PosInventoryItem`). Deferred — needs a discussion with you on whether to do it or keep the simpler "lendable boolean" model.
- **Diamond/Lunar PDF/CSV ingest:** the receive workflow takes a paste, not a file upload. Direct ingest is in the strategy doc as item #8 in priority order — own focused session.
- **TCGPlayer / Games Workshop adapters:** still blocked on biz / no public API respectively.

## Files added/modified

```
docs/
  DATA_INTEGRATIONS_STRATEGY.md         (NEW)
  session-handoff-2026-04-29.md         (NEW — this file)
  INVENTORY_AUDIT_2026_04_28.md         (✅ pull-list line moved out of "not covering")

packages/database/prisma/schema.prisma
  + model PosIntegrationStatus
  + model PosPullList
  + model PosPullListItem
  (Prisma generate already ran; client regenerated)

apps/ops/src/lib/
  integrations/registry.ts              (NEW)
  integrations/types.ts                 (NEW)
  integrations/index.ts                 (NEW — getAdapter dispatcher)
  integrations/pokemon-tcg.ts           (NEW)
  integrations/drivethrurpg.ts          (NEW)
  integrations/open-library.ts          (NEW)
  integrations/comicvine.ts             (NEW)
  integrations/upcdb.ts                 (NEW)
  permissions.ts                        (+ /dashboard/pull-lists, /dashboard/pull-lists/receive)

apps/ops/src/app/api/
  integrations/route.ts                 (NEW)
  integrations/[id]/test/route.ts       (NEW)
  integrations/[id]/search/route.ts     (NEW)
  integrations/[id]/lookup/route.ts     (NEW)
  pull-lists/route.ts                   (NEW)
  pull-lists/[id]/route.ts              (NEW)
  pull-lists/[id]/items/route.ts        (NEW)
  pull-lists/[id]/items/[itemId]/route.ts (NEW)
  pull-lists/allocate/route.ts          (NEW — bulk weekly allocate)

apps/ops/src/app/dashboard/
  integrations/page.tsx                 (NEW)
  pull-lists/page.tsx                   (NEW)
  pull-lists/[id]/page.tsx              (NEW)
  pull-lists/receive/page.tsx           (NEW)
  inventory/[id]/page.tsx               (+ <CatalogLookup /> wired in)

apps/ops/src/components/
  sidebar.tsx                           (+ Integrations + Pull Lists nav items)
  inventory/catalog-lookup.tsx          (NEW)
```

## Suggested push sequence

If you like what you see:

1. `git status` to confirm only the above files changed.
2. `git diff packages/database/prisma/schema.prisma` — sanity-check the schema migrations are what you expect.
3. Push the schema first via the Node-bootstrap pattern (`scripts/db-push.js` or equivalent) to **afterroar-pos-prod** Neon project, NOT the FU-side project. Schema-push to wrong DB is the trap that cost us 7 tables on 2026-04-27.
4. Commit + push the app code in a single commit ("Data integrations + pull lists overnight build"). Co-author `Claude Opus 4.7 (1M context)`.
5. The Vercel `afterroar-ops` project (rootDirectory `apps/ops`) auto-deploys from main.

## What to discuss before the next session

- Library-copy separation: small schema change vs keep current model?
- Tournament prize-pool UI surface: where does it live (under `/dashboard/tournaments` or as a holds drawer on the tournament detail)? **Update from tail session: it's already there — TicketingPanel inside the events page handles add/release. The "missing for A+" line was wrong.** Open question is whether to add fulfill-to-winner (decrements quantity + ledger entry).
- ComicVine API key: free tier exists (rate-limited). Want me to register one for platform-wide use, or leave it for the first comic-shop customer to bring their own?
- Diamond/Lunar PDF ingest: should that be the next overnight session?

---

## Late-tail addendum (after Shawn went to bed)

Shawn checked in once more and asked which "missing for A+" gaps I could knock out tonight without his eyes. He said "do those and stage the other changes that are not biz blocked." Did the safe non-schema-touching set:

### Verified API liveness
- **Open Food Facts** ✓ (lookup + new search.openfoodfacts.org search endpoint both up)
- **Discogs** ✓
- **MusicBrainz** ✓
- **BoardGameAtlas** ✗ — DNS doesn't resolve (`api.boardgameatlas.com`). They appear to have shut down in early 2026. Marked their registry entry inactive with a shutdown note rather than ship a broken adapter.

### Tournament prize-pool UI
Investigated this one first because it was top of my "knock out tonight" pick. Found that `apps/ops/src/components/events/ticketing-panel.tsx` already renders the prize-pool block (active count, list, release button) backed by `/api/events/[id]/inventory-holds`. The "missing for A+" line in the table I gave you was wrong — it's already shipped. Tournament really is at A+. The only enhancement worth considering is a **fulfill-to-winner** action (decrements `item.quantity` + sets `hold.status='fulfilled'` + sets `hold.customer_id`), which has accounting implications I deliberately skipped without your sign-off.

### Three new catalog adapters

| Adapter | File | Active? | Why |
|---|---|---|---|
| Open Food Facts | `lib/integrations/openfoodfacts.ts` | ✅ Yes | Dedicated cafe + food_drink scanning. Adds search-by-name (UPCDB only does barcode lookup). Returns allergens + nutrition grade + NOVA group + ingredients. Independent status pill in the dashboard. |
| Discogs | `lib/integrations/discogs.ts` | ❌ No (future-vertical) | Vinyl / record store catalog. No `vinyl` ItemCategory exists yet so the inventory edit Lookup widget won't show it; flip `active: true` + add the category when a record-store pilot lands. Optional `DISCOGS_TOKEN` env raises rate limit from 25 → 60 req/min. |
| MusicBrainz | `lib/integrations/musicbrainz.ts` | ❌ No (future-vertical) | Open-data fallback to Discogs. UPC-indexed. No auth. Strict 1 req/sec rate limit (UA identifies us). |

All three registered in `lib/integrations/registry.ts` and wired into the dispatcher at `lib/integrations/index.ts`. The dashboard's "Test all" will probe them.

### What I deliberately did NOT do tonight

- **Schema migrations** (foil/condition column promotion, library-copy quantity split, recipe model, FCBD allocation rules) — every one of these requires a Prisma migration which we can't push without your eyes given the 2026-04-27 trap-path incident.
- **TCGPlayer** — biz blocked.
- **Adapters with no public API** (GW, Atomic Mass, Wargames Atlantic, Hot Toys, CGC/CBCS slab lookup, Pop Price Guide) — these need either partner channels or careful HTML parsing. Not safe for a single overnight.
- **Tournament fulfill-to-winner** — accounting touch (decrement quantity + ledger entry). Deferred for your call.

### Updated stage state

Total this overnight (full session, including the tail):
```
docs/session-handoff-2026-04-29.md      (this file, now with tail addendum)
docs/DATA_INTEGRATIONS_STRATEGY.md
docs/INVENTORY_AUDIT_2026_04_28.md      (pull-list line moved out of "not covering")

packages/database/prisma/schema.prisma
  + PosIntegrationStatus, PosPullList, PosPullListItem

apps/ops/src/lib/integrations/
  registry.ts                           (+ openfoodfacts, discogs, musicbrainz; BGA shutdown note)
  index.ts                              (+ 3 dispatcher entries)
  types.ts
  pokemon-tcg.ts, drivethrurpg.ts, open-library.ts, comicvine.ts, upcdb.ts
  openfoodfacts.ts                      (NEW tonight)
  discogs.ts                            (NEW tonight)
  musicbrainz.ts                        (NEW tonight)

apps/ops/src/lib/permissions.ts         (+ pull-lists permission map)

apps/ops/src/app/api/integrations/[id]/{test,search,lookup}/route.ts
apps/ops/src/app/api/integrations/route.ts
apps/ops/src/app/api/pull-lists/...     (4 routes)

apps/ops/src/app/dashboard/integrations/page.tsx
apps/ops/src/app/dashboard/pull-lists/{page.tsx, [id]/page.tsx, receive/page.tsx}
apps/ops/src/app/dashboard/inventory/[id]/page.tsx (+ <CatalogLookup />)

apps/ops/src/components/sidebar.tsx     (+ Integrations + Pull Lists)
apps/ops/src/components/inventory/catalog-lookup.tsx
```

Type-check after the tail session: clean (`npx tsc --noEmit` exits 0).

### Adapter count by the numbers

The integrations dashboard now shows **17 sources**:

- **6 active metadata** (Scryfall, BGG, Pokemon TCG, DriveThruRPG, Open Library, Open Food Facts) + ComicVine (active but unconfigured pending key)
- **3 active outbound marketplaces** (ManaPool, CardTrader, eBay)
- **1 active payment** (Stripe)
- **2 future-vertical scaffolds** (Discogs, MusicBrainz)
- **5 inactive / blocked** (TCGPlayer biz-blocked; BGA shut down; GCD no API; Marvel API needs key; UPCDB active but already covers most "barcode" gap)

For the demo: scan a card → Scryfall populates. Scan a comic → ComicVine (once key lands). Scan a board game → BGG. Scan a Coke → Open Food Facts hits with allergens + nutrition. Six different sources fire from one widget depending on category.

End of handoff (for real this time).

---

## Morning addendum (Shawn back, two AM tasks)

Shawn's two AM priorities: (1) push Cafe over the A- line, (2) settings UI to toggle product lines per-store, en masse, UI-only, no data loss. Both done, both unpushed, type-clean.

### Cafe → A- (B+ → A-)

Schema turned out to already be in great shape (the audit doc was stale). `PosMenuRecipe` (bill-of-materials), `sold_out_at` (86-list separate from `available`), `prep_seconds`, and `dietary_info` JSON all exist. Recipe-decrement on tab close is wired at `apps/ops/src/app/api/cafe/route.ts:292`. So the lift was pure UI:

- **`apps/ops/src/app/dashboard/cafe/menu/page.tsx`**:
  - Surfaces `dietary_info` on each row: vegan / veg / GF / DF badges in teal, "Contains N" allergen warning in yellow with hover tooltip listing them, calorie readout. Description shows when present.
  - 86-list summary band at top of page when any item is 86'd today — lists every sold-out item as chips + "Reset all 86" bulk-clear button.
  - Create modal rebuilt with all schema fields: description, prep seconds, age-restricted, full DietaryEditor (4 dietary toggles, FDA top-9 allergen chips, calories, free-text notes).
  - Per-row "Dietary" button opens a focused edit modal for just dietary_info — checkmark on the button when info is set.

No schema, no migrations. Toggling an item to vegan persists into `dietary_info.is_vegan`; flipping is_vegan auto-flips is_vegetarian on (the inverse doesn't auto-uncheck — vegan is a stricter set).

### Per-store vertical-module toggles (UI only, no data loss)

The contract: toggle a product line off, the surfaces hide; toggle back on, everything reappears exactly as it was. No DB writes triggered by toggles, no reaching into PosInventoryItem rows.

**State:** `store.settings.enabled_verticals: string[] | undefined`. `undefined` is the sentinel for "all on" (backward-compat for stores predating this). Empty array means everything off (operator's choice). Once the operator opens the panel, we always persist a concrete array.

**Module catalog** (`apps/ops/src/lib/store-modules.ts`): 9 modules — TCG, Board games, RPGs, Miniatures, Comics, Collectibles, Cafe, Events & tournaments, Packaged food & drink retail. Each declares `navHrefs[]`, `itemCategories[]`, optional `integrationIds[]`, and a `defaultOnForFlgs` flag for the eventual onboarding wizard.

**Settings panel** at `/dashboard/settings` → Operations tab → "Product Lines (verticals)" tile. Pixel-styled toggle switch per module with description + impact preview ("Will hide: 2 nav entries · 1 inventory category · 4 catalog lookups"). Enable-all / disable-all bulk actions.

**Wiring:**
- `apps/ops/src/components/sidebar.tsx` — filters nav items via `isNavHrefGatedOff()` alongside the existing `hidden_nav_items` check
- `apps/ops/src/app/dashboard/inventory/page.tsx` — Add-Item category dropdown filters via `useEnabledModules().filterCategories(CATEGORIES)`
- `apps/ops/src/app/dashboard/inventory/[id]/page.tsx` — Edit-form category dropdown filters but **always includes the current value** (an item already in a now-disabled vertical shows "Foo (disabled vertical)" — no blank dropdown)
- `apps/ops/src/components/inventory/category-attribute-fields.tsx` — `CategoryFilterBar` filters its options (the "All categories" entry stays)
- `apps/ops/src/components/inventory/catalog-lookup.tsx` — Lookup widget filters integrations via `isIntegrationEnabled()`. An integration owned by multiple modules stays available if at least one is enabled (so OFF stays available for either-or-both of cafe + food_drink_retail).

**Hook:** `apps/ops/src/hooks/use-enabled-modules.ts` is the single read-side primitive. Returns `{ enabled, filterCategories, isCategoryEnabled, isIntegrationEnabled, isNavHrefEnabled }`. Use it anywhere a UI needs to gate a vertical-module-bound surface.

**Skipped intentionally:** `apps/ops/src/app/dashboard/inventory/receive/page.tsx` has hardcoded inline `<option>` entries that are themselves stale (missing rpg/comic/collectible). Tonight's gate doesn't apply there. Worth a follow-up where we centralize the CATEGORIES constant as a shared export and let everything consume it; that's a bigger refactor than vertical-toggle plumbing.

### Files touched in the morning addendum

```
apps/ops/src/lib/
  store-modules.ts                                 (NEW — module registry + helpers)
  store-settings-shared.ts                         (+ enabled_verticals optional field)
  store-settings.ts                                (+ enabled_verticals on the larger interface)

apps/ops/src/hooks/
  use-enabled-modules.ts                           (NEW — read-side primitive)

apps/ops/src/components/settings/
  vertical-modules-panel.tsx                       (NEW — toggle panel)

apps/ops/src/components/
  sidebar.tsx                                      (+ vertical gate alongside hidden_nav_items)
  inventory/category-attribute-fields.tsx          (+ filter bar gating)
  inventory/catalog-lookup.tsx                     (+ integration gating)

apps/ops/src/app/dashboard/
  settings/page.tsx                                (+ Product Lines tile + panel render)
  cafe/menu/page.tsx                               (full A- rewrite — dietary, 86 summary, modals)
  inventory/page.tsx                               (+ visibleCategories filter)
  inventory/[id]/page.tsx                          (+ filtered dropdown that preserves orphans)
```

`npx tsc --noEmit` clean. Ready for your eyes.

### Updated grades

| Category | Before | Now |
|---|---|---|
| Cafe | B+ | **A-** *(via UI surfacing of recipes/dietary/86)* |
| Adaptability | A | **A** *(unchanged but now demonstrably store-tunable)* |

The per-store toggles are themselves an A-bumping move for **adaptability** — stores can now physically configure which product lines they carry, which makes the demo more honest ("the bookstore tenant gets a Discogs-aware UI by toggling vinyl on; the FLGS doesn't see it"). I'm not relabeling Adaptability since A → A+ still requires the promote-attribute-to-column workflow, but the toggle infra is the right primitive to build that on.

### What to verify

1. `/dashboard/settings` → Operations tab → Product Lines tile. Toggle Comics off; sidebar should drop Pull Lists. Toggle Cafe off; sidebar drops Cafe. Toggle them back on; both return.
2. With Cafe ON: open `/dashboard/cafe/menu`, create a new item with allergens + dietary flags + calories + prep time. Confirm badges render on the row. 86 it. Confirm the red summary band appears at the top with a chip + Reset all button.
3. `/dashboard/inventory` Add Item: with Comics off, the Comic option should be missing from the category dropdown.
4. `/dashboard/inventory/[some-existing-comic-item]`: with Comics off, the edit form should still show "Comic (disabled vertical)" as the current value, with a way to switch to an enabled category.
5. `/dashboard/integrations` is unaffected by toggles — that's the registry view, intentionally always-visible.

Same push sequence as before still applies; nothing in this addendum touches schema.
