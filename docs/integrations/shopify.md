# Shopify Admin API — Migration Reference

**Tier**: 1 (Fully Automatable)
**Approach**: GraphQL Admin API primary, CSV fallback
**Docs**: https://shopify.dev/docs/api/admin-graphql/latest

---

## Authentication

- OAuth 2.0 access tokens with scoped permissions
- Endpoint: `https://{store}.myshopify.com/admin/api/2026-01/graphql.json`
- REST (legacy): `https://{store}.myshopify.com/admin/api/2026-01/{resource}.json`

## Rate Limits

- GraphQL: calculated query costs, 1000 points max, restores at 50 points/sec
- REST: 40 requests/sec (leaky bucket), 2 requests/sec for Plus stores burst
- Bulk operations available for large exports (async, returns JSONL file)

## Key Resources

### Products + Variants

**GraphQL query**: `products(first: 250, after: $cursor)`

Key fields:
- `id`, `title`, `handle`, `vendor`, `productType`, `status`
- `tags` — often used by FLGS to encode game/condition/language
- `metafields` — custom structured data (may contain TCG-specific info)
- `variants.edges.node`:
  - `id`, `sku`, `barcode`, `price`, `compareAtPrice`
  - `selectedOptions` — variant dimensions (Size, Condition, etc.)
  - `title` — often contains condition/language for singles
  - `inventoryItem.id` — links to inventory system
  - `taxable`

**Filtering**: `query` argument supports `product_type`, `vendor`, `tag`, `status`, `sku`, `barcode`, `created_at`, `updated_at`, `inventory_total`

**Pagination**: Cursor-based (`first`/`after`, `last`/`before`). Returns `pageInfo.hasNextPage`.

### Inventory

**GraphQL queries**:
- `inventoryItems(first: 250)` — inventory items linked to variants
- `inventoryLevel` — quantity at a specific location

**Inventory states** (richer than most POS systems):
- `on_hand` — total physical count
- `available` — sellable now
- `committed` — reserved for orders
- `unavailable` — damaged, reserved, etc.
- `incoming` — expected from purchase orders

**Locations**: `locations(first: 250)` — physical stores, warehouses, fulfillment centers

### Customers

**GraphQL query**: `customers(first: 250, after: $cursor)`

Key fields:
- `id`, `firstName`, `lastName`, `email`, `phone`
- `defaultAddress`, `addresses`
- `tags` — may contain VIP, league membership, etc.
- `note` — may contain operational notes (store credit hacks, etc.)
- `ordersCount`, `totalSpent`
- `createdAt`

### Orders + Transactions

**GraphQL query**: `orders(first: 250, after: $cursor, query: "created_at:>2024-01-01")`

Key fields:
- `id`, `name` (human-readable #1234), `createdAt`, `processedAt`, `closedAt`
- `customer.id`
- `currentTotalPriceSet`, `subtotalPriceSet`, `totalTaxSet`, `totalDiscountsSet`
- `sourceName` — "pos", "web", "shopify_draft_order", etc.
- `physicalLocation.id` — which register/store
- `lineItems.edges.node`:
  - `variant.id`, `title`, `quantity`, `originalUnitPriceSet`
  - `discountAllocations`
- `transactions`:
  - `kind` — sale, capture, refund, void
  - `gateway` — shopify_payments, cash, manual, etc.
  - `amountSet`, `status`
- `refunds`:
  - `id`, `refundLineItems`, `totalRefundedSet`

### Bulk Operations (for large stores)

For stores with 10K+ products or 100K+ orders, use async bulk operations:
```graphql
mutation {
  bulkOperationRunQuery(query: "{ products { edges { node { id title variants { edges { node { sku barcode } } } } } } }") {
    bulkOperation { id status }
  }
}
```
Returns a JSONL file URL when complete. Essential for large FLGS inventory.

---

## FLGS-Specific Patterns

### TCG Singles in Shopify

Game stores commonly encode TCG data in Shopify using these patterns:

| Data | Where It Lives | Example |
|------|----------------|---------|
| Condition | Variant title or option | "Near Mint", "NM" |
| Language | Variant option or tag | "Japanese", "JP" |
| Foil/Printing | Tag or variant option | "Foil", "Etched" |
| Set name | Product title suffix | "Lightning Bolt (Alpha)" |
| Game | Tag or productType | "mtg", "pokemon" |
| TCGplayer ID | Metafield or SKU prefix | `tcg_12345` |

**Our mapper must detect these patterns heuristically** since there's no standard.

### Store Credit

Shopify has no native store credit ledger. FLGS stores use:
- Gift cards as store credit proxy
- Third-party apps (Rise.ai, etc.)
- Manual tracking in customer notes/tags

**Migration implication**: Store credit may need to come from a separate source (spreadsheet, the third-party app's export, or customer notes parsing).

---

## Field Mapping: Shopify → Afterroar

| Shopify Field | Afterroar Field | Transform |
|---------------|-----------------|-----------|
| Product.title | name | direct |
| Product.productType | category | normalize_category |
| Product.tags | attributes.tags + game/condition heuristics | parse |
| Variant.sku | sku | direct |
| Variant.barcode | barcode | direct |
| Variant.price | price_cents | dollars_to_cents |
| Variant.compareAtPrice | cost_cents (if used as cost) | dollars_to_cents |
| Variant.selectedOptions | attributes (condition, language, etc.) | parse per option |
| InventoryLevel.available | quantity | direct |
| InventoryLevel.on_hand | attributes.on_hand_quantity | preserve |
| Customer.firstName+lastName | name | concat |
| Customer.email | email | normalize |
| Customer.phone | phone | normalize_phone |
| Customer.note | notes | direct |
| Customer.tags | attributes.tags | preserve |
| Order.name | description (ledger) | direct |
| Order.currentTotalPriceSet | amount_cents | money_to_cents |
