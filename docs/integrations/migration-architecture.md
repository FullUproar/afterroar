# Migration Architecture & Data Certification

## Core Principles

1. **Zero data loss** — strict accounting reconciliation
2. **Deterministic** — same input → same output
3. **Idempotent** — safe to re-run (file hash dedup)
4. **Observable** — full audit trail per row
5. **Recoverable** — rollback capability via import job records

---

## Pipeline Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Connector   │ →  │  Raw Snapshot │ →  │   Mapping    │ →  │  Validation  │
│ (API / CSV)  │    │ (immutable)  │    │  + Transform │    │   Engine     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Reconciliation│ ←  │   Commit     │ ←  │   Dry Run    │ ←  │   Preview    │
│   Report     │    │  (write DB)  │    │ (simulate)   │    │  (first 20)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Per-Row Audit Trail

Every imported row creates a `pos_import_records` entry with:
- `source_data` — raw CSV row as JSON (immutable)
- `mapped_data` — after field mapping + transforms
- `target_table` — which pos_* table it went into
- `target_id` — the created/updated record's ID
- `status` — pending / created / updated / skipped / error
- `error_message` — why it failed (if applicable)

---

## Connector Types

### API Connectors (Tier 1)
- **Shopify**: GraphQL Admin API → bulk export → JSONL parse
- **Square**: REST API → paginated fetch → JSON parse

### CSV Connectors (Tier 2)
- **BinderPOS**: Header-signature detection, multi-file merge
- **SortSwift**: Standard CSV with known headers
- **ShadowPOS**: CSV with manual field mapping

### Hybrid
- **Lightspeed**: REST API (subscription-gated), CSV fallback
- **Clover**: REST API available but may need OAuth setup assistance

---

## Deduplication Strategy

### Inventory Items

Priority order for matching existing records:
1. `(store_id, sku)` — exact SKU match
2. `(store_id, barcode)` — exact barcode match
3. `(store_id, external_id)` — source system ID from previous import
4. `(store_id, name, attributes)` — fuzzy match (same name + condition + set)

On match: **update** existing record (preserving our ID). On no match: **create** new.

### Customers

Priority order:
1. `(store_id, email)` — email is the strongest identity signal
2. `(store_id, name, phone)` — name + phone combo
3. Manual review queue for ambiguous matches

### Orders (Historical)

Not deduplicated — each import creates new ledger entries with `source_system` + `source_id` in metadata. We preserve source order IDs for cross-reference but don't try to match against existing Afterroar transactions.

---

## Multi-Source Migration Projects

Some stores have a topology like:
```
BinderPOS (singles inventory + listing rules)
    ↓
TCGplayer (marketplace orders)
    ↓
Shopify (fulfillment + general retail + customers)
```

For these stores, migration is a **project** with multiple connectors:

| Source | Priority For |
|--------|-------------|
| BinderPOS | Singles inventory, TCG listing rules |
| Shopify | Order history, customers, general retail inventory |
| TCGplayer | Catalog enrichment, market pricing |

The import wizard supports uploading multiple files for one migration project. Each file is a separate import job, but they share a store and can reference each other during dedup.

---

## Data Certification System

### What It Proves

A store can run a certification check that produces a verifiable report showing:

**Isolation** — "Your data is completely separate from every other store"
- No cross-store ledger entries
- No cross-store event check-ins
- No cross-store staff references

**Integrity** — "Your financial records are accurate and consistent"
- Customer credit balances match ledger history exactly
- No orphaned records (references to deleted entities)
- All foreign key relationships valid

**Completeness** — "Everything you imported arrived correctly"
- Import job records all have valid target IDs
- Row counts match between source file and created records
- No silent failures

**Consistency** — "Your inventory and financial data agree"
- Inventory quantities consistent with sales/returns/adjustments history
- Trade-in credit payouts match customer balance increments

### Certification Report

The report is a timestamped document showing:
- Store name and ID
- Certification date/time
- Each check with pass/fail/warn status and details
- Summary: "X of Y checks passed"
- Staff member who ran the certification

This is designed to be **shareable** — a store owner can show it to their accountant, their insurance company, or their business partner to prove data integrity.

---

## Reconciliation Reports

After every import (dry run or commit), the system produces:

### Inventory Reconciliation
```
Source File: binderpos_mtg_singles_2026-03.csv
Records in file:     3,247
Records created:     2,891
Records updated:       312
Records skipped:        44 (duplicates)
Records with errors:     0

Inventory Count:
  Source total quantity:  14,832
  Imported quantity:      14,832   ✓ MATCH

Value Summary:
  Total retail value:    $47,293.00
  Total cost basis:      $23,146.50
```

### Customer Reconciliation
```
Source File: customers_export.csv
Records in file:       1,247
Records created:         892
Records updated:         341
Records skipped:          14 (name-only duplicates, manual review)
Records with errors:       0

Credit Balance:
  Source total credit:   $4,280.00
  Imported credit:       $4,280.00   ✓ MATCH
```

### Success Criteria (must all pass)
- Inventory counts match exactly
- Store credit balances match exactly
- Customer counts match exactly (or discrepancies explained)
- Zero silent failures
- All errors surfaced and categorized

---

## Rollback Strategy

If an import needs to be undone:
1. Query `pos_import_records` for the import job
2. For each record with `status: "created"`, delete the `target_id` from the pos_* table
3. For each record with `status: "updated"`, restore from `source_data` of previous import (or manual snapshot)
4. Mark import job as `status: "rolled_back"`

This is why we preserve `target_id` on every import record — it enables surgical rollback.

---

## TCG Variant Architecture (Future Evolution)

The ChatGPT research correctly identifies that our current flat `pos_inventory_items` model should evolve toward:

```
catalog_product (one card identity)
    → sellable_sku (condition + language + printing combinations)
        → inventory_lot (quantity at location with cost basis)
```

This is the right long-term direction. For now:
- `pos_inventory_items.name` = product identity
- `pos_inventory_items.attributes` JSONB = condition, language, foil, set, etc.
- One row per variant combination (NM English Non-Foil = one row, LP Japanese Foil = another)

The evolution to the canonical model should happen when we build the federated catalog (Phase 3 in the roadmap), not during the migration MVP.
