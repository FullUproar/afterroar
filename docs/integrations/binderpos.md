# BinderPOS — Migration Reference

**Tier**: 2 (CSV-First, No Public API)
**Approach**: CSV export ingestion with header-signature detection
**Docs**: No public API docs. Workflow docs at https://binderpos.com/support

---

## Extraction Method

### CSV Export Workflow

BinderPOS uses a **filtered search → export** model:
1. Store owner filters products in the portal (by game, set, product type)
2. Uses "Export Search" button
3. CSV is **emailed** to the store's main email address
4. File can be edited externally and re-imported

### Key Characteristics
- Exports are tied to **filtered searches**, not a single full-database dump
- Email delivery is part of the workflow (no direct download in all cases)
- Multiple export files per store are common (one per game/set/segment)
- CSV structure may vary depending on the export context/filter

### External CSV Support
BinderPOS also accepts CSV imports from:
- TCGplayer inventory exports
- Card Sorter Robot exports
- Generic CSV with mapped columns

### No Public API
- No verified public merchant/admin API
- Treat as CSV-only extraction
- Potential internal APIs not safe to assume for production migration

---

## Data Model

### Core Product/Inventory Fields

Expected CSV columns (header names may vary):

| Likely Column | Description |
|---------------|-------------|
| Product Name / Title | Card or product name |
| Game | MTG, Pokemon, Yu-Gi-Oh, etc. |
| Set / Expansion | Card set name |
| Product Type | Singles, Sealed, Supplies, etc. |
| SKU | Internal or external SKU |
| Barcode | UPC/EAN if present |
| Price | Sell price |
| Cost | Acquisition cost (not always present) |
| Quantity / Stock | On-hand count |
| Condition | NM, LP, MP, HP, DMG |
| Language | English, Japanese, etc. |
| Foil / Finish | Foil, Non-Foil, Etched |
| Collector Number | Card number in set |
| Rarity | Common, Uncommon, Rare, Mythic |

### TCGplayer Channel Rule Fields

This is what makes BinderPOS unique — marketplace listing behavior is stored alongside inventory:

| Likely Column | Description |
|---------------|-------------|
| Enable Sync | Whether item is listed on TCGplayer |
| Reserve Stock | Units held back from marketplace |
| Max To List | Maximum units to list |
| Markup % | Price markup over market |
| Price Override | Fixed price override |
| Min Price | Floor price guardrail |
| Max Price | Ceiling price guardrail |

**These are critical to preserve during migration.** Losing a store's listing rules means they'd have to manually reconfigure pricing for potentially thousands of SKUs.

### Customer Fields (Uncertain)

Customer export capabilities are not well-documented publicly. May include:
- Name, Email, Phone
- Store credit balance
- Notes

**Recommendation**: Ask each migrating store what customer data they can export.

---

## Migration Strategy

### Phase 1: Header-Signature Detection

Since BinderPOS CSV schemas aren't formally documented, use header fingerprinting:

```
Profile: binder_inventory_v1
Signature headers: ["Product Name", "Game", "Set", "Condition", "Price", "Quantity"]

Profile: binder_inventory_with_tcg_rules_v1
Signature headers: ["Product Name", "Game", "Set", "Condition", "Enable Sync", "Reserve Stock", "Max To List"]

Profile: binder_segmented_search_v1
(Subset of above, missing some columns depending on filter)
```

### Phase 2: Multi-File Merge

A typical BinderPOS migration may involve:
- `mtg_singles_export.csv` (3,000 rows)
- `pokemon_singles_export.csv` (800 rows)
- `sealed_product_export.csv` (200 rows)

Our import wizard should support:
1. Uploading multiple files for one import project
2. Detecting which profile each file matches
3. Merging into a single import with dedup across files
4. Preserving source file provenance per record

### Phase 3: Multi-Source Topology

Many BinderPOS stores also use Shopify for:
- Order fulfillment (TCGplayer orders route through Shopify)
- Customer management
- General retail (non-singles)

Migration may require combining:
- BinderPOS CSVs → inventory + listing rules
- Shopify API → order history + customers
- Source priority rules: BinderPOS wins for singles data, Shopify wins for orders

---

## Field Mapping: BinderPOS → Afterroar

| BinderPOS Field | Afterroar Field | Transform |
|-----------------|-----------------|-----------|
| Product Name | name | direct |
| Game | attributes.game | direct |
| Set | attributes.set_name | direct |
| Product Type | category | normalize_category |
| SKU | sku | direct |
| Barcode | barcode | direct |
| Price | price_cents | dollars_to_cents |
| Cost | cost_cents | dollars_to_cents |
| Quantity / Stock | quantity | integer parse |
| Condition | attributes.condition | normalize_condition |
| Language | attributes.language | direct |
| Foil / Finish | attributes.foil | boolean parse |
| Collector Number | attributes.collector_number | direct |
| Rarity | attributes.rarity | direct |
| Enable Sync | source_attributes.tcg_sync_enabled | boolean |
| Reserve Stock | source_attributes.tcg_reserve_stock | integer |
| Max To List | source_attributes.tcg_max_to_list | integer |
| Markup % | source_attributes.tcg_markup_percent | decimal |
| Price Override | source_attributes.tcg_price_override | dollars_to_cents |
| Min Price | source_attributes.tcg_min_price | dollars_to_cents |
| Max Price | source_attributes.tcg_max_price | dollars_to_cents |

### Unknown Column Policy

**Never discard unknown BinderPOS columns.** Store them in:
- `source_attributes` JSONB on the inventory item
- Raw row archive in `pos_import_records.source_data`

This is how we converge from "medium confidence" to "green" as we see more real exports.
