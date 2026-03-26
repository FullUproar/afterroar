# Lightspeed eCom API — Migration Reference

**Tier**: 2 (Partial Automation)
**Approach**: REST API (requires Advanced or Professional subscription)
**Docs**: https://developers.lightspeedhq.com/ecom/introduction/introduction/

---

## Authentication

- HTTP Basic Auth: `{api_key}:{api_secret}`
- Two clusters:
  - EU: `https://api.webshopapp.com/en/`
  - US: `https://api.shoplightspeed.com/en/`

## Rate Limits

- Documented per-account limits (varies by plan)
- Account-level rate limit endpoint available for checking remaining quota

## Key Resources

### Products

**Endpoint**: `GET /products.json`
- `id`, `title`, `description`, `vendor`
- `productType`
- `tags`
- `images[]`
- `metafields[]`

### Variants

**Endpoint**: `GET /variants.json` or nested under products
- `id`, `sku`, `barcode` (EAN)
- `price`, `priceOld` (compare-at)
- `stockLevel` — current quantity
- `weight`, `weightUnit`
- `title` — variant name

### Variant Movements

**Endpoint**: `GET /variants/{id}/movements.json`
- Inventory change history — useful for audit trail
- `quantity`, `type`, `createdAt`

### Customers

**Endpoint**: `GET /customers.json`
- `id`, `firstName`, `lastName`
- `email`, `phone`
- `creditBalance` — native store credit support
- `tags`
- `addresses[]`

### Orders

**Endpoint**: `GET /orders.json`
- `id`, `number`, `status`
- `customer` (linked)
- `products[]` — line items with variant references
- `total`, `subtotal`, `taxes`
- `paymentStatus`, `shipmentStatus`
- `createdAt`

### Payments

**Endpoint**: `GET /orders/{id}/payments.json` or via paymentmethod resource
- Payment method details linked to orders

---

## FLGS-Specific Notes

- Lightspeed has native `creditBalance` on customers — direct store credit mapping
- VariantMovements provide inventory audit history (unique advantage)
- Tags can encode game/condition data (similar to Shopify pattern)
- Better suited for general retail than TCG-specific workflows
- Subscription gate on API access may limit some stores

## Field Mapping: Lightspeed → Afterroar

| Lightspeed Field | Afterroar Field | Transform |
|------------------|-----------------|-----------|
| Product.title | name | direct |
| Product.productType | category | normalize_category |
| Variant.sku | sku | direct |
| Variant.barcode | barcode | direct |
| Variant.price | price_cents | dollars_to_cents |
| Variant.priceOld | cost_cents | dollars_to_cents |
| Variant.stockLevel | quantity | integer parse |
| Customer.firstName + lastName | name | concat |
| Customer.email | email | normalize |
| Customer.phone | phone | normalize_phone |
| Customer.creditBalance | credit_balance_cents | dollars_to_cents |
| Customer.tags | attributes.tags | preserve |
