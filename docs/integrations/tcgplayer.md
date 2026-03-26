# TCGplayer API — Reference

**Role**: Catalog and pricing reference (not a source POS)
**Approach**: API for catalog/pricing data, seller inventory management
**Docs**: https://docs.tcgplayer.com/docs/getting-started

---

## Authentication

- OAuth 2.0 client credentials flow
- Public key + private key → bearer token
- Token expires ~14 days
- No per-request rate limit documented
- **Critical**: "No longer granting new API access" — existing keys only

## Key Resources

### Catalog

**Endpoints**:
- `GET /catalog/categories` — list all game categories
- `GET /catalog/categories/{categoryId}/groups` — sets/expansions within a game
- `GET /catalog/categories/{categoryId}/products` — products in a category
- `GET /catalog/products/{productId}` — single product details
- `GET /catalog/products/{productId}/skus` — SKUs (condition variants) for a product
- `GET /catalog/products/{productId}/media` — images

**Key Fields (Product)**:
- `productId`, `name`, `cleanName`, `groupId` (set)
- `categoryId` (game), `url`
- `extendedData` — rarity, number, etc.

**Key Fields (SKU)**:
- `skuId`, `productId`
- `conditionId` → condition name (Near Mint, Lightly Played, etc.)
- `languageId` → language name
- `printingId` → printing type (Normal, Foil, etc.)

### Pricing

**Endpoints**:
- `GET /pricing/product/{productId}` — market prices by condition/printing
- `GET /pricing/group/{groupId}` — prices for entire set
- `GET /pricing/sku/{skuId}` — specific SKU price
- `GET /pricing/buylist/skus/{skuId}` — buylist (wholesale) price

**Key Fields**:
- `lowPrice`, `midPrice`, `highPrice`, `marketPrice`
- `directLowPrice` — TCGplayer Direct pricing
- `subTypeName` — Normal, Foil
- `conditionName`

### Seller Inventory

**Endpoints** (requires store authorization):
- `GET /stores/{storeKey}/inventory` — current inventory
- `PUT /stores/{storeKey}/inventory/skus` — update quantities/prices

**Key Fields**:
- `skuId`, `quantity`, `price`
- `shippingOption`, `freeShippingThreshold`

### Orders (Seller)

**Endpoints**:
- `GET /stores/{storeKey}/orders` — search orders
- `GET /stores/{storeKey}/orders/{orderNumber}` — order details

---

## How This Integrates with Afterroar

TCGplayer is NOT a source POS for migration. It's a **reference data source**:

### Catalog Enrichment
When importing TCG singles from any source (BinderPOS, Shopify, CSV), we can cross-reference TCGplayer's catalog to:
- Validate card identity (name + set + collector number)
- Fill in missing metadata (rarity, image URL)
- Map condition strings to standard enum
- Look up market pricing for trade-in valuation

### Pricing Reference
The pricing API provides market/buylist prices that feed into:
- Trade-in offer suggestions ("Market says this is $12, offer 50%")
- Inventory valuation (Cash Flow Intelligence dashboard)
- Dead stock detection ("You paid $15, market is now $3")

### Channel Listing (Future)
If a store has TCGplayer seller access, we could eventually sync listings:
- Push inventory to TCGplayer
- Pull orders from TCGplayer
- Manage reserve stock / max-to-list rules

### Offline Price Cache
For the PWA offline mode, we cache recent TCGplayer price lookups in IndexedDB's `priceCache` store. This enables offline trade-in valuation for commonly traded cards.

---

## TCGplayer Condition Mapping

| TCGplayer Condition | Afterroar Enum |
|---------------------|----------------|
| Near Mint | NM |
| Lightly Played | LP |
| Moderately Played | MP |
| Heavily Played | HP |
| Damaged | DMG |
| Near Mint Foil | NM (foil=true) |
| Lightly Played Foil | LP (foil=true) |

## TCGplayer Language Mapping

| TCGplayer Language | Afterroar Enum |
|-------------------|----------------|
| English | EN |
| Japanese | JP |
| German | DE |
| French | FR |
| Italian | IT |
| Spanish | ES |
| Portuguese | PT |
| Chinese (S) | ZH |
| Korean | KO |
