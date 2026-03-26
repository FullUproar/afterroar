# Square API — Migration Reference

**Tier**: 1 (Fully Automatable)
**Approach**: REST API primary
**Docs**: https://developer.squareup.com/docs

---

## Authentication

- OAuth 2.0 tokens from Developer Console
- Bearer token in Authorization header
- Sandbox available for testing

## Rate Limits

- Per-endpoint rate limits (varies)
- Implement exponential backoff
- Idempotency keys supported for write operations

## Key Resources

### Catalog API

**Endpoints**:
- `POST /v2/catalog/search` — search items with filters
- `POST /v2/catalog/search-catalog-items` — item-specific search
- `GET /v2/catalog/object/{object_id}` — single object
- `POST /v2/catalog/batch-retrieve` — bulk fetch by IDs
- `POST /v2/catalog/list` — paginated list of all objects

**Object Types**: ITEM, ITEM_VARIATION, CATEGORY, DISCOUNT, TAX, MODIFIER, IMAGE

**Key Fields (ITEM)**:
- `id`, `name`, `description`
- `category_id`
- `product_type` — REGULAR, APPOINTMENTS_SERVICE
- `variations[]`:
  - `id`, `name`, `sku`, `upc` (barcode)
  - `price_money` — `{ amount: 1299, currency: "USD" }`
  - `pricing_type` — FIXED_PRICING, VARIABLE_PRICING
  - `track_inventory` (boolean)
- `custom_attribute_values` — flexible key-value pairs

**Pagination**: Cursor-based. Response includes `cursor` field; pass as query param to next request.

### Inventory API

**Endpoints**:
- `POST /v2/inventory/batch-retrieve-counts` — counts by catalog object + location
- `POST /v2/inventory/batch-retrieve-changes` — change history
- `POST /v2/inventory/physical-count` — record a physical count

**Key Fields**:
- `catalog_object_id` — links to item variation
- `location_id`
- `quantity` — string representation of count
- `state` — IN_STOCK, SOLD, RETURNED_BY_CUSTOMER, WASTE, etc.
- `calculated_at` — timestamp of calculation

**Inventory States**:
- IN_STOCK
- SOLD
- RETURNED_BY_CUSTOMER
- RESERVED_FOR_SALE
- TRANSFERRED_FROM / TRANSFERRED_TO
- WASTE
- UNLINKED_RETURN

### Customers API

**Endpoints**:
- `POST /v2/customers/search` — search with filters
- `GET /v2/customers/{customer_id}`
- `POST /v2/customers` — create

**Key Fields**:
- `id`, `given_name`, `family_name`, `email_address`, `phone_number`
- `address`
- `note`
- `groups[]` — customer group memberships
- `segment_ids[]`
- `creation_source` — FIRST_PARTY, THIRD_PARTY, etc.

### Orders API

**Endpoints**:
- `POST /v2/orders/search` — search with filters (date range, state, location)
- `GET /v2/orders/{order_id}`
- `POST /v2/orders/batch-retrieve`

**Key Fields**:
- `id`, `location_id`, `created_at`, `state` (OPEN, COMPLETED, CANCELED)
- `customer_id`
- `line_items[]`:
  - `catalog_object_id`, `name`, `quantity`, `base_price_money`
  - `variation_name`
  - `applied_discounts[]`, `applied_taxes[]`
- `total_money`, `total_tax_money`, `total_discount_money`
- `tenders[]`:
  - `type` — CARD, CASH, SQUARE_GIFT_CARD, OTHER
  - `amount_money`
  - `card_details` / `cash_details`
- `returns[]` — inline return data
- `source` — { name: "Square POS" }

### Payments API

**Endpoints**:
- `GET /v2/payments` — list payments
- `GET /v2/payments/{payment_id}`

**Key Fields**:
- `id`, `order_id`, `amount_money`, `status`
- `source_type` — CARD, CASH, WALLET, BANK_ACCOUNT, EXTERNAL
- `card_details`, `cash_details`
- `receipt_number`, `receipt_url`
- `location_id`

### Refunds API

**Endpoints**:
- `GET /v2/refunds` — list refunds
- `POST /v2/refunds` — create refund
- `GET /v2/refunds/{refund_id}`

**Key Fields**:
- `id`, `payment_id`, `order_id`
- `amount_money`, `status`
- `reason`

### Locations API

**Endpoints**: `GET /v2/locations`

**Key Fields**:
- `id`, `name`, `address`, `timezone`
- `business_hours`, `status` (ACTIVE, INACTIVE)
- `type` — PHYSICAL, MOBILE

---

## FLGS-Specific Notes

### TCG Data in Square

Square is a generic retail system. Game stores typically:
- Use item variations for conditions (NM, LP, etc.)
- Encode set/game in item name: "Black Lotus - Alpha - NM"
- Use custom attributes for TCG metadata (if configured)
- Categories for broad grouping: "MTG Singles", "Sealed", "Board Games"

### Store Credit

Square has no native store credit. Stores use:
- Square Gift Cards as proxy
- Manual tracking
- Third-party integrations

### Limitations for FLGS

- No native condition/language/foil variant system
- No buylist/trade-in workflow
- No event management
- Inventory is simple quantity count (no multi-state like Shopify)

---

## Field Mapping: Square → Afterroar

| Square Field | Afterroar Field | Transform |
|--------------|-----------------|-----------|
| Item.name | name | direct |
| Item.category_id → Category.name | category | normalize_category |
| Variation.sku | sku | direct |
| Variation.upc | barcode | direct |
| Variation.price_money.amount | price_cents | direct (already cents) |
| Inventory.quantity | quantity | integer parse |
| Customer.given_name + family_name | name | concat |
| Customer.email_address | email | normalize |
| Customer.phone_number | phone | normalize_phone |
| Customer.note | notes | direct |
| Order.total_money.amount | amount_cents | direct (already cents) |
| Tender.type | payment_method | normalize enum |
