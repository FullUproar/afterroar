# Store Ops POS — Feature × Tier × Role Matrix

**Generated 2026-05-15.** Source of truth: `apps/ops/src/lib/permissions.ts`.

> **2026-05-15 update:** the 6 gaps flagged in the original version are
> now closed in code (commits in `apps/ops/src/lib/permissions.ts`,
> `/api/cafe`, `/api/locations`, `/api/transfers`, `/api/mobile`,
> `/api/certification`). New permissions: `cafe.tab`, `cafe.alcohol`,
> `cafe.menu.manage`, `cafe.table_fee.manage`, `location.manage`.

Two independent axes gate every feature:

1. **Plan / Module** — which store plan the store is on (`free` / `base` / `pro` / `enterprise`), plus any add-on modules purchased independently.
2. **Permission** — what an individual staff member's role lets them do (`owner` / `manager` / `cashier`), with per-store overrides supported.

Both must be satisfied for a feature to work.

---

## Plan → Module inclusion (canonical)

| Plan | Modules included |
|---|---|
| **free** | (none) |
| **base** | events |
| **pro** | intelligence, events, tcg_engine, advanced_reports |
| **enterprise** | intelligence, events, tcg_engine, ecommerce, multi_location, cafe, advanced_reports, api_access |

Add-on modules can be attached to any plan a la carte (stored in `pos_stores.settings.addons`).

---

## Role → Permission defaults (canonical)

Owner gets **everything** by default. Managers and cashiers as below. Owners can override per role per permission in Settings → Staff.

| Permission | Owner | Manager | Cashier |
|---|:---:|:---:|:---:|
| **POS** |
| checkout | ✓ | ✓ | ✓ |
| checkout.discount | ✓ | ✓ | ✓ |
| checkout.discount.override | ✓ | ✓ |  |
| checkout.void | ✓ | ✓ |  |
| checkout.refund | ✓ | ✓ |  |
| checkout.no_sale | ✓ | ✓ |  |
| checkout.price_override | ✓ | ✓ |  |
| **Inventory** |
| inventory.view | ✓ | ✓ | ✓ |
| inventory.adjust | ✓ | ✓ |  |
| inventory.create | ✓ | ✓ |  |
| inventory.delete | ✓ |  |  |
| inventory.cost_view | ✓ | ✓ |  |
| inventory.pricing | ✓ | ✓ |  |
| **Customers** |
| customers.view | ✓ | ✓ | ✓ |
| customers.edit | ✓ | ✓ |  |
| customers.credit | ✓ | ✓ |  |
| customers.delete | ✓ |  |  |
| **Trade-Ins & Returns** |
| trade_ins | ✓ | ✓ | ✓ |
| trade_ins.cash | ✓ | ✓ |  |
| returns | ✓ | ✓ |  |
| returns.no_receipt | ✓ | ✓ |  |
| **Events** |
| events.checkin | ✓ | ✓ | ✓ |
| events.manage | ✓ | ✓ |  |
| **Cafe** (requires `cafe` module) |
| cafe.tab | ✓ | ✓ | ✓ |
| cafe.alcohol | ✓ | ✓ | ✓ |
| cafe.menu.manage | ✓ | ✓ |  |
| cafe.table_fee.manage | ✓ | ✓ |  |
| **Reports & Intelligence** |
| reports | ✓ | ✓ |  |
| cash_flow | ✓ | ✓ |  |
| **Administration** |
| staff.manage | ✓ |  |  |
| store.settings | ✓ |  |  |
| import | ✓ | ✓ |  |
| certification | ✓ |  |  |
| manage_orders | ✓ | ✓ |  |
| timeclock.view_all | ✓ | ✓ |  |
| ops_log | ✓ |  |  |
| location.manage | ✓ | ✓ |  |

---

## Full feature matrix

Columns:
- **Plan** — minimum plan that unlocks it (assuming no à la carte add-on).
- **Module** — feature-module key that must be active. `—` means no module gate.
- **Permission** — built-in permission required. Where applicable, lists the strictest.
- **O/M/C** — does Owner / Manager / Cashier get it by default?

### Point of Sale — Register

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Ring up sales | free | — | checkout | ✓ | ✓ | ✓ | `/register`, `/api/checkout` |
| Scan barcode (HID) | free | — | checkout | ✓ | ✓ | ✓ | global keydown listener; inputs unfocused |
| Scan barcode (camera) | free | — | checkout | ✓ | ✓ | ✓ | BarcodeDetector API |
| Barcode learn flow (UPC → BGG enrich) | free | — | inventory.create | ✓ | ✓ |  | scan unknown → catalog product |
| Quick add (catalog search) | free | — | checkout | ✓ | ✓ | ✓ | action-bar Quick Add panel |
| Manual item entry | free | — | checkout.price_override | ✓ | ✓ |  | open-price manual line |
| Apply line / cart discount | free | — | checkout.discount | ✓ | ✓ | ✓ | discount panel |
| Override discount guardrail | free | — | checkout.discount.override | ✓ | ✓ |  | for discounts above threshold |
| Override item price at checkout | free | — | checkout.price_override | ✓ | ✓ |  | inline edit on cart line |
| Void last sale | free | — | checkout.void | ✓ | ✓ |  | more-menu → Void Last |
| Process refund | free | — | checkout.refund | ✓ | ✓ |  | more-menu → Refund |
| Open drawer (no sale) | free | — | checkout.no_sale | ✓ | ✓ |  | more-menu → No Sale |
| Cash payment | free | — | checkout | ✓ | ✓ | ✓ | payment-buttons |
| Card payment (Stripe Terminal) | free | — | checkout | ✓ | ✓ | ✓ | S710 reader |
| Gift card payment | free | — | checkout | ✓ | ✓ | ✓ | payment-buttons |
| Store credit payment | free | — | checkout | ✓ | ✓ | ✓ | payment-buttons |
| Other / split payment | free | — | checkout | ✓ | ✓ | ✓ | payment-buttons |
| Receipt print (thermal) | free | — | checkout | ✓ | ✓ | ✓ | 280px monospace template |
| Receipt email | free | — | checkout | ✓ | ✓ | ✓ | Resend |
| Receipt QR (customer self-serve) | free | — | checkout | ✓ | ✓ | ✓ | `/r/[token]` |
| Customer attach to sale | free | — | checkout | ✓ | ✓ | ✓ | action-bar Customer panel |
| Retroactive loyalty claim (24h) | free | — | checkout | ✓ | ✓ | ✓ | "70 points unclaimed" prompt |
| Price check (no sale) | free | — | checkout | ✓ | ✓ | ✓ | more-menu → Price Check |
| Order lookup | free | — | manage_orders | ✓ | ✓ |  | more-menu → Order Lookup |
| Flag issue | free | — | checkout | ✓ | ✓ | ✓ | more-menu (logs to ops_log) |
| Tip prompt (contextual) | free | — | checkout | ✓ | ✓ | ✓ | cafe/food/table/always/never |

### Inventory

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Inventory list | free | — | inventory.view | ✓ | ✓ | ✓ | `/dashboard/inventory` |
| Inventory detail | free | — | inventory.view | ✓ | ✓ | ✓ |  |
| See cost & margin | free | — | inventory.cost_view | ✓ | ✓ |  | manager visibility configurable |
| Adjust stock qty | free | — | inventory.adjust | ✓ | ✓ |  | receive, count, adjust |
| Add new inventory item | free | — | inventory.create | ✓ | ✓ |  |  |
| Delete inventory item | free | — | inventory.delete | ✓ |  |  | owner-only by default |
| Change sell prices | free | — | inventory.pricing | ✓ | ✓ |  | `/dashboard/promotions` |
| Purchase orders (receive) | free | — | inventory.adjust | ✓ | ✓ |  | `/dashboard/inventory/receive` |
| Stock counts | free | — | inventory.adjust | ✓ | ✓ |  | `/dashboard/stock-counts` |
| Pre-orders | free | — | inventory.adjust | ✓ | ✓ |  | `/dashboard/preorders` |
| Suppliers | free | — | inventory.create | ✓ | ✓ |  |  |
| Promotions / sale prices | free | — | inventory.pricing | ✓ | ✓ |  | `/dashboard/promotions` |
| Game Library | free | — | inventory.view | ✓ | ✓ | ✓ | `/dashboard/game-library` |
| Consignment intake | free | — | inventory.view + create | ✓ | ✓ |  | `/dashboard/consignment` |
| Public buylist page | free | — | (public) | ✓ | ✓ | ✓ | `/buylist/[slug]` — no auth |

### Customers & Loyalty

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Customer list | free | — | customers.view | ✓ | ✓ | ✓ | `/dashboard/customers` |
| Customer detail | free | — | customers.view | ✓ | ✓ | ✓ |  |
| Edit customer info | free | — | customers.edit | ✓ | ✓ |  |  |
| Adjust store credit | free | — | customers.credit | ✓ | ✓ |  | ledger entry |
| Delete customer | free | — | customers.delete | ✓ |  |  | owner-only by default |
| Issue gift card | free | — | customers.edit | ✓ | ✓ |  | `/dashboard/gift-cards` |
| Loyalty points earn | free | — | (auto) | ✓ | ✓ | ✓ | configurable rate |
| VIP / Regular tier bonus | free | — | (auto) | ✓ | ✓ | ✓ | +10% / +5% on credit |
| Frequent returner flag | free | — | (auto) | ✓ | ✓ | ✓ | 3+ returns / 30 days |
| Pull lists (subscribers) | free | — | customers.view | ✓ | ✓ | ✓ | `/dashboard/pull-lists` |
| Customer insights / segmentation | pro | intelligence | customers.view | ✓ | ✓ |  | `/dashboard/customers/insights` |
| Customer CSV export | free | — | customers.view | ✓ | ✓ | ✓ | `/api/customers/export` |

### Trade-Ins & Returns

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Trade-in intake | free | — | trade_ins | ✓ | ✓ | ✓ | `/dashboard/trade-ins` |
| Pay trade-in in cash | free | — | trade_ins.cash | ✓ | ✓ |  | otherwise credit only |
| Process return (with receipt) | free | — | returns | ✓ | ✓ |  | `/dashboard/returns` |
| Return without receipt | free | — | returns.no_receipt | ✓ | ✓ |  | manager override path |
| Loyalty deduction on return | free | — | (auto) | ✓ | ✓ |  | min 0; synced to HQ |

### Events & Tournaments

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Event list | base | events | events.checkin | ✓ | ✓ | ✓ | `/dashboard/events` |
| Create / edit event | base | events | events.manage | ✓ | ✓ |  |  |
| Check players in | base | events | events.checkin | ✓ | ✓ | ✓ |  |
| Charge event fee | base | events | events.checkin | ✓ | ✓ | ✓ | settles via ledger |
| Tournament — Swiss pairing | base | events | events.manage | ✓ | ✓ |  | `/dashboard/tournaments` |
| Tournament — single elim bracket | base | events | events.manage | ✓ | ✓ |  |  |
| Round mgmt (start/next/report) | base | events | events.manage | ✓ | ✓ |  |  |
| OMW% tiebreakers | base | events | events.manage | ✓ | ✓ |  | auto-calculated |
| Drop player | base | events | events.manage | ✓ | ✓ |  |  |
| Prize payouts (store credit) | base | events | events.manage | ✓ | ✓ |  | credits via ledger |
| WPN level tracking | base | events | events.manage | ✓ | ✓ |  | store setting |
| HQ Bridge — event_attendance | base | events | (auto) | ✓ | ✓ | ✓ | outbox → HQ |

### Cafe Module

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Open tab | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ | `/dashboard/cafe` |
| Add menu items to tab | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ |  |
| Add inventory items to tab | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ | unified F&B + retail |
| KDS (Kitchen Display) | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ | status updates per item |
| Menu builder | enterprise | cafe | cafe.menu.manage | ✓ | ✓ |  | items + modifiers |
| Modifier pricing | enterprise | cafe | cafe.menu.manage | ✓ | ✓ |  | structured |
| Set table fee (flat/hourly) | enterprise | cafe | cafe.table_fee.manage | ✓ | ✓ |  |  |
| Waive table fee on a tab | enterprise | cafe | cafe.table_fee.manage | ✓ | ✓ |  |  |
| Tab transfer (move tables) | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ |  |
| Tab split (split bill) | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ |  |
| Age verification (alcohol gate) | enterprise | cafe | cafe.alcohol | ✓ | ✓ | ✓ | revoke from cashier to require manager swipe |
| Add alcohol-flagged item to tab | enterprise | cafe | cafe.alcohol (indirect — tab must be age-verified) | ✓ | ✓ | ✓ |  |
| QR table ordering (customer phone) | enterprise | cafe | (public) | — | — | — | `/order/[slug]/[table]` |
| Hourly timer + accrued fee display | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ |  |
| Close tab → settles to ledger | enterprise | cafe | cafe.tab | ✓ | ✓ | ✓ |  |

### TCG Engine

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Scryfall search (MTG) | pro | tcg_engine | inventory.adjust | ✓ | ✓ |  | `/api/catalog/scryfall` |
| Pokemon TCG search | pro | tcg_engine | inventory.adjust | ✓ | ✓ |  | `/api/catalog/pokemon` |
| Yu-Gi-Oh search (YGOPRODeck) | pro | tcg_engine | inventory.adjust | ✓ | ✓ |  | `/api/catalog/yugioh` |
| Catalog page (TCG tabs) | pro | tcg_engine | inventory.view | ✓ | ✓ | ✓ | `/dashboard/catalog` |
| Condition grading | pro | tcg_engine | inventory.adjust | ✓ | ✓ |  | NM/LP/MP/HP |
| Bulk pricing (Scryfall) | pro | tcg_engine | inventory.adjust | ✓ | ✓ |  | 1hr market cache |
| Price drift detection | pro | tcg_engine | inventory.view | ✓ | ✓ |  |  |
| Collection CSV import | pro | tcg_engine | inventory.create | ✓ | ✓ |  | TCGPlayer / Moxfield / simple |
| Buylist auto-generation | pro | tcg_engine | inventory.view | ✓ | ✓ |  | `/api/buylist` |
| Public buylist page | pro | tcg_engine | (public) | — | — | — | `/buylist/[slug]` |
| Sealed EV calculator | pro | tcg_engine | inventory.view | ✓ | ✓ |  | `/dashboard/catalog/sealed-ev` |
| One-click repricing | pro | tcg_engine | inventory.pricing | ✓ | ✓ |  | `/api/inventory/reprice` |
| Deck builder | pro | tcg_engine | checkout | ✓ | ✓ | ✓ | `/dashboard/deck-builder` |
| Singles page | pro | tcg_engine | inventory.view | ✓ | ✓ | ✓ | `/dashboard/singles` |

### E-Commerce / Marketplace

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Fulfillment queue | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | `/dashboard/fulfillment` |
| Order list | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | `/dashboard/orders` |
| Pick / pack workflow | enterprise | ecommerce | manage_orders | ✓ | ✓ |  |  |
| Pull sheets (consolidated picks) | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | `/api/fulfillment/pull-sheet` |
| Shipping rate shopping | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | `/api/shipping/rates` |
| Shipping label generation | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | `/api/shipping/labels` |
| ShipStation webhook | enterprise | ecommerce | (system) | — | — | — | `/api/webhooks/shipstation` |
| Oversell reconciliation | enterprise | ecommerce | manage_orders | ✓ | ✓ |  | inventory holds |
| eBay listing (single) | enterprise | ecommerce | inventory.adjust | ✓ | ✓ |  | `/api/ebay/listings` |
| eBay listing (bulk) | enterprise | ecommerce | inventory.adjust | ✓ | ✓ |  | `/api/ebay/listings/bulk` |
| eBay OAuth connect | enterprise | ecommerce | store.settings | ✓ |  |  | `/dashboard/ebay/connect` |
| eBay marketplace sync (5min cron) | enterprise | ecommerce | (system) | — | — | — | `/api/marketplace/sync` |
| Auto inventory push on sale/return | enterprise | ecommerce | (auto) | — | — | — | fire-and-forget |
| CardTrader listings | enterprise | ecommerce | inventory.adjust | ✓ | ✓ |  | `/api/cardtrader/listings` |
| ManaPool listings | enterprise | ecommerce | inventory.adjust | ✓ | ✓ |  | `/api/manapool/listings` |
| Order confirmation email | enterprise | ecommerce | (auto) | — | — | — | Resend |
| Shipping notification email | enterprise | ecommerce | (auto) | — | — | — | Resend |
| Channel performance report | enterprise | ecommerce + advanced_reports | reports | ✓ | ✓ |  | `/dashboard/reports/channels` |

### Intelligence Engine

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Cash flow dashboard | pro | intelligence | cash_flow | ✓ | ✓ |  | `/dashboard/cash-flow` |
| Liquidity runway | pro | intelligence | cash_flow | ✓ | ✓ |  |  |
| Dead stock / bench warmers | pro | intelligence | reports | ✓ | ✓ |  |  |
| Fast movers | pro | intelligence | reports | ✓ | ✓ |  |  |
| Regulars MIA | pro | intelligence | reports | ✓ | ✓ |  |  |
| Credit liability | pro | intelligence | cash_flow | ✓ | ✓ |  |  |
| Seasonal warnings | pro | intelligence | reports | ✓ | ✓ |  | configurable thresholds |
| WPN metrics | pro | intelligence | reports | ✓ | ✓ |  |  |
| Cash-aware buylist suggestions | pro | intelligence | inventory.pricing | ✓ | ✓ |  |  |
| Store Advisor (Claude AI) | pro | intelligence | reports | ✓ | ✓ |  | `/api/intelligence/advisor` |
| Intelligence preferences (thresholds) | pro | intelligence | store.settings | ✓ |  |  | dead-stock days, etc. |

### Advanced Reports

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Sales report | free | — | reports | ✓ | ✓ |  | `/dashboard/reports/sales` |
| Inventory health | free | — | reports | ✓ | ✓ |  | `/dashboard/reports/inventory-health` |
| Event ROI | base | events | reports | ✓ | ✓ |  |  |
| Margins by category | pro | advanced_reports | reports | ✓ | ✓ |  | `/dashboard/reports/margins` |
| Staff performance metrics | pro | advanced_reports | reports | ✓ | ✓ |  | `/dashboard/reports/staff` |
| Category drill-down | pro | advanced_reports | reports | ✓ | ✓ |  |  |
| CSV export of reports | pro | advanced_reports | reports | ✓ | ✓ |  |  |

### Multi-Location

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Locations list / mgmt | enterprise | multi_location | location.manage | ✓ | ✓ |  | `/dashboard/locations` |
| Per-location inventory levels | enterprise | multi_location | inventory.view | ✓ | ✓ | ✓ |  |
| Stock transfers between locations | enterprise | multi_location | inventory.adjust | ✓ | ✓ |  | `/dashboard/transfers` |
| Warehouse routing | enterprise | multi_location | inventory.adjust | ✓ | ✓ |  |  |

### API Access (Integrations)

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| External API key (issue) | enterprise | api_access | store.settings | ✓ |  |  | `/api/settings/api-key` |
| Rotate / revoke API key | enterprise | api_access | store.settings | ✓ |  |  |  |
| Generic order ingest endpoint | enterprise | api_access | (API-key auth) | — | — | — | `/api/orders/ingest` |
| Public catalog read | free | — | (public) | — | — | — | `/api/public/catalog` |

### Mobile

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Mobile timeclock (PIN, public) | free | — | (PIN only) | ✓ | ✓ | ✓ | `/clock/[slug]` |
| GPS geofence tag on clock-in | free | — | (auto) | ✓ | ✓ | ✓ | on_site/remote/no_gps |
| Mobile register (paired) | free | — | (access code + PIN) | ✓ | ✓ | ✓ | `/mobile/[slug]` |
| Pair via 6-digit access code | free | — | store.settings (gen) | ✓ |  |  | rotation revokes all sessions |
| Session limits (tx count, $ cap) | free | — | store.settings | ✓ |  |  | per-store guardrails |
| Mobile refund toggle | free | — | store.settings | ✓ |  |  | off by default |
| Rate limiting on access code | free | — | (auto) | — | — | — | 10 attempts / 15 min per IP |

### Hardware

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Stripe Terminal S710 register | free | — | store.settings | ✓ |  |  | `/api/stripe/terminal/register` |
| Stripe Terminal connection tokens | free | — | (auto) | ✓ | ✓ | ✓ |  |
| Stripe Terminal payment collect | free | — | checkout | ✓ | ✓ | ✓ |  |
| HID barcode scanner | free | — | (auto) | ✓ | ✓ | ✓ | Inateck primary |
| Camera barcode scan | free | — | (auto) | ✓ | ✓ | ✓ | BarcodeDetector API |
| Receipt printer (thermal) | free | — | (auto) | ✓ | ✓ | ✓ | 280px monospace |

### Admin & Settings

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Store settings | free | — | store.settings | ✓ |  |  | `/dashboard/settings` |
| Role permission overrides | free | — | store.settings | ✓ |  |  | per-role per-perm toggles |
| Staff management | free | — | staff.manage | ✓ |  |  | `/dashboard/staff` |
| Set staff PIN | free | — | staff.manage | ✓ |  |  | 4-8 digit |
| Tax settings (Stripe Tax + fallback) | free | — | store.settings | ✓ |  |  |  |
| Receipt customization | free | — | store.settings | ✓ |  |  | address, footer, return policy |
| CSV import (customers, inventory) | free | — | import | ✓ | ✓ |  | `/dashboard/import` |
| Operations log viewer | free | — | ops_log | ✓ |  |  | `/dashboard/ops-log` |
| Timeclock — view all | free | — | timeclock.view_all | ✓ | ✓ |  | `/dashboard/timeclock` |
| Timeclock — view own | free | — | (auto) | ✓ | ✓ | ✓ |  |
| Certification runs (launch checklist) | free | — | certification | ✓ |  |  | `/api/certification` |
| Training mode toggle | free | — | store.settings | ✓ |  |  | transactions marked training |
| Demo data seeder | free | — | store.settings | ✓ |  |  | `/api/store/seed-demo` |
| Onboarding wizard (6-step) | free | — | store.settings | ✓ |  |  |  |
| NUX hints (globally dismiss) | free | — | store.settings | ✓ |  |  |  |
| Help center (27 articles) | free | — | (public) | ✓ | ✓ | ✓ |  |

### HQ Bridge (sync to Game Night HQ)

| Feature | Plan | Module | Permission | O | M | C | Route / Notes |
|---|---|---|---|:-:|:-:|:-:|---|
| Outbox drain cron (every min) | free | — | (system) | — | — | — | `/api/hq-bridge/drain` |
| Event: checkin | base | events | (auto) | ✓ | ✓ | ✓ | outbox event |
| Event: points_earned | free | — | (auto) | ✓ | ✓ | ✓ |  |
| Event: tournament_result | base | events | (auto) | ✓ | ✓ |  |  |
| Event: event_attendance | base | events | (auto) | ✓ | ✓ | ✓ |  |
| Event: purchase_summary | free | — | (auto) | ✓ | ✓ | ✓ |  |
| Public catalog read endpoint | free | — | (public) | — | — | — | `/api/public/catalog` |

---

## Test scenarios for Annika (suggested)

### A) Plan boundary tests
For each plan (free / base / pro / enterprise), confirm the locked features show the **upgrade prompt** (not a 404, not a silent denial). Specifically:
- Free plan: visit `/dashboard/events`, `/dashboard/cash-flow`, `/dashboard/catalog`, `/dashboard/fulfillment`, `/dashboard/cafe`, `/dashboard/reports/margins` — each should show "View Plans" CTA, not crash.
- Base plan: `/dashboard/events` should work; `/dashboard/cash-flow` should be locked.
- Pro plan: cash-flow + TCG + advanced reports unlocked; e-commerce + multi-location + cafe + api still locked.

### B) Role boundary tests
Use the three seeded accounts (bot-owner / bot-manager / bot-cashier @afterroar.store) and confirm each role hits the expected permission walls:
- Cashier: ring up sale ✓, void ✗, refund ✗, see margin ✗, edit customer ✗, manage staff ✗.
- Manager: void ✓, refund ✓, delete inventory ✗, delete customer ✗, store settings ✗.
- Owner: everything.

### C) Override tests
On an owner account, go to Settings → Staff and flip a single permission for the manager role (e.g., grant `inventory.delete` to manager). Sign in as manager and confirm the override takes effect without a re-deploy.

### D) Module add-on tests
Take a `base` plan and attach a single add-on (e.g., `tcg_engine`). Confirm TCG features unlock while everything else stays free/base.

---

## Gap resolutions (2026-05-15)

1. **Cafe permissions** — RESOLVED. Added `cafe.tab`, `cafe.alcohol`,
   `cafe.menu.manage`, `cafe.table_fee.manage`. The `/api/cafe` POST now
   per-action checks the right key and gates the whole API behind the
   `cafe` feature module. Cashiers can run tabs and age-verify by
   default; menu edits and table-fee changes need a manager.
2. **`certification` permission** — RESOLVED. `/api/certification`
   GET + POST now check the `certification` permission instead of
   `store.settings`. Owner-only by default; matches its admin category.
3. **Alcohol gate** — RESOLVED via `cafe.alcohol`. Revoking it from
   cashiers means they can't age-verify, which means they can't add any
   alcohol-flagged item (`age_restricted=true`) to a tab.
4. **Mobile register role checks** — RESOLVED. `/api/mobile` activate
   now refuses sign-in if the staff role has been stripped of
   `checkout` permission. The checkout action re-checks server-side and
   independently gates discount + refund on permission. Activate also
   returns a `permissions` payload so the device UI can hide affordances
   the staff can't use.
5. **Locations** — RESOLVED. Added `location.manage` permission;
   `/api/locations` POST and `/api/transfers` GET/POST now go through
   `requirePermissionAndFeature` with both `multi_location` module +
   the right permission.
6. **API key scoping** — INVESTIGATED. The simple `api_key_hash` is
   only consumed by `/api/orders/ingest` (single-purpose). The proper
   `ApiKey` table used elsewhere already has a `scopes: string[]`
   field and `hasScope()` helper. Not actually a gap.
7. **Public routes** (`/buylist/[slug]`, `/order/[slug]/[table]`,
   `/r/[token]`, `/api/public/catalog`) — still no auth. By design;
   each only returns what the store has marked public. Worth a
   deliberate audit if anything sensitive moves through them.
