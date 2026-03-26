# Afterroar Store Ops — Project Brief

**Last updated:** March 26, 2026
**Status:** Working prototype, live at afterroar.store, on shared FU database
**Company:** Full Uproar Games, Inc. (Shawn Pollock, founder)

---

## What We're Building

The first purpose-built POS + retail operating system for friendly local game stores (FLGS). Not a generic retail tool with a gaming skin — a system that understands game stores are hybrid businesses: retail + secondary market (TCG singles) + café + events/community hub + lending library + organized play.

Part of the Afterroar ecosystem: Store Ops is the staff-facing backend, Afterroar HQ is the player-facing frontend. Same database, different apps.

---

## The Pain Points We're Solving

### Universal POS Problems (still true in 2026)
- Slow/clunky UX → long lines at events (multiple clicks, bad search)
- Inventory desync / lies ("I know I have it somewhere")
- Poor support, hidden fees, lock-in contracts, crashes during peaks
- Generic reporting (no "which events actually made money?")

### FLGS/TCG-Specific Amplifiers
- **TCG singles hell:** 10K+ SKUs with variants (condition NM/LP/MP/DMG, foil, language, set, promo, grade). Generic systems choke.
- **Buylists / trade-ins / store credit:** Manual spreadsheets, guesswork pricing, no audit trail, cash vs credit logic hacked together.
- **Events & tournaments disconnected:** No native integration with registrations, table fees, prize support, or player check-ins. ROI invisible.
- **Hybrid inventory:** Sealed product + used/condition-based + café perishables + demo library lending — all in one system.
- **No cash flow visibility:** Owners don't know where their money is trapped. $15K sitting in board games nobody's buying and they don't know it.

### The Competitive Landscape (2026)
- **BinderPOS** (TCGPlayer-owned): Legacy dominant, being sunset. TCGPlayer locking API, cutting off new keys, building closed-loop POS.
- **ShadowPOS** ($200/mo): Closest modern contender. Standalone, strong reporting. Primary threat.
- **SortSwift** ($49.99/mo): Flat-fee, buylist automation, Manage Comics integration.
- **Store Pass** ($1k+/mo): Expensive reskinned Shopify. Poorly received.
- **Square / Lightspeed / Shopify POS**: Simple but die on variants, store credit, events.
- **gci-db.com**: Game & Comic Industry Database project solving product-data standardization. Potential integration partner (met at GAMA).

### Our Wedge Advantage
Start with the highest-pain daily workflows (trade-ins + events) and make them delightful + Afterroar-native. Then expand into the full operating system.

---

## What's Built (as of March 26, 2026)

### Core Platform
- **Auth:** Google OAuth + email/password (NextAuth v5), shared User table with Afterroar HQ
- **Role-based permissions:** Owner / Manager / Cashier with granular access control
- **GOD MODE:** Admin test panel (info@fulluproar.com) to simulate any role
- **Dashboard:** Stat cards (inventory, customers, trade-ins, events) + recent ledger entries

### MVP Wedge 1 — Trade-In + Store Credit Engine ✅
- 3-step flow: select customer → add items with market price reference → choose cash/credit payout
- Configurable credit bonus percentage
- Immutable ledger entry for every trade
- Customer wallet with credit balance + full audit history

### MVP Wedge 2 — Event ↔ Revenue Bridge ✅
- Event creation with types (FNM, prerelease, tournament, casual, draft, league)
- One-tap player check-in with entry fee collection
- Purchase tagging to events (every sale during an event is attributed)
- Event ROI reports: entry fees + tagged sales + total revenue + player count

### MVP Wedge 3 — Inventory Sanity Layer ✅
- Hybrid SKU model: relational core + JSON attributes (condition, foil, language, set, game)
- Fuzzy search + barcode support
- Role-gated stock adjustments with required reason dropdown + audit trail
- Low stock visual indicators

### Checkout / POS ✅
- Register screen (all-day cashier view) with cart building
- PAY slide-over: payment method, tendered amount, change calculation
- Guest checkout (no customer required)
- Quick customer creation inline
- Receipt modal with print (thermal 80mm) + email stub
- Payment abstraction layer: cash, simulated card, store credit

### Customer Management ✅
- 30 seeded customers with credit balances
- Search, detail view, transaction history
- Credit adjustments with ledger audit trail

### Infrastructure ✅
- Shared PostgreSQL database with Afterroar HQ (Prisma Postgres)
- All tables prefixed `pos_` (11 tables, zero collisions with HQ's ~100 tables)
- Prisma ORM with pg adapter
- Vercel hosting
- Raw SQL migrations (never prisma migrate on shared DB)

---

## Major Architecture Decisions

### Separate Apps, Shared Database
Store Ops and Afterroar HQ are separate Next.js apps sharing one PostgreSQL database. Different users, different auth needs, different runtime requirements (POS needs offline-first, game night planner doesn't), different deploy cadence (can't break the register on a Saturday because of a recap bug).

### Supabase → Prisma Migration (COMPLETE)
Started on Supabase (built in 6 hours). Migrated to Prisma + NextAuth to match HQ's stack (built over 6 months). Zero Supabase code remaining. The migration was done to eliminate tech debt before it compounded — one ORM, one auth system, one database.

### pos_ Table Prefix Convention
All Store Ops tables use `pos_` prefix. No separate Postgres schemas — naming convention + migration discipline is sufficient for a team of one founder + AI. HQ tables are untouched. The only cross-reference is `pos_staff.user_id → User.id`.

### Raw SQL Migrations, Never Prisma Migrate
`prisma migrate` tried to reset the entire FU database (100+ tables). Raw SQL with `CREATE TABLE IF NOT EXISTS` is idempotent and safe. Migrations live in `migrations/` directory, reviewed manually, applied via pg client.

### Stripe Connect for Payments
Stores bring their own Stripe account. We never touch the money. Zero liability, no money transmitter licensing. Revenue from flat monthly SaaS fee. Payment abstraction layer built — swap SimulatedCardProvider → StripeConnectProvider when ready.

### AI-First Design
All data structures designed for AI to reason over. JSONB attributes, immutable ledger, velocity data, supplier relationships — all becomes context for AI that can answer "Should I reorder this?" and "What should I offer for this trade binder?"

---

## What's Next (Prioritized)

### Phase 2 — The Differentiators
1. **Cash Flow Intelligence Dashboard** — The wow feature. Not accounting — operational intelligence. Money trapped in inventory, inventory velocity, margin by category, dead stock alerts, trade-in ROI, reorder intelligence. "You're not losing money because sales are bad. You're losing money because $15K is sitting in product nobody's buying."
2. **Multi-location Inventory** — Warehouse vs shelf vs display case. Warehouse = immediately fulfillable for web. Shelf = needs physical check. E-commerce availability driven by location type.
3. **Predictive Inventory** — Out-of-stock date predictions, suggested reorder windows based on supplier lead times, velocity-based reorder triggers.
4. **Loyalty Points** — Second currency on customer wallet. Earn rules, redeem rules, event bonuses.
5. **Afterroar Gift Cards** — Cross-store gift cards. Buy at Store A, redeem at Store B. Settlement at platform level. Trojan horse for store acquisition.
6. **Returns/Refunds** — Ledger type `refund`, role-gated, reason required.
7. **Stripe Connect Integration** — Real card payments via store's connected Stripe account.
8. **Hardware Kit** — Bundled "Afterroar Terminal": Stripe Reader S700 + thermal printer + barcode scanner + tablet stand. One box, pre-configured.

### Phase 3 — The Network Effects
1. **AI-Powered Search** — Contextual ("that red burn spell from the new set"), similar products (embeddings), picture search (Claude Vision for card identification in trade-in flow).
2. **Federated Catalog + Pricing** — Community-sourced product catalog across the network. Multi-source price aggregation (Scryfall, eBay sold, CardMarket, network sales data). No TCGPlayer dependency.
3. **Café Table Ordering** — QR code on tables → menu → order from phone → kitchen display. Same checkout backend, different frontend. Every café sale during an event auto-attributed to event ROI.
4. **Tab Management** — Open tab at start of night, accumulate orders, close/pay at end.
5. **E-Commerce Sync** — Unified inventory between POS and web store. Sell in-store → disappears from website instantly.
6. **Afterroar HQ Integration** — Events sync, player/customer linking, reputation/trust badges carry over, Roar Points + store loyalty unified.

### Phase 4+ — The Long Game
- Tournament brackets, organized play tracking
- Comic pull lists (League of Comic Geeks integration)
- Consignment for local artists
- Cross-store player reputation (federated trust)
- Transaction limits, fraud detection, chargeback management
- Federated intelligence: 100+ stores = pricing signals, demand prediction, trend detection
- Role/rule customization per store

---

## Afterroar HQ Integration

**Core concept:** Afterroar HQ = player-facing. Store Ops = staff-facing. Same data.

**What's connected now:**
- Shared PostgreSQL database (Prisma Postgres at db.prisma.io)
- Shared auth (NextAuth v5 + same Google OAuth app + same User table)
- Bridge: `pos_staff.user_id` → HQ `User.id`

**The killer integration flow (to build):**
1. Store creates "Friday Night Magic" in Store Ops
2. Event appears on their Afterroar venue page
3. Players RSVP on Afterroar (mobile, one tap)
4. Player scans QR at the door
5. POS shows them on check-in list with trust badge
6. One tap: checked in, fee charged, loyalty earned
7. Player orders coffee from seat (QR table order)
8. Player trades in cards — verification = trusted pricing
9. Recap auto-generates with attendance + revenue
10. Owner sees: "FNM: 24 players, $120 fees, $180 café, $340 singles, 3 new customers"

---

## Test Accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Owner | shawnoah.pollock@gmail.com | (Google sign-in) | GOD MODE admin |
| Owner | info@fulluproar.com | (Google sign-in) | GOD MODE admin |
| Manager | manager@teststore.com | password123 | Can adjust inventory, manage events, run reports |
| Cashier | cashier@teststore.com | password123 | Checkout only, read-only inventory |

---

## Seed Data (in FU database)
- **Store:** Full Uproar Games & Café
- **Customers:** 30 with credit balances ($0–$450)
- **Inventory:** 52 items (TCG singles, sealed, board games, minis, accessories, café)
- **Events:** 19 (11 past with check-ins, 8 upcoming)
- **Trade-Ins:** 10 completed with ledger entries
- **Sales:** 233 daily sales over 30 days
- **Staff:** 3 (owner, manager, cashier)

---

## Tech Reference

### Stack
- Next.js 16 + React 19 + TypeScript + Tailwind CSS
- Prisma ORM with @prisma/adapter-pg
- NextAuth v5 (Google OAuth + Credentials)
- PostgreSQL (shared with HQ via Prisma Postgres)
- Vercel hosting

### Database Tables (all `pos_` prefixed)
- `pos_stores`, `pos_staff`, `pos_customers`
- `pos_inventory_items`, `pos_suppliers`
- `pos_events`, `pos_event_checkins`
- `pos_ledger_entries` (immutable)
- `pos_trade_ins`, `pos_trade_in_items`
- `pos_gift_cards`
- `User` (HQ-owned, read-only from Store Ops)

### Prisma Model Names
`prisma.posStore`, `prisma.posStaff`, `prisma.posCustomer`, `prisma.posInventoryItem`, `prisma.posSupplier`, `prisma.posEvent`, `prisma.posEventCheckin`, `prisma.posLedgerEntry`, `prisma.posTradeIn`, `prisma.posTradeInItem`, `prisma.posGiftCard`, `prisma.user` (read-only)

### Key Files
- `src/auth.ts` — NextAuth config (Google + Credentials)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/permissions.ts` — Role-based permission system
- `src/lib/payment.ts` — Payment abstraction layer
- `src/lib/store-context.tsx` — React context (store, staff, role, can())
- `src/lib/types.ts` — Shared types, formatCents(), parseDollars()
- `prisma/schema.prisma` — All models
- `migrations/001_pos_initial.sql` — Database creation script

### Env Vars (Vercel)
- `DATABASE_URL` — Prisma Postgres direct connection
- `AUTH_SECRET` — NextAuth signing (NOT NEXTAUTH_SECRET)
- `AUTH_URL` — https://www.afterroar.store
- `NEXTAUTH_URL` — https://www.afterroar.store
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — shared with HQ

---

## Business Context

- **Target:** 100+ FLGS in federated network Year 1
- **Revenue:** Flat monthly SaaS fee (no % commissions, positioned against BinderPOS/ShadowPOS)
- **Moat:** Afterroar integration (player network), cross-store gift cards, federated pricing data
- **Validation:** ~20 FLGS owners expressed interest in GAMA FB thread (March 2026)
- **Competition:** ShadowPOS at $200/mo is the price anchor to beat
- **Partnership opportunity:** gci-db.com (Game & Comic Industry Database) — potential investment/partnership for product data standards
