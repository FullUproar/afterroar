# Data Migration Certification Playbook

How we prove to stores that their data migration is lossless, their data is secure, and Afterroar is trustworthy.

---

## The Problem We're Solving

A game store owner considering switching POS systems has one overriding fear: **"Will I lose my data?"**

They have:
- 3,000+ TCG singles with carefully maintained conditions and prices
- 1,200 customers with $8,000+ in combined store credit
- 2 years of sales history they need for taxes
- TCGplayer listing rules they spent months configuring

If ANY of that disappears or gets corrupted during migration, we've lost them forever — and they'll tell every other store owner at the next GAMA expo.

---

## The Certification Package

Every migration produces a **Data Migration Certificate** — a document the store owner can hold in their hands that proves:

### 1. Pre-Migration Snapshot

Before anything is imported, we capture and display:
```
Source System:          BinderPOS
Export Date:            March 26, 2026
Total Inventory Items:  3,247
Total Customers:        1,247
Total Store Credit:     $4,280.00
Total Retail Value:     $47,293.00
File Hash:              sha256:a7f3b2...
```

This is the "before" picture. The store owner confirms these numbers match what they see in their current system.

### 2. Import Reconciliation Report

After import, side-by-side comparison:
```
                        Source      Imported    Match?
Inventory Items:        3,247       3,247       ✓
  - Created:                        2,891
  - Updated (dedup):                  312
  - Skipped (review):                  44
Total Units:           14,832      14,832       ✓
Total Retail Value:   $47,293     $47,293       ✓
Total Cost Basis:     $23,146     $23,146       ✓
Customers:              1,247       1,247       ✓
Store Credit Balance:   $4,280      $4,280      ✓
Errors:                     0           0       ✓
```

Every number must match. If it doesn't, the discrepancy is explained line-by-line.

### 3. Data Isolation Certificate

The certification system runs 6+ automated checks:
```
✓ Customer Ledger Isolation    — No cross-store data leaks
✓ Event Check-in Isolation     — All events scoped correctly
✓ Staff Ledger Isolation       — All staff references valid
✓ Credit Balance Integrity     — Ledger math checks out
✓ Orphaned Record Check        — No dangling references
✓ Inventory Consistency        — Quantities are non-negative

RESULT: PASSED (6/6 checks)
Certified: March 26, 2026 14:32 UTC
Store: Full Uproar Games & Café
Certified by: Shawn Pollock (Owner)
```

### 4. Diff Report (Skipped/Flagged Items)

For the 44 skipped items above, a detailed report:
```
Row 127: "Black Lotus (Alpha) - NM" — SKIPPED
  Reason: Duplicate SKU (SKU-MTG-BL-ALPHA-NM) already exists
  Existing record: inv_abc123, quantity: 1, price: $8,499.99
  Source record: quantity: 1, price: $8,499.99
  Action: No change needed (exact match)

Row 2,891: "Unknown Card" — FLAGGED
  Reason: Name not found in any known TCG catalog
  Source data preserved in attributes.source_raw
  Action: Manual review recommended
```

---

## Confidence-Building Materials

### For the Sales Conversation

**"The Afterroar Migration Guarantee"**

Talking points for the landing page / sales deck:

1. **See everything before it happens.** Our dry-run mode shows exactly what will be imported — every item, every customer, every dollar of store credit — before a single record is written.

2. **Numbers must match. Period.** Inventory count, store credit balances, customer count — our reconciliation report proves they match to the penny. If they don't, we explain exactly why.

3. **Your data, isolated and certified.** Our Data Certification runs automated checks proving your store's data is completely separate from every other store on the platform. Run it anytime.

4. **Nothing is lost.** Every row from your source system is preserved verbatim — even columns we don't understand yet. You can always trace back to the original data.

5. **Safe to re-run.** Changed something after your first import? Run it again. Our idempotent pipeline detects what's new, what changed, and what's the same. No duplicates, no overwrites.

### For the Technical Buyer (Store Manager / Accountant)

**Migration Technical Brief** — a one-pager covering:
- How data flows from source system to Afterroar
- What validation checks are performed
- How deduplication works
- How store credit reconciliation is verified
- What the rollback procedure is

### Case Studies (To Build)

After our first 3-5 migrations, document:

**Case Study Template:**
```
Store: [Name], [City, State]
Previous POS: [BinderPOS / Square / etc.]
Migration Date: [Date]
Data Migrated:
  - X inventory items (Y TCG singles)
  - X customers with $X in store credit
  - X months of order history
Time to Complete: [X hours from upload to certified]
Issues Found: [0 / X, with resolution summary]
Store Owner Quote: "[...]"
```

### Public Certification Page (Future)

A `/trust` or `/certification` page on afterroar.store showing:
- How many migrations completed successfully
- Aggregate stats: "47,000+ items migrated with 100% reconciliation"
- The certification process explained in plain language
- Sample (anonymized) certification report

---

## Internal Quality Metrics

Track these across all migrations:

| Metric | Target | Description |
|--------|--------|-------------|
| Reconciliation rate | 100% | Items + credit must match exactly |
| Error rate | <1% | Rows that fail validation |
| Silent failure rate | 0% | Rows that silently produce wrong data |
| Migration time | <2 hours | From upload to certified (under 5K items) |
| Re-run safety | 100% | Same file → same result, no duplicates |
| Rollback success | 100% | Undo must restore previous state completely |

---

## Competitive Positioning

Nobody else in the FLGS POS space offers anything like this:

- **BinderPOS**: No migration tooling at all (CSV import, figure it out yourself)
- **ShadowPOS**: Manual CSV import, no reconciliation, no certification
- **SortSwift**: Some CSV import, no audit trail
- **Square/Shopify**: Generic import/export, no game-store-specific mapping

**Our story**: "Other POS systems make you figure out migration yourself. We certify it."
