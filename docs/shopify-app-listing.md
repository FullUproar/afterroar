# Afterroar Connect for Shopify — App Store Listing & Submission

This is everything you need to ship the Shopify App Store listing for
Afterroar Connect. Code is built; this doc covers the operational and
marketing pieces that aren't code.

## What's already in the codebase

| Piece | Path |
|---|---|
| OAuth install | [/api/integrations/shopify/install](../apps/me/app/api/integrations/shopify/install/route.ts) |
| OAuth callback | [/api/integrations/shopify/callback](../apps/me/app/api/integrations/shopify/callback/route.ts) |
| Webhook receiver (HMAC verified) | [/api/integrations/shopify/webhook](../apps/me/app/api/integrations/shopify/webhook/route.ts) |
| Topic handlers | [lib/shopify-handlers.ts](../apps/me/lib/shopify-handlers.ts) |
| OAuth + HMAC helpers | [lib/shopify.ts](../apps/me/lib/shopify.ts) |
| Settings API (rate, min order, disconnect) | [/api/integrations/shopify/settings](../apps/me/app/api/integrations/shopify/settings/route.ts) |
| Claim flow (App Store installs) | [/integrations/shopify/claim](../apps/me/app/integrations/shopify/claim/page.tsx) |
| Embedded entry (App URL) | [/integrations/shopify/embedded](../apps/me/app/integrations/shopify/embedded/page.tsx) |
| Store-side dashboard panel | [store/[slug]/shopify-panel.tsx](../apps/me/app/store/[slug]/shopify-panel.tsx) |
| Migration | [2026-04-14_shopify-integration.sql](../packages/database/sql-migrations/2026-04-14_shopify-integration.sql) |

## Required env vars (Vercel)

```
SHOPIFY_API_KEY=        # Public app key from Shopify Partners
SHOPIFY_API_SECRET=     # Private secret, used for OAuth + webhook HMAC
SHOPIFY_APP_URL=        # https://afterroar.me  (no trailing slash)
SHOPIFY_SCOPES=read_orders,read_customers
```

After setting them, manually redeploy in Vercel — `vercel env` does not trigger one (per [feedback memory](../../../.claude/projects/c--Full-Uproar-Platform/memory/feedback_vercel_env_redeploy.md)).

## Shopify Partner dashboard configuration

Create the app at https://partners.shopify.com → Apps → Create app.

**App URL**:        `https://afterroar.me/integrations/shopify/embedded`
**Allowed redirection URL(s)**: `https://afterroar.me/api/integrations/shopify/callback`

**Webhook subscriptions**: handled programmatically on install via
[lib/shopify.ts → registerWebhook](../apps/me/lib/shopify.ts), so leave the
manual list empty in the Partner dashboard. The 6 topics we register:
- `orders/paid` (the moneymaker)
- `refunds/create` (point reversal)
- `app/uninstalled` (mark connection inactive)
- `customers/data_request` (GDPR mandatory)
- `customers/redact` (GDPR mandatory)
- `shop/redact` (GDPR mandatory)

**API scopes**: `read_orders`, `read_customers` (no write scopes — we never
modify the merchant's store).

**Embedded app**: ON. We don't render a full App Bridge experience yet; the
embedded entry redirects to the top-level Connect dashboard. Reviewers
sometimes flag this; if they do, see "Phase 2 — full App Bridge UI" below.

## App Store listing copy

### Tagline (50 chars)
> Reward your real customers. Use any POS.

### Short description (160 chars)
> Auto-credit loyalty points to your customers' Afterroar Passport when they buy on Shopify. Their data, your store, no checkout changes.

### Long description

```
Afterroar Connect turns every paid Shopify order into instant loyalty
points for your customers — no checkout changes, no plugins for them
to install.

How it works
- Customers carry an Afterroar Passport (free) — a portable identity
  + wishlist + loyalty card that works at any participating store.
- Your customers grant your store consent (one QR scan, no app install).
- When they buy from your Shopify store, we automatically award points
  to their Passport — matched by Passport code or email.
- They see their balance grow on afterroar.me. You see who's buying.

What you control
- Points-per-dollar rate (default: 1pt = $1)
- Minimum order amount to earn points
- Which scopes you ask customers for (identity, wishlist, library,
  badges, points)
- Disconnect any time — your store data is never modified

What we don't do
- We don't write to your store. Read-only on orders + customers.
- We don't see card data, products, or anything Shopify doesn't pass
  in webhooks.
- We don't sell customer data — read the Afterroar Credo at
  afterroar.me/credo.

Free during beta. After GA: $49/mo for the full Connect plan
(unlimited customers, all integrations, federated wishlist matching).
```

### Pricing
- **During App Store review:** Free (we want approval before billing matters)
- **At GA:** $49/mo through Stripe (external billing, not Shopify Billing API). This is allowed under Shopify's "merchant-managed billing" rules for B2B SaaS that exists outside the Shopify ecosystem.

### Categories
- Primary: **Customer accounts & loyalty**
- Secondary: **Marketing**

## Required URLs (have these ready before submission)

| Where Shopify asks | URL |
|---|---|
| Privacy policy | `https://afterroar.me/privacy` |
| Support contact | `mailto:support@afterroar.me` (set up before submission) |
| Customer terms of service | `https://afterroar.me/terms` |
| Merchant terms of service | `https://afterroar.me/terms-merchant` ← **need to write this** |
| Marketing site | `https://afterroar.me/integrations/shopify` ← **need to build this landing page** |

## Screenshots / video assets (Shopify requires these)

Required image dimensions: 1600x900 (16:9), PNG, RGB.

1. **Hero / dashboard view** — `/store/[slug]` with Shopify panel showing "Live" + recent webhook events
2. **Settings panel** — points-per-dollar + minimum order
3. **Customer view** — `/settings` showing the connected store + earned points
4. **Consent QR generation** — `/store/[slug]` with the consent QR widget open
5. **Activity log** — recent events showing "+5 pts" awards from real Shopify orders

Optional 30-second demo video: install → connect → place test order → points appear. Strong conversion lift if you can record one.

## App review checklist (Shopify's, not ours)

- [ ] All 3 GDPR webhooks return 200 and are HMAC-verified — done in [webhook/route.ts](../apps/me/app/api/integrations/shopify/webhook/route.ts)
- [ ] App URL responds with 200 when loaded with `?shop=...&host=...`
- [ ] OAuth callback verifies HMAC before processing — done in [callback/route.ts](../apps/me/app/api/integrations/shopify/callback/route.ts)
- [ ] App requests minimum scopes needed (we only ask for read_orders + read_customers)
- [ ] App handles uninstall gracefully (`app/uninstalled` webhook deactivates connection)
- [ ] Privacy policy URL is live and addresses Shopify customer data
- [ ] Support email is monitored
- [ ] Listing copy is honest about what the app does and doesn't do
- [ ] Test on a real Shopify dev store before submitting

## Phase 2 — full App Bridge UI (if reviewers ask)

If Shopify's review team rejects on "embedded experience required," we'd
add `@shopify/app-bridge-react` to render the dashboard inside their
iframe. The change is mostly cosmetic — wrap the existing dashboard in
`<AppProvider host={host} apiKey={apiKey}>` and use App Bridge nav.
About a day's work. Skip until they ask, since most stores will install
via the marketing site landing page (where the current top-level UX is
exactly what we want).

## Pre-submission test plan

Run against a real Shopify dev store (free, create at partners.shopify.com).

1. **Install**:
   - Click install from Partner dashboard's "Test on development store"
   - Complete OAuth, land on claim flow (no entity yet on dev test)
   - Apply for an entity, get admin to approve via `/admin/entities`
   - Re-install Shopify app, claim the new entity
   - Verify dashboard shows "Live" + correct shop name

2. **Order flow**:
   - As customer: sign into the dev store, place a paid order with email matching a Passport
   - Verify webhook event appears in the dashboard (topic = `orders/paid`, result = `awarded`)
   - Verify points balance updated on `/store/[slug]/customers` for that user

3. **Refund flow**:
   - Refund the test order in Shopify admin
   - Verify reversal event appears (topic = `refunds/create`, result = `reversed`)
   - Verify points balance is decremented correctly

4. **Settings**:
   - Change points-per-dollar to 2, place another test order, verify 2x points
   - Change min order to $50, place a $10 order, verify event = `skipped:below-min-1000c`

5. **Disconnect / reinstall**:
   - Hit Disconnect from the dashboard
   - Verify dashboard shows install form
   - Reinstall, verify connection is restored without losing past data

6. **GDPR webhooks**:
   - Trigger via Shopify Partner dashboard → "send test webhook"
   - Verify each returns 200 and is logged in `ShopifyWebhookEvent`

7. **Uninstall**:
   - Uninstall app from the dev store admin
   - Verify `app/uninstalled` event arrives, connection becomes inactive

## Submission day

1. Confirm all checklist items above pass on a live dev store
2. Submit via Partner dashboard → Distribution → Submit for review
3. Typical review time: 5-10 business days
4. If rejected: read feedback, fix, resubmit (no penalty)

## Cost / commitment

- **Shopify Partners account:** Free
- **Dev store:** Free
- **App Store listing:** Free (no listing fee, no Shopify Billing rev share if we use external billing)
- **Ongoing:** Maintenance per Shopify API deprecations (~quarterly), monitoring webhook reliability, customer support
