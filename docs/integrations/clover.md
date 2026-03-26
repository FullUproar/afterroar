# Clover API — Migration Reference

**Tier**: 2 (Partial Automation)
**Approach**: REST API
**Docs**: https://docs.clover.com/dev/reference/api-reference-overview

---

## Authentication

- Bearer token: `Authorization: Bearer {auth_token}`
- Production: `https://api.clover.com/v3/merchants/{mId}/`
- Sandbox: `https://apisandbox.dev.clover.com/v3/merchants/{mId}/`
- All requests scoped to merchant ID (`mId`)

## Rate Limits

- Not explicitly documented; implement exponential backoff
- Use `expand` parameter to reduce number of requests

## Key Resources

### Items / Inventory

**Endpoints**:
- `GET /v3/merchants/{mId}/items` — list all items
- `GET /v3/merchants/{mId}/items/{itemId}` — single item
- `GET /v3/merchants/{mId}/items/{itemId}/stock` — stock level

**Key Fields**:
- `id`, `name`, `alternateName`, `price` (cents), `priceType`
- `sku`, `code` (barcode)
- `defaultTaxRates`, `isRevenue`
- `stockCount` — current quantity
- `categories.elements[]` — category associations
- `modifierGroups.elements[]` — variant-like modifiers

### Categories

**Endpoints**: `GET /v3/merchants/{mId}/categories`
- `id`, `name`, `sortOrder`, `items.elements[]`

### Customers

**Endpoints**:
- `GET /v3/merchants/{mId}/customers` — list
- `GET /v3/merchants/{mId}/customers/{customerId}`
- Related: `/phonenumbers`, `/emailaddresses`, `/addresses`

**Key Fields**:
- `id`, `firstName`, `lastName`
- `marketingAllowed`
- Phone/email/address via sub-endpoints
- No native store credit

### Orders

**Endpoints**:
- `GET /v3/merchants/{mId}/orders` — list
- `GET /v3/merchants/{mId}/orders/{orderId}`
- `GET /v3/merchants/{mId}/orders/{orderId}/lineitems`

**Key Fields**:
- `id`, `total`, `taxRemoved`, `isVat`
- `state` — open, locked, paid
- `createdTime`, `modifiedTime`
- `employee.id` — who processed
- Line items: `name`, `price`, `quantity`, `refunded`

### Payments

**Endpoints**: `GET /v3/merchants/{mId}/payments`
- `id`, `amount`, `tipAmount`, `taxAmount`
- `tender.label` — Cash, Credit Card, etc.
- `result` — SUCCESS, FAIL, etc.
- `order.id`

### Refunds

**Endpoints**: `GET /v3/merchants/{mId}/refunds`
- `id`, `payment.id`, `amount`
- `GET /v3/merchants/{mId}/creditrefunds` — credit card specific

---

## FLGS-Specific Notes

- Clover is a generic retail POS, similar to Square
- No native TCG variant support (condition, language, foil)
- Modifiers can be repurposed for variant-like data but aren't standard
- No store credit, trade-in, or event features
- Strong in restaurant/café use (relevant for FLGS café operations)

## Field Mapping: Clover → Afterroar

| Clover Field | Afterroar Field | Transform |
|--------------|-----------------|-----------|
| Item.name | name | direct |
| Category.name | category | normalize_category |
| Item.sku | sku | direct |
| Item.code | barcode | direct |
| Item.price | price_cents | direct (already cents) |
| Item.stockCount | quantity | direct |
| Customer.firstName + lastName | name | concat |
| Customer email (sub-endpoint) | email | normalize |
| Customer phone (sub-endpoint) | phone | normalize_phone |
| Order.total | amount_cents | direct (already cents) |
| Tender.label | payment_method | normalize enum |
