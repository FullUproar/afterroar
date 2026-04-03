# FLGS-OS: Codebase Gap Analysis & Pricing Strategy
### `ops-afterroar-store` — Pre-Beta Technical Audit

**Author:** Manus AI | **Date:** April 2, 2026

---

## Executive Summary

The `ops-afterroar-store` codebase is significantly further along than a typical pre-beta system. The architectural decisions are sound: the immutable append-only ledger, the Prisma-enforced multi-tenant isolation, the offline-first IndexedDB register, and the Claude-powered Store Advisor are all differentiating features that competitors lack entirely. The system is not missing a foundation — it is missing the top floors of a building that already has a solid structure.

This document does three things. First, it provides a module-by-module technical gap analysis against your stated differentiator list, with specific engineering requirements for each gap. Second, it identifies several cross-cutting concerns that are not module-specific but will matter for beta reliability. Third, it proposes a complete pricing strategy that directly attacks the commission-based models of BinderPOS and ShadowPOS.

---

## Part I: Architecture Strengths (What Not to Change)

Before cataloguing gaps, it is worth being explicit about what is working well, because these are the things that should be protected as new modules are added.

**The Immutable Ledger.** `PosLedgerEntry` is the correct foundation for a financial system. Every transaction — sale, trade-in, refund, event fee — writes an immutable record. The `metadata: Json` field is a smart escape hatch for capturing item-level detail without over-normalizing the schema. The cash flow intelligence layer correctly reads from this ledger rather than from mutable inventory state.

**Multi-Tenant Isolation.** The tenant-scoped Prisma client pattern, validated by `src/test/tenant-isolation.test.ts`, is the right approach. The certification checks (`src/lib/certification/checks.ts`) that run raw SQL to detect cross-store data leakage are a mature safety net that most early-stage SaaS products skip entirely.

**Offline-First Register.** The IndexedDB implementation in `src/lib/offline-db.ts` with a transaction queue (`txQueue`) for pending sync is architecturally correct for a retail environment where internet connectivity cannot be guaranteed. The queue handles `checkout`, `trade_in`, and `return` transaction types with retry logic.

**TCG Pricing Engine.** The combination of Scryfall live lookup, the in-memory `market-price-cache.ts` (1-hour TTL, 5,000-entry LRU), the condition multiplier system in `src/lib/tcg-pricing.ts`, and the price-drift detection API (`/api/inventory/price-drift`) is a complete, production-grade singles pricing engine.

**Store Intelligence Foundation.** The `intel_*` settings namespace in `store-settings.ts` is well-designed. The fact that fixed costs are user-configurable (rent, utilities, insurance, payroll) rather than inferred is the correct approach — the system cannot know what it cannot observe. The AI Advisor's system prompt demonstrates genuine FLGS domain knowledge (WPN levels, seasonal patterns, credit-as-liability framing).

---

## Part II: Module-by-Module Gap Analysis

### Differentiator 1: TCG Singles Engine
**Status: Built. Grade: A-**

The core engine is complete. The gaps are refinements, not foundations.

**Gap 1.1 — Pokémon TCG Integration Depth.** The Scryfall integration is mature, but the Pokémon TCG API integration needs parity. Specifically, the `price-drift` endpoint only checks `external_id` entries prefixed with `scryfall:`. Pokemon singles stored with a different external ID format will be silently excluded from drift detection.

*Engineering Fix:* Extend `price-drift` to handle `pokemon:` prefixed external IDs via the Pokémon TCG API. Alternatively, introduce a `price_source` enum field on `PosInventoryItem` (`scryfall | pokemon | manual`) to make the routing explicit.

**Gap 1.2 — Bulk Buylist Import.** The card evaluator page (`/dashboard/singles/evaluate`) handles one-at-a-time card lookup. A customer walking in with 500 cards needs a bulk CSV import path where the system can price an entire collection against current market data.

*Engineering Fix:* Build a CSV upload endpoint that accepts a list of card names/set codes, batches Scryfall lookups (respecting the 100ms rate limit), and returns a priced buylist. The `PosImportJob` / `PosImportRecord` models already exist for this pattern.

**Gap 1.3 — TCGPlayer Marketplace Sync.** eBay sync is built (`src/lib/ebay.ts`). TCGPlayer is the dominant marketplace for singles. The absence of TCGPlayer sync is a significant omission for stores that sell online.

*Engineering Fix:* TCGPlayer has a Seller API. This is a medium-complexity integration requiring OAuth, inventory sync, and order ingestion. This is likely a post-beta item but should be on the immediate roadmap.

---

### Differentiator 2: Trade-In Circular Economy
**Status: Built. Grade: A**

This is the most complete differentiator. The `PosTradeIn` / `PosTradeInItem` models, the `credit_bonus_percent` field, the `intel_buylist_cash_comfort_days` setting, and the credit liability tracking in the Store Intelligence layer represent a complete implementation of the circular economy concept.

**Gap 2.1 — Credit Liability Visualization.** The `intel_credit_liability_warn_percent` setting exists, but the cash flow dashboard does not yet surface a dedicated "Credit Liability Trend" chart showing how outstanding store credit is growing or shrinking over time relative to monthly revenue.

*Engineering Fix:* Add a time-series query to the cash flow API that aggregates `credit_balance_cents` across all customers at weekly intervals (derived from the loyalty ledger's `balance_after` field). Render as a line chart on the cash flow dashboard.

**Gap 2.2 — Trade-In ROI by Category.** The `trade_in_roi` object in the cash flow report calculates aggregate ROI across all trade-ins. Disaggregating this by category (TCG singles vs. board games vs. sealed) would allow the advisor to make more specific recommendations.

*Engineering Fix:* Join `PosTradeInItem` to `PosInventoryItem.category` in the ROI query and group results.

---

### Differentiator 3: Event Ecosystem
**Status: Built. Grade: B+**

The event calendar, check-in system, and event ROI report are functional. The WPN level setting is a smart differentiator.

**Gap 3.1 — Halo Revenue Attribution.** The event ROI report (`/api/reports/event-roi`) correctly captures `event_entry` and `event_fee` ledger entries, and also captures `sale` entries that are tagged with an `event_id`. However, the register (`/dashboard/checkout`) does not currently prompt staff to tag a sale to an active event when one is in progress.

*Engineering Fix:* When an active event exists (check `PosEvent` where `starts_at <= now <= ends_at`), the checkout flow should display a non-intrusive prompt: "Tag this sale to [Event Name]?" This is the mechanism that captures halo revenue and makes the event ROI report meaningful.

**Gap 3.2 — Event Capacity & Waitlist.** `PosEvent.max_players` exists in the schema but the check-in API does not enforce it, nor does it support a waitlist.

*Engineering Fix:* Add a `waitlist: Boolean` field to `PosEventCheckin`. When `checkin_count >= max_players`, new check-ins should be added to the waitlist. Implement a promotion flow to move waitlisted attendees to confirmed when spots open.

**Gap 3.3 — Pre-Event Registration.** Currently, all check-ins happen at the door. Many FLGS events (especially prereleases) benefit from pre-registration with deposit collection.

*Engineering Fix:* Extend `PosPreorder` to support event pre-registration as a first-class use case, or add a `pre_registered` status to `PosEventCheckin` with a `deposit_ledger_entry_id` foreign key.

---

### Differentiator 4: Community Customer Profiles
**Status: Partially Built. Grade: C+**

The segmentation engine (VIP/Regular/New/At Risk/Dormant) is well-implemented in `api/customers/segments/route.ts`. The Afterroar HQ user linking (`afterroar_user_id` on `PosCustomer`) is a smart bridge to the broader community platform.

**Gap 4.1 — Play Format Tracking.** `PosCustomer` has no fields for format preferences. The data exists implicitly in `PosEventCheckin` (which events they attended) and `PosTournamentPlayer` (which tournaments they played), but it is never aggregated.

*Engineering Fix:* Add a `format_tags: String[]` field to `PosCustomer` (or a separate `PosCustomerTag` model for flexibility). Populate this via a background job that reads event types and tournament formats from the customer's participation history. Expose these tags in the customer detail view and make them filterable in the customer list.

**Gap 4.2 — Customer Lifetime Value Projection.** The system tracks `lifetime_spend_cents` but does not project forward. A customer who spends $50/month for 24 months has a very different value profile than one who spent $1,200 in a single purchase.

*Engineering Fix:* Calculate a simple rolling 90-day average spend per customer and project an annualized LTV. Surface this on the customer detail page and use it to weight the "At Risk" alert threshold in the intelligence engine.

**Gap 4.3 — Bulk Communication.** There is no mechanism to send targeted messages to a customer segment (e.g., "Email all VIP customers about the upcoming prerelease").

*Engineering Fix:* This is a post-beta feature but should be designed now. The architecture should support exporting a segment to a CSV (for use with Mailchimp/Klaviyo) or, eventually, a native email/SMS broadcast system. The `email` and `phone` fields on `PosCustomer` are the necessary data foundation.

---

### Differentiator 5: Prerelease & Allocation Management
**Status: Schema Exists, UI Functional but Shallow. Grade: C**

The `PosPreorder` model is well-structured with `deposit_cents`, `total_price_cents`, `release_date`, and a four-stage status lifecycle (`pending → confirmed → received → fulfilled`). The list UI at `/dashboard/preorders/page.tsx` is functional.

**Gap 5.1 — No Allocation Pool.** This is the critical missing piece. The current system allows unlimited preorders for any product. A real FLGS receives a fixed allocation from their distributor (e.g., "You get 24 boxes of the new MTG set"). Overselling this allocation is a serious customer relations problem.

*Engineering Fix:* Add a `PosAllocationPool` model:
```prisma
model PosAllocationPool {
  id                  String   @id @default(cuid())
  store_id            String
  product_name        String
  sku                 String?
  total_allocated     Int
  total_reserved      Int      @default(0)
  release_date        DateTime?
  notes               String?
  created_at          DateTime @default(now())
  store     PosStore      @relation(...)
  preorders PosPreorder[]
}
```
Link `PosPreorder` to `PosAllocationPool` with a `pool_id` foreign key. The preorder creation API must perform an atomic check-and-decrement: `total_reserved < total_allocated` before accepting a new preorder.

**Gap 5.2 — No New Preorder UI.** The `/dashboard/preorders/new/` directory exists but contains no `page.tsx`. This is a placeholder that needs to be built.

*Engineering Fix:* Build a form that creates a `PosPreorder` linked to a customer and optionally to an `AllocationPool`. The form should show remaining allocation in real-time.

**Gap 5.3 — No Release-Day Fulfillment Dashboard.** When stock arrives, the store needs a pick-list view showing all confirmed preorders sorted by customer name, with a one-tap "Mark Fulfilled" action that triggers the final sale transaction.

*Engineering Fix:* Add a `/dashboard/preorders/fulfill/[poolId]` page that lists all `received` preorders for a given allocation pool and provides batch fulfillment actions.

---

### Differentiator 6: Tournament Bracket Management
**Status: Schema + Single-Elimination API Exist. Grade: C-**

The single-elimination bracket engine in `api/tournaments/[id]/route.ts` is functional. The `advanceWinner` helper correctly propagates winners through the bracket tree.

**Gap 6.1 — Swiss Pairings (Critical).** Swiss is the standard format for virtually every sanctioned FLGS event (FNM, Pokémon League Challenges, etc.). The current `bracket_type` field supports `single_elimination` but the Swiss logic does not exist.

*Engineering Fix:* Implement a Swiss pairing algorithm. The core logic is:
1. Sort players by match points (3 for win, 1 for draw, 0 for loss).
2. Within each point group, pair players who have not previously faced each other.
3. Handle byes for odd player counts (lowest-ranked player who has not yet received a bye gets the bye).
4. This is a maximum weight bipartite matching problem. For FLGS scale (typically 8–32 players), a greedy algorithm is sufficient; you do not need the full Blossom algorithm.

The `PosTournamentMatch` model already has `draws` support on `PosTournamentPlayer`, which is correct.

**Gap 6.2 — Tiebreaker Calculations.** Swiss standings require OMW% (Opponent Match Win Percentage) and PGW% (Player Game Win Percentage) for tiebreaking. These are not currently calculated.

*Engineering Fix:* Add a `tiebreakers: Json` field to `PosTournamentPlayer` and compute OMW% and PGW% after each round is completed.

**Gap 6.3 — Prize Payout Integration.** Tournament prizes (store credit, product) are not currently connected to the ledger. A player winning $50 in store credit should generate a `PosLedgerEntry` of type `prize_payout` and update the customer's `credit_balance_cents`.

*Engineering Fix:* Add a "Finalize Tournament" action to the API that accepts a prize structure (e.g., 1st: $50 credit, 2nd: $25 credit) and creates the appropriate ledger entries for each placed player.

---

### Differentiator 7: Cafe / Concession Integration
**Status: Spec'd, Not Built. Grade: N/A**

No schema, API, or UI exists for F&B operations.

**Engineering Requirements:**

*Schema additions:*
```prisma
model PosTab {
  id          String   @id @default(cuid())
  store_id    String
  customer_id String?
  table_label String?
  status      String   @default("open") // open | closed | voided
  items       PosTabItem[]
  ledger_entry_id String?
}

model PosTabItem {
  id         String  @id @default(cuid())
  tab_id     String
  name       String
  price_cents Int
  quantity   Int
  notes      String?
  status     String  @default("pending") // pending | in_progress | served
}
```

*API additions:* Tab CRUD, item status updates (for KDS), tab-to-ledger settlement.

*UX additions:* A dedicated Cafe Register view (distinct from the retail register) optimized for rapid item entry. A Kitchen Display System (KDS) view showing pending items sorted by order time, with one-tap "mark served" actions.

*Revenue Attribution:* Tab items should support `event_id` tagging so that F&B revenue from a tournament night is captured in the event ROI report.

---

### Differentiator 8: Game Library / Demo Table Management
**Status: Basic UI Exists. Grade: B-**

The `PosGameCheckout` model and the game library page are functional. The time-elapsed calculation and return condition tracking are present.

**Gap 8.1 — Pay-to-Play Monetization.** The current system tracks checkouts but does not generate revenue from them. Many FLGS charge a table fee or hourly rate for using demo games.

*Engineering Fix:* Add `fee_per_hour_cents` and `max_free_hours` fields to `PosGameCheckout`. When a game is returned, calculate the fee based on elapsed time and either add it to the customer's tab or prompt for immediate payment.

**Gap 8.2 — Overdue Alerts.** There is no mechanism to alert staff when a game has been checked out beyond its expected return time.

*Engineering Fix:* Add a `due_back_at` field to `PosGameCheckout`. The game library "Active" view should visually flag overdue checkouts (e.g., red border after `due_back_at` is passed). A server-side scheduled job (or a client-side polling interval) should surface these alerts.

**Gap 8.3 — Table Map View.** The current view is a flat list. A spatial table map showing which games are at which tables would be significantly more useful for staff.

*Engineering Fix:* Add a `PosTable` model with a `label` and optional `x/y` position for a drag-and-drop layout editor. Associate `PosGameCheckout` with a `table_id`.

---

### Differentiator 9: Consignment & Showcase
**Status: Not Built. Grade: N/A**

No schema, API, or UI exists. This is a meaningful revenue stream for stores dealing in high-value singles, sealed product, and collectibles.

**Engineering Requirements:**

*Schema additions:*
```prisma
model PosConsignmentItem {
  id                  String   @id @default(cuid())
  store_id            String
  consignor_id        String   // PosCustomer who owns the item
  inventory_item_id   String?  // Links to a PosInventoryItem for display/sale
  asking_price_cents  Int
  commission_percent  Decimal  @db.Decimal(5, 2)
  status              String   @default("active") // active | sold | returned
  listed_at           DateTime @default(now())
  sold_at             DateTime?
  payout_cents        Int?
  payout_ledger_entry_id String?
}
```

*Checkout Integration:* When a consignment item is sold at the register, the checkout API must: (1) calculate the store commission, (2) calculate the consignor payout, (3) credit the consignor's `credit_balance_cents` (or create a cash payout liability), and (4) create two ledger entries: one for the store's commission revenue and one for the consignor payout liability.

*UX additions:* A consignment intake form, a consignor dashboard showing active items and pending payouts, and a payout processing flow.

---

### Differentiator 10: Cross-Store Intelligence
**Status: Long-Term Moat. Grade: N/A (Correctly Deferred)**

This is correctly identified as a network-effect feature that requires critical mass. No action needed at this stage beyond ensuring the data schema is instrumented to support future anonymized aggregation.

**One Preparatory Action:** Add an `opt_in_benchmarking: Boolean` field to `PosStore.settings`. When true, the store's anonymized velocity and margin data can be included in the cross-store intelligence pool. Surfacing this opt-in during onboarding (with a clear privacy explanation) will build the dataset from day one.

---

## Part III: Cross-Cutting Technical Concerns

These are not module-specific gaps but issues that will affect beta reliability and long-term scalability.

### 3.1 — Cash Runway Calculation is Flawed

The current `cashRunwayDays` calculation in `src/lib/store-intelligence.ts` has a logical error:

```typescript
const cashRunwayDays = monthlyNetCash > 0
  ? 90  // ← If profitable, just returns 90. This is not a real calculation.
  : monthlyFixed > 0
    ? Math.max(0, Math.round((revenue30d / (monthlyFixed * 100)) * 30))
    : 90;
```

When the store is profitable (`monthlyNetCash > 0`), the function returns a hardcoded `90` days. This means the AI Advisor is always telling profitable stores they have "90 days of runway" regardless of their actual cash position. The correct calculation requires knowing the current cash balance, which is not currently tracked.

**Engineering Fix:** Add a `current_cash_balance_cents` field to the store settings (user-entered, like the fixed costs). The runway calculation should then be:

```typescript
const dailyBurnRate = (monthlyFixed * 100 + payouts30d) / 30;
const dailyRevenue = revenue30d / 30;
const netDailyFlow = dailyRevenue - dailyBurnRate;
const cashRunwayDays = netDailyFlow >= 0
  ? Infinity // Sustainable — show "Healthy" not a number
  : Math.max(0, Math.round(settings.current_cash_balance_cents / Math.abs(netDailyFlow)));
```

This is the single most important bug fix before beta, because the cash flow intelligence is the primary differentiator and it currently gives incorrect data for profitable stores.

### 3.2 — Receipt Counter is localStorage-Only

The `generateReceiptNumber()` function in the register page uses `localStorage` for sequential receipt numbering. This means receipt numbers reset if the browser cache is cleared, and they are not synchronized across multiple devices or staff members.

**Engineering Fix:** Move receipt number generation to the server. Add a `PosReceiptCounter` model (or a `daily_receipt_counter` field on `PosStore`) that is atomically incremented via a database transaction on each sale. The offline queue should use a `clientTxId` as the temporary identifier and replace it with the server-assigned receipt number upon sync.

### 3.3 — The `metadata: Json` Field is a Debt Accumulator

The `PosLedgerEntry.metadata` field stores item-level sale details as unstructured JSON. This is pragmatic for early development but creates reporting debt. The cash flow report's item-level analysis (`for (const it of meta.items as Array<...>)`) is fragile — it will silently produce incorrect results if the metadata shape changes.

**Engineering Fix:** Before beta, define and document the canonical metadata schema for each `type` value (`sale`, `trade_in`, `refund`, `event_fee`, etc.) and add a Zod validation step in the checkout API before writing to the ledger. This prevents schema drift and makes future reporting queries reliable.

### 3.4 — No Background Job Infrastructure

Several features require scheduled or asynchronous processing: price-drift checks, customer segment recalculation, overdue game library alerts, and (eventually) cross-store benchmarking. The current architecture has no background job system.

**Engineering Fix:** For a Next.js deployment, the simplest path is to use Vercel Cron Jobs (for scheduled tasks) and a queue service like Inngest or Trigger.dev (for event-driven async work). Inngest integrates cleanly with Next.js and supports retries, which is important for the Scryfall rate-limited price-drift job.

### 3.5 — Stripe Connect is Integrated but Payment Processing is Incomplete

The settings page shows Stripe Connect status, but the checkout flow's `paymentMethod` type includes `"card"` without a clear path to actually processing a card payment through Stripe Terminal. The register appears to rely on staff manually entering that a card was used, rather than actually processing it.

**Engineering Fix:** Integrate Stripe Terminal SDK for in-person card processing. This is a significant but critical integration for a POS system. Until this is complete, the system is a cash register with manual card acknowledgment, not a true POS.

---

## Part IV: Pricing Strategy

### The Competitive Landscape

The FLGS POS market is dominated by platforms with punitive pricing structures:

| Platform | Monthly Base | Commission | Effective Cost (High-Volume Store) |
|---|---|---|---|
| BinderPOS | $100–$150 | 2–2.5% online sales | $1,200–$1,800/yr + commissions |
| ShadowPOS | ~$200 (+ Shopify $105) | 2.6% in-person card | $3,660+/yr + processing |
| CrystalCommerce | $99 + $599 setup | None | ~$1,800/yr |
| TCGSync | ~$99–$149 (£99+) | None | ~$1,200–$1,800/yr |

The commission model is particularly damaging to FLGS owners because it scales with revenue, not with the value the software delivers. A store doing $30,000/month in online singles sales pays BinderPOS $600–$750 per month in commissions alone, on top of the base fee. This is an alignment problem: the software vendor profits more as the store grows, without delivering more value.

### Proposed Pricing Architecture

The recommended model is a **flat-rate tiered subscription with optional add-on modules**. This directly attacks the commission model, is easy to explain to non-technical store owners, and creates a clear upgrade path as stores grow.

#### Tier 1: Core OS — $149 / month (or $1,490 / year, saving 2 months)

This tier positions FLGS-OS as a direct replacement for the BinderPOS Basic plan at the same price point, but with no commission and with a significantly more capable intelligence layer.

**Included:**
- Full POS Register (offline-first, barcode scanning, AI camera item lookup)
- Immutable Ledger + Full Transaction History
- Inventory Management (multi-location, transfers, stock counts)
- TCG Singles Engine (Scryfall + Pokémon live pricing, condition grading, price drift alerts)
- Trade-In & Buylist (cash/credit payout, credit liability tracking)
- Customer Database (segmentation: VIP/Regular/New/At Risk/Dormant)
- Event Calendar & Check-ins
- Gift Cards, Promotions, Loyalty Points
- Purchase Orders & Supplier Management
- Basic Reports (daily close, cash flow summary, inventory valuation)
- Preorder Management (with allocation pools)
- Game Library / Demo Table Management

**Positioning:** "Everything you need to run your store. No commissions. No surprises."

#### Tier 2: Intelligence OS — $249 / month (or $2,490 / year)

This tier is the primary differentiator. The $100/month premium buys the business intelligence layer that no competitor offers.

**Includes everything in Core OS, plus:**
- **Cash Flow Intelligence Dashboard** (runway, burn rate, seasonal forecasting)
- **AI Store Advisor** (Claude-powered, context-aware, actionable)
- **Dead Stock Analysis** (by category, with liquidation recommendations)
- **Trade-In ROI by Category** (disaggregated margin analysis)
- **At-Risk Customer Alerts** (with suggested re-engagement actions)
- **Credit Liability Trending** (outstanding store credit vs. revenue ratio)
- **Event ROI with Halo Revenue Attribution**
- **WPN Metric Tracking** (for stores pursuing Advanced/Premium status)
- **Open-to-Buy Budgeting** (dynamic purchasing limits based on cash position)

**Positioning:** "Your store's financial co-pilot. Tells you what to do before it becomes a problem."

#### Add-On Modules (Available on Either Tier)

These modules serve specific business models and should not be bundled into the base tiers, as they add complexity for stores that do not need them.

| Module | Price | Target Customer |
|---|---|---|
| **Tournament Engine** (Swiss pairings, standings, prize payouts) | +$49 / month | Heavy MTG/Pokémon event stores |
| **Cafe & Concessions** (tabs, KDS, table ordering) | +$79 / month | Board game cafes, stores with F&B |
| **Consignment & Showcase** | +$39 / month | Collectibles dealers, high-end singles |
| **E-Commerce Sync** (eBay + TCGPlayer marketplace sync) | +$99 / month | Omnichannel retailers |
| **Multi-Location** (warehouse, transfers, consolidated reporting) | +$99 / month | Small chains, warehouse + storefront |

#### Enterprise / Custom — Contact for Pricing

For stores with multiple locations, franchise groups, or distributors wanting white-label deployments.

### Pricing Rationale

**Why $149 for Core, not lower?** BinderPOS charges $100–$150 with commissions. At $149 flat, FLGS-OS is price-competitive at the entry level and dramatically cheaper for any store doing meaningful online volume. Going lower risks being perceived as a budget option and undercuts the premium positioning of the Intelligence tier.

**Why $249 for Intelligence, not higher?** The $100 premium needs to feel like an obvious ROI decision. A store with $5,000/month in dead stock that the Intelligence engine helps liquidate recovers the annual cost of the tier upgrade in a single month. The price should feel like a no-brainer, not a budget line item to debate.

**Why no free tier?** Free tiers in vertical SaaS convert at 2–5% and attract users who are not serious operators. A 30-day free trial (as currently implemented in the billing page) is the correct mechanism. It creates urgency without attracting tire-kickers.

**Why no percentage-of-revenue component?** This is a deliberate philosophical choice. The FLGS owner is already paying Stripe/Square processing fees (typically 2.6–2.9% + $0.10). Adding a software commission on top of that is the primary pain point with BinderPOS. Eliminating it entirely is a marketing message, not just a pricing decision.

### Recommended Launch Sequence

Rather than launching all tiers simultaneously, a phased approach reduces complexity and allows for pricing validation:

1. **Beta Launch (Now):** Single flat rate of $149/month for all beta users. This simplifies onboarding and creates a cohort of early adopters who will provide feedback on the Intelligence features.
2. **V1 Launch (Post-Beta):** Introduce the two-tier structure. Beta users get grandfathered into Intelligence OS pricing at the Core OS rate for 12 months as a loyalty reward.
3. **Module Launch (3–6 months post-V1):** Roll out add-on modules as they reach production quality. The Tournament Engine and E-Commerce Sync are the highest-priority modules based on the differentiator analysis.

---

## Part V: Prioritized Engineering Roadmap

The following table maps each gap to a priority level and estimated complexity, providing a sequencing guide for the sprint backlog.

| Priority | Module | Gap | Complexity | Impact |
|---|---|---|---|---|
| **P0** | Store Intelligence | Fix cash runway calculation (hardcoded 90-day bug) | Low | Critical — core differentiator is giving wrong data |
| **P0** | Preorders | Build `/dashboard/preorders/new/` page | Low | Blocking — the new preorder UI does not exist |
| **P0** | Payments | Stripe Terminal integration for in-person card processing | High | Critical — system cannot process cards without this |
| **P1** | Preorders | Implement `PosAllocationPool` model and oversell prevention | Medium | High — prevents customer relations disasters |
| **P1** | Tournaments | Swiss pairing algorithm | High | High — single-elimination is not used for FLGS events |
| **P1** | Events | Halo revenue tagging at checkout | Low | High — makes event ROI report meaningful |
| **P1** | Store Intelligence | Credit liability trend chart | Low | Medium — completes the cash flow dashboard |
| **P2** | Tournaments | Tiebreaker calculations (OMW%, PGW%) | Medium | Medium — required for sanctioned events |
| **P2** | Tournaments | Prize payout ledger integration | Medium | Medium — closes the revenue loop |
| **P2** | Customer Profiles | Format tag aggregation from event/tournament history | Medium | Medium — enables targeted marketing |
| **P2** | Game Library | Pay-to-play fee calculation | Low | Medium — monetizes the library |
| **P2** | Game Library | Overdue alerts | Low | Medium — operational quality of life |
| **P3** | TCG Engine | Pokémon price-drift parity | Low | Medium — parity with Scryfall integration |
| **P3** | TCG Engine | Bulk buylist CSV import | Medium | Medium — high-volume trade-in workflow |
| **P3** | Consignment | Full consignment module | High | Medium — new revenue stream for stores |
| **P3** | Background Jobs | Inngest/Trigger.dev integration | Medium | Medium — enables async price checks and alerts |
| **P4** | Cafe | Full F&B module (tabs, KDS) | Very High | High (as add-on) — significant new market segment |
| **P4** | TCG Engine | TCGPlayer marketplace sync | High | High (as add-on) — dominant online marketplace |

---

## Appendix: Billing Page Implementation Notes

The current billing page (`/dashboard/billing/page.tsx`) already has the correct three-tier structure (Base, Pro, Enterprise) and the add-on module list in placeholder form. The `subscription_status`, `subscription_plan`, and `trial_started_at` fields are already being read from `PosStore.settings`.

When implementing billing, the recommended path is **Stripe Billing** (not Stripe Connect, which is already used for payment processing). The implementation requires:
1. Creating Stripe Products and Prices for each tier and add-on.
2. Storing `stripe_customer_id` and `stripe_subscription_id` on `PosStore`.
3. Implementing a Stripe webhook handler to update `subscription_status` and `subscription_plan` in `PosStore.settings` on subscription events (`customer.subscription.updated`, `invoice.payment_failed`, etc.).
4. The existing `can()` permission check in the store context should gate features based on the `subscription_plan` value, which is already partially implemented.

The 14-day trial logic is already in the billing page. The missing piece is a Stripe Checkout session to convert trial users to paid subscribers.
