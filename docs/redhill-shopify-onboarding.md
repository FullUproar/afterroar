# Redhill Games — Shopify Onboarding Guide

**Target:** Dylan at Redhill Games, Niles, MI
**Goal:** Import his Shopify product catalog into a test store on Afterroar Store Ops. Zero impact on his live Shopify operations.

---

## What We Need From Dylan

A read-only Shopify API token. Takes 2 minutes:

1. Go to **Settings → Apps and sales channels → Develop apps** (top right)
2. Click **Create an app**, name it `Afterroar Sync`
3. Click **Configure Admin API scopes** and check ONLY:
   - `read_products` — product names, descriptions, images, variants
   - `read_inventory` — stock quantities per location
4. Click **Save**, then **Install app**
5. Go to **API credentials** tab and copy the **Admin API access token** (starts with `shpat_`)
6. Go to `afterroar.store/connect/redhill-games` and paste it in

### What this does NOT give us access to:
- No orders, no customers, no revenue data
- No ability to change anything in his store
- No payment or billing info
- Read-only — we can see his products but can't edit, create, or delete anything

---

## What We Do With It

### Step 1: Create the store
- Create a `pos_store` record with slug `redhill-games`
- Set store name, address (Niles, MI), basic settings
- Tax rate for Michigan (6%)

### Step 2: Import products
- Hit Shopify Admin API: `GET /admin/api/2024-01/products.json`
- For each product + variant:
  - Create `pos_inventory_item` with name, SKU, barcode, price, image, category
  - Map Shopify product type → Store Ops category (board_game, tcg_single, sealed, accessory, etc.)
  - Pull inventory levels per location via `GET /admin/api/2024-01/inventory_levels.json`
- Track `external_id` = Shopify product/variant ID for future sync

### Step 3: Set up test store
- Create staff accounts for Dylan + anyone he wants to test with
- Configure: tax rate, receipt footer, store display name
- Enable relevant modules (tcg_engine, events, ecommerce)

### Step 4: Hand it over
- Send Dylan login credentials
- Walk him through: register, inventory, events, trade-ins
- His live Shopify is completely unaffected

---

## Shopify API Details

### Authentication
```
GET https://{store}.myshopify.com/admin/api/2024-01/products.json
X-Shopify-Access-Token: shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Endpoints We Need

| Endpoint | Purpose |
|---|---|
| `GET /products.json` | All products with variants, images, descriptions |
| `GET /products/count.json` | Total product count (for progress bar) |
| `GET /inventory_levels.json?location_ids=X` | Stock quantities |
| `GET /locations.json` | Store locations (for multi-location inventory) |

### Pagination
Shopify uses cursor-based pagination via `Link` header. Max 250 products per page.

### Rate Limits
- 2 requests/second (40 per bucket, leaky bucket)
- We should add 500ms delay between requests

### Category Mapping

| Shopify Product Type | Store Ops Category |
|---|---|
| Board Game, Tabletop Game | `board_game` |
| Card Game, Trading Card, MTG, Pokemon, Yu-Gi-Oh | `tcg_single` or `sealed` (by title/tag) |
| Miniature, Warhammer, Paint | `miniature` |
| Dice, Sleeves, Deck Box, Playmat | `accessory` |
| T-Shirt, Apparel, Clothing | `clothing` |
| Food, Drink, Snack | `food_drink` |
| *(anything else)* | `other` |

Tags on Shopify products can help disambiguate: `sealed`, `single`, `foil`, `preorder`.

---

## Secure Token Handling

1. Dylan submits token at `afterroar.store/connect/redhill-games`
2. Token encrypted with AES-256-GCM, stored in store settings as `pending_credentials`
3. Import script decrypts token, runs the import, marks credential as consumed
4. Token is never stored in plaintext, never logged, never exposed in any API response
5. Dylan can revoke the token from Shopify admin at any time (Settings → Apps → Afterroar Sync → Uninstall)

---

## Future: Live Sync (Phase 3)

After Dylan is comfortable with the test store and wants to go live:

1. **Upgrade scopes** — add `read_orders` to receive Shopify orders
2. **Shopify webhook** — `orders/create` webhook POSTs to `POST /api/webhooks/shopify`
3. **Order flow:** Shopify order → webhook → `ingestOrder()` → fulfillment queue → ShipStation
4. **Inventory sync back:** POS sale → update Shopify inventory via `POST /inventory_levels/set.json` (needs `write_inventory` scope)
5. **Result:** Dylan keeps his Shopify storefront, gains Store Ops POS + fulfillment. One inventory, two sales channels.

Eventually: migrate off Shopify entirely to native storefront (optional, no rush).

---

## Timeline

| Step | When |
|---|---|
| Create `redhill-games` store in DB | Now |
| Send Dylan the `/connect/redhill-games` link | When ready |
| Build Shopify import endpoint | Next |
| Run import after token received | Same day |
| Hand over test store | Day after import |
| Train on POS, events, trade-ins | That week |
| Shopify order webhook (Phase 3) | After he's comfortable |

---

## Message Template for Dylan

> Hey Dylan — I've got a test version of the POS set up for you to try. I need to pull your product catalog from Shopify so you have real inventory to play with.
>
> This gives us read-only access to your products and stock counts. No orders, no customer data, no ability to change anything in your store.
>
> Takes about 2 minutes:
>
> 1. In Shopify admin: Settings → Apps → Develop apps → Create an app (name it "Afterroar Sync")
> 2. Configure Admin API scopes: check only `read_products` and `read_inventory`
> 3. Save, Install, then copy the Admin API access token
> 4. Go to afterroar.store/connect/redhill-games and paste it in
>
> That's it. Your live store isn't affected at all. You can revoke the token anytime from Shopify.
