# Store Ops — AI Walkthrough Store

Self-contained reference for an AI agent (or human) doing a guided tour of Store Ops at https://www.afterroar.store.

The store is **pre-seeded with realistic but disposable data** so every surface in the app has something to display. Nothing here connects to real payment hardware or real money — Stripe Terminal is intentionally disabled.

---

## Credentials

Three role-specific logins to test permission-gated UX. All share the same store.

| Role | Email | Password |
|---|---|---|
| Owner | `bot-owner@afterroar.store` | `bot1234!` |
| Manager | `bot-manager@afterroar.store` | `bot1234!` |
| Cashier | `bot-cashier@afterroar.store` | `bot1234!` |

Sign in at https://www.afterroar.store/login.

**Tip for the AI:** start as owner to see the full surface area, then sign out and sign back in as manager/cashier to compare what's gated off.

---

## Store identity

- **Name:** AI Walkthrough Demo Store
- **Slug:** `ai-walkthrough`
- **Address:** 123 Main St, South Bend, IN 46601
- **Type:** FLGS + Cafe (TCG / sealed / board games / accessories / food + drink)
- **Onboarded:** yes — the 6-step setup wizard is already complete, so you land straight in the dashboard

---

## What's seeded

### Inventory (35 items)

Across 5 categories. Quantity, price, and per-item attributes (set, condition, publisher, etc.) all populated.

| Category | Examples | Count |
|---|---|---|
| TCG singles (MTG) | Lightning Bolt, Sol Ring, Fatal Push, The One Ring | 6 |
| TCG singles (Pokemon) | Charizard ex, Pikachu VMAX, Mewtwo VSTAR | 4 |
| Sealed | MTG Play Booster Box, ETB, Commander Deck | 4 |
| Board games | Wingspan, Catan, Brass: Birmingham, Spirit Island | 6 |
| Accessories | Dragon Shield sleeves, deck boxes, dice, playmats | 6 |
| Food & drink | Coffee, latte, soda, pizza, snacks | 9 |

### Customers (60)

Realistic first-last name combos with `@walkthrough.example` emails and `574-555-XXXX` phones. Mix of:
- ~9 with positive credit balances ($5–$45)
- Lifetime spend distribution to drive the "Regulars" / "MIA" intelligence rules

### Orders + ledger (50 orders, last 30 days)

- 50 orders dated across the last 30 days
- Mix of POS sales (most) + 1-2 online orders
- Payment methods: cash, store credit, gift card (no Stripe — deliberately)
- Each non-cancelled order has a corresponding `PosLedgerEntry` so the daily Z-out and reports have data
- ~1 in 12 cancelled

### Events (4)

| Name | Type | Date | Entry |
|---|---|---|---|
| Friday Night Magic | FNM | +2 days | $5 |
| Commander Night | casual | +5 days | free |
| Pokemon League | league | −7 days | free |
| Modern Showdown | tournament | −14 days | $15 |

### Cafe tabs (4)

- 2 open tabs (Table 3 + Table 5) — for testing "currently running" UI
- 2 closed tabs (Table 1 + Bar) — settled, in the ledger

Each tab has 1–3 cafe items (coffee, snacks, pizza).

### Tournament (1 completed + matches)

"Modern Showdown — Spring" — completed Swiss event:
- 8 players (each linked to a customer)
- 3 rounds, 4 matches per round = 12 matches
- All match scores resolved, winners tagged

### Gift cards (6)

`GC-100X-XXXX` codes, $25–$150 initial values. First three have partial redemptions.

### Loyalty entries (25)

`earn_purchase` records for 25 customers, point balances 100–500. Drives the Loyalty page + customer detail views.

### Game library checkouts (5)

- 2 currently checked out (open) — board games from inventory
- 3 returned in the last week

### Staff (3 rows)

Bot Owner / Bot Manager / Bot Cashier — names + roles for the staff list and time-clock surfaces.

---

## What's NOT seeded (intentional)

| Thing | Why |
|---|---|
| Stripe Terminal pairing / connection tokens | Walkthrough has no physical reader; the Terminal section in admin will show "no reader paired" |
| Real Stripe payment intents | No real card data — orders use cash/credit/gift card |
| eBay / Shopify marketplace tokens | No external sync configured |
| ShipStation API key | Shipping label creation will fail with "no provider" — that's the expected guided-failure state |
| Outbox events to HQ | Bridge is enabled but HQ webhook target is the FU production endpoint — that's fine to leave intact since events are idempotent |
| Mobile register pairing | No mobile session yet; "Mobile" admin tab can generate a fresh access code for testing |

If the AI agent wants to walk those flows, the **right behavior is to try them and capture the empty/disabled state** rather than have us pre-seed fake credentials.

---

## Suggested walkthrough order

A natural traversal for showing off the platform end-to-end. Each step is mostly self-contained, so the AI can skip a section without breaking later ones.

1. **Dashboard** (`/dashboard`) — landing surface; check the daily summary, the Store Advisor (Claude-powered intelligence), and the "needs attention" feed.
2. **Register** (`/dashboard/register`) — open a register session, scan or click items, attach a customer, take cash. The receipt + ledger entry should appear immediately.
3. **Inventory** (`/dashboard/inventory`) — browse by category, edit an item, check TCG pricing on a MTG card.
4. **Customers** (`/dashboard/customers`) — open a customer with credit balance + loyalty points + recent orders. Verify the related-data tabs populate.
5. **Orders** (`/dashboard/orders`) — filter by status, open a delivered order, look at the fulfillment workflow (pick → pack → ship).
6. **Events** (`/dashboard/events`) — see upcoming FNM + Commander Night; click into the past Pokemon League to see check-in history.
7. **Tournaments** (`/dashboard/tournaments`) — open the completed Modern Showdown to see Swiss pairings, match results, final standings.
8. **Cafe** (`/dashboard/cafe`) — see the 2 open tabs on the floor map; add an item to a tab; close a tab and verify it lands in the ledger.
9. **Gift cards** (`/dashboard/gift-cards`) — issue a new one, look up an existing one by code.
10. **Loyalty** (`/dashboard/loyalty`) — see points across the customer base, configure tier thresholds.
11. **Reports** (`/dashboard/reports`) — daily sales, margin by category, cash-vs-card mix.
12. **Settings → Permissions** (`/dashboard/settings/permissions`) — flip a permission, sign out, sign back in as the cashier to see the gate change.
13. **Settings → Mobile** (`/dashboard/settings/mobile`) — generate an access code for the mobile register (no pairing required to observe the flow).
14. **Sign out, repeat as Manager and Cashier** to see role-based UX differences (the cashier mostly sees Register; the manager loses a few admin-only screens).

---

## Refresh / re-seed

If the walkthrough leaves the store in a weird state, or you want a clean re-run with the same credentials:

```bash
cd c:/dev/FULL UPROAR PLATFORM/ops-afterroar-store/apps/ops
node scripts/seed-bot-store.mjs --force
```

`--force` wipes the store's transactional data (orders, tabs, tournaments, ledger, etc.) plus the staff + store records, and re-seeds from scratch. The bot user accounts themselves are not touched.

Re-running without `--force` is a no-op if the store already exists — safe to invoke without worry.

---

## Tear-down

If you want to delete the whole walkthrough store cleanly:

```bash
node -e "
import('dotenv').then(async ({ config }) => {
  config({ path: '.env.local' });
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const s = await prisma.posStore.findUnique({ where: { slug: 'ai-walkthrough' } });
  if (s) console.log('Run seed-bot-store.mjs --force then manually delete store:', s.id);
  await prisma.\$disconnect();
});
"
```

(The seed script's `wipe()` function handles full deletion as a side effect of `--force`. It's exposed there because the order of FK-respecting deletes is non-trivial.)
