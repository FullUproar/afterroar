# Store Owner Onboarding Flows

What a prospective customer actually has to DO to try a migration. Each flow should be completable on a slow Tuesday afternoon with zero technical knowledge.

---

## The Golden Path (What We Want)

```
1. Sign up at afterroar.store (Google sign-in, 10 seconds)
2. Tell us what POS you're on (dropdown, 2 seconds)
3. Follow our step-by-step guide to export your data (screenshots, 5-10 minutes)
4. Upload the file (drag and drop, 5 seconds)
5. See your data mapped and previewed (instant)
6. Click "Preview Import" → see the reconciliation numbers (30 seconds)
7. Decide: "This is real. I'm switching."
```

Total time from curiosity to conviction: **~15 minutes**

The trial migration should be FREE, require NO credit card, and produce a real reconciliation report they can share with their business partner.

---

## Per-System Export Guides

### Shopify POS

**What the store owner does:**

1. Log into Shopify Admin (admin.shopify.com)
2. **Products**: Go to Products → Export → All products → CSV for Excel
3. **Inventory**: Go to Products → Inventory → Export → All inventory (all states format)
4. **Customers**: Go to Customers → Export → All customers → CSV
5. **Orders** (optional): Go to Orders → Export → All orders → CSV
6. Upload all files to Afterroar Import wizard

**Time**: ~10 minutes
**Difficulty**: Easy (Shopify's export is prominent and well-documented)
**Files produced**: 3-4 CSV files

**What we auto-detect**: Shopify CSV headers are standardized. Our parser recognizes them instantly and auto-maps fields.

**Gotchas**:
- Large order exports (>50K) are emailed instead of downloaded — warn the user
- Inventory export has two formats (available-only vs all-states) — we want all-states
- Store credit lives outside Shopify — ask "Do you track store credit? Where?"

---

### Square

**What the store owner does:**

1. Log into Square Dashboard (squareup.com/dashboard)
2. **Items**: Go to Items & Orders → Items → ⋯ menu → Export Library (CSV)
3. **Customers**: Go to Customers → ⋯ menu → Export Customers (CSV)
4. **Inventory**: Included in items export (quantity column)
5. Upload to Afterroar

**Alternative (API path)**:
- If the store grants OAuth access, we can pull everything via API automatically
- This is the preferred path for stores willing to connect their account

**Time**: ~5 minutes (CSV) or ~2 minutes (OAuth connect)
**Difficulty**: Easy
**Files produced**: 2 CSV files

**Gotchas**:
- Square prices are in cents in the API but dollars in CSV exports — our parser handles both
- No native store credit — ask where they track it
- Item variations may not cleanly separate condition/language for TCG

---

### BinderPOS

**What the store owner does:**

1. Log into BinderPOS portal
2. **Inventory**:
   - Go to Products → search (leave blank for all, or filter by game)
   - Click "Export Search"
   - Check email for the CSV (may take a few minutes)
   - Download from email
   - Repeat for each game/category if needed
3. **Customers**: Export if available (method varies)
4. Upload all files to Afterroar

**Time**: ~15-20 minutes (multiple exports needed for segmented data)
**Difficulty**: Medium (email delivery adds friction, multiple files)
**Files produced**: 1-5+ CSV files

**What we should tell them**: "BinderPOS sends exports to your email. You might need to export separately for each game (MTG, Pokemon, etc.). That's fine — upload them all and we'll merge them."

**Gotchas**:
- Export is filtered by current search — must search "all" or export per segment
- CSV arrives via email (not instant download)
- Headers may vary between export types
- TCGplayer listing rules may or may not be included depending on the export type
- Customer export availability is uncertain — may need manual CSV from their records

---

### Lightspeed

**What the store owner does:**

1. Log into Lightspeed eCom admin
2. **Products**: Go to Products → Export → All products → CSV
3. **Customers**: Go to Customers → Export → CSV
4. Upload to Afterroar

**Alternative (API path)**:
- Requires Advanced or Professional subscription
- If available, OAuth connection for automatic pull

**Time**: ~10 minutes
**Difficulty**: Easy-Medium
**Files produced**: 2 CSV files

**Gotchas**:
- API is subscription-gated (not all stores have access)
- Lightspeed has native store credit (creditBalance field) — direct mapping
- Variant naming may encode condition/language

---

### Clover

**What the store owner does:**

1. Log into Clover web dashboard
2. **Items**: Go to Inventory → Items → Export (CSV)
3. **Customers**: Go to Customers → Export (if available)
4. Upload to Afterroar

**Alternative (API path)**:
- OAuth bearer token connection
- We pull items, customers, orders via REST API

**Time**: ~10 minutes
**Difficulty**: Easy
**Files produced**: 1-2 CSV files

**Gotchas**:
- Clover is generic retail — TCG data will be in item names/descriptions
- No store credit
- Customer data may be sparse (Clover's customer management is basic)

---

### SortSwift

**What the store owner does:**

1. Log into SortSwift
2. **Inventory**: Export inventory as CSV
3. **Customers**: Export customers as CSV
4. Upload to Afterroar

**Time**: ~10 minutes
**Difficulty**: Easy
**Files produced**: 2 CSV files

**Gotchas**:
- SortSwift has buylist automation — may have richer trade-in data
- Manage Comics integration data may also be exportable

---

### ShadowPOS

**What the store owner does:**

1. Contact ShadowPOS support or find export option in admin
2. Export inventory, customers as CSV
3. Upload to Afterroar

**Time**: ~15-30 minutes (export process less documented)
**Difficulty**: Medium-Hard
**Files produced**: Unknown format — manual field mapping likely needed

**Gotchas**:
- Least documented of the competitors
- May require manual CSV cleanup
- Our "Generic CSV" path handles this

---

### Generic CSV (Any System)

**What the store owner does:**

1. Export their data however they can (CSV, Excel → Save as CSV)
2. Upload to Afterroar
3. Map columns manually in our field mapping UI

**Time**: ~15-20 minutes
**Difficulty**: Medium (requires understanding their own data)
**Files produced**: 1+ CSV files

This is the **universal fallback** — any store can use this path regardless of their current POS.

---

## The "Try It" Experience

### What We Build

A **public trial migration page** at `afterroar.store/try-migration` (or within the app after signup):

**Step 1: "What POS are you on?"**
- Grid of logos/names: Shopify, Square, BinderPOS, Lightspeed, Clover, SortSwift, ShadowPOS, Other
- Selecting one shows the specific export guide with screenshots

**Step 2: "Follow these steps to export"**
- Source-specific guide with:
  - Screenshots of where to click in their current POS
  - Expected file format description
  - "What to do if..." troubleshooting tips
  - Estimated time: "This takes about 5 minutes"

**Step 3: "Upload your file(s)"**
- Drag-and-drop zone
- Support multiple files (for BinderPOS multi-export)
- Instant header detection + source system confirmation
- "We detected this as a Shopify Products export with 3,247 rows"

**Step 4: "Review your data"**
- Auto-mapped fields (green checkmarks)
- Unmapped fields (yellow, with dropdown to assign)
- Preview table showing first 20 rows as they'd appear in Afterroar
- Running totals: "3,247 items, $47,293 retail value, 1,247 customers"

**Step 5: "See your migration report"**
- Dry run results:
  ```
  Would create: 2,891 inventory items
  Would update: 312 (matching existing)
  Would skip: 44 (duplicates)
  Errors: 0

  Inventory total: 14,832 units ✓
  Retail value: $47,293.00 ✓
  ```
- This is the "aha" moment — they see their real data, mapped correctly, with zero errors

**Step 6: "Ready to go live?"**
- "Commit Import" button (if they have an account)
- "Sign up to import" button (if they're just trying)
- Download reconciliation report as PDF (even without committing)
- The report itself is a sales tool they take to their business partner

### What We DON'T Require

- No credit card to try
- No phone call with sales
- No "request a demo" form
- No waiting for someone to get back to them
- No installing anything

The store owner does it themselves, on their own time, with their own data.

---

## OAuth "Connect Your POS" Flow (Phase 2)

For Shopify and Square, we can offer an even simpler path:

1. Click "Connect Shopify" / "Connect Square"
2. OAuth redirect → grant read permissions
3. We pull all data automatically (products, inventory, customers, orders)
4. Show the same preview/reconciliation flow
5. No CSV export needed at all

This is the premium experience. Build it after CSV import is proven.

---

## What Blocks a Successful Trial?

| Blocker | Frequency | Mitigation |
|---------|-----------|------------|
| Store can't find export button | Common | Screenshot guides per POS system |
| Export is empty or wrong format | Occasional | Header detection + "this doesn't look right" warning |
| BinderPOS email delay | Common | "Check your email (including spam)" messaging |
| TCG data in weird places | Common | Heuristic parsers + manual mapping fallback |
| Store credit tracked outside POS | Very common | "Where do you track store credit?" question in wizard |
| Too many items for Vercel timeout | Rare (>5K) | Batch processing (500 rows per API call) |
| Store owner gives up | The real risk | Make steps 1-3 take <5 minutes |

---

## Metrics to Track

| Metric | What It Tells Us |
|--------|------------------|
| Trial started (selected POS) | Top-of-funnel interest |
| File uploaded | Committed enough to export data |
| Preview viewed | Saw their real data in Afterroar |
| Dry run completed | Saw the reconciliation numbers |
| Import committed | Converted to real user |
| Time from start to preview | Where friction lives |
| Drop-off by step | Which step loses people |
| Drop-off by source POS | Which exports are too hard |
