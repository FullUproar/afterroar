-- Phase 2 schema additions: multi-barcode, variants, cost history, vendor
-- items, PO landed cost, box breaks. Hand-applied (Prisma db push diff
-- choked on a pre-existing generated column unrelated to these changes).
--
-- Idempotent: every ALTER / CREATE uses IF NOT EXISTS so re-running is
-- safe. Apply with:
--   psql $DATABASE_URL -f migrations/2026-04-25-phase2-additions.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- pos_inventory_items — multi-barcode, variants, denormalised cost
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE pos_inventory_items
  ADD COLUMN IF NOT EXISTS barcodes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS last_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS parent_id TEXT,
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

-- Soft FK on parent_id; SetNull on delete so deleting a parent variant
-- doesn't cascade-delete the children that may still be sellable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pos_inventory_items_parent_id_fkey'
  ) THEN
    ALTER TABLE pos_inventory_items
      ADD CONSTRAINT pos_inventory_items_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES pos_inventory_items(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS pos_inventory_items_parent_id_idx
  ON pos_inventory_items(parent_id);

-- GIN index on barcodes for fast `barcodes @> ARRAY[code]` lookups.
CREATE INDEX IF NOT EXISTS pos_inventory_items_barcodes_gin
  ON pos_inventory_items USING GIN (barcodes);

-- Backfill: copy primary barcode into barcodes[] on existing rows so the
-- multi-barcode lookup works for legacy inventory without a UI pass.
UPDATE pos_inventory_items
SET barcodes = ARRAY[barcode]
WHERE barcode IS NOT NULL
  AND barcode <> ''
  AND (barcodes IS NULL OR cardinality(barcodes) = 0);

-- Backfill last_cost from the current cost so the History tab has a starting
-- point even for items that never get reordered.
UPDATE pos_inventory_items
SET last_cost_cents = cost_cents
WHERE last_cost_cents IS NULL
  AND cost_cents > 0;

UPDATE pos_inventory_items
SET first_cost_cents = cost_cents
WHERE first_cost_cents IS NULL
  AND cost_cents > 0;

-- ─────────────────────────────────────────────────────────────────────
-- pos_purchase_orders — landed cost columns
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE pos_purchase_orders
  ADD COLUMN IF NOT EXISTS freight_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_allocation TEXT NOT NULL DEFAULT 'by_cost';

-- ─────────────────────────────────────────────────────────────────────
-- pos_suppliers — distributor metadata
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE pos_suppliers
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS pos_suppliers_store_id_idx
  ON pos_suppliers(store_id);

-- ─────────────────────────────────────────────────────────────────────
-- pos_vendor_items — per-(supplier, item) link with preferred flag
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_vendor_items (
  id                TEXT PRIMARY KEY,
  store_id          TEXT NOT NULL,
  supplier_id       TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  vendor_sku        TEXT,
  case_pack         INTEGER,
  last_cost_cents   INTEGER,
  preferred         BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_vendor_items_store_fk FOREIGN KEY (store_id)
    REFERENCES pos_stores(id) ON DELETE CASCADE,
  CONSTRAINT pos_vendor_items_supplier_fk FOREIGN KEY (supplier_id)
    REFERENCES pos_suppliers(id) ON DELETE CASCADE,
  CONSTRAINT pos_vendor_items_item_fk FOREIGN KEY (inventory_item_id)
    REFERENCES pos_inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT pos_vendor_items_supplier_item_unique
    UNIQUE (supplier_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS pos_vendor_items_store_id_idx
  ON pos_vendor_items(store_id);
CREATE INDEX IF NOT EXISTS pos_vendor_items_inventory_item_id_idx
  ON pos_vendor_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS pos_vendor_items_store_preferred_idx
  ON pos_vendor_items(store_id, preferred);

-- ─────────────────────────────────────────────────────────────────────
-- pos_cost_history — audit of every cost change
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_cost_history (
  id                TEXT PRIMARY KEY,
  store_id          TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  cost_cents        INTEGER NOT NULL,
  source            TEXT NOT NULL,
  purchase_order_id TEXT,
  supplier_id       TEXT,
  quantity          INTEGER,
  note              TEXT,
  staff_id          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_cost_history_store_fk FOREIGN KEY (store_id)
    REFERENCES pos_stores(id) ON DELETE CASCADE,
  CONSTRAINT pos_cost_history_item_fk FOREIGN KEY (inventory_item_id)
    REFERENCES pos_inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pos_cost_history_store_id_idx
  ON pos_cost_history(store_id);
CREATE INDEX IF NOT EXISTS pos_cost_history_item_created_idx
  ON pos_cost_history(inventory_item_id, created_at);

-- ─────────────────────────────────────────────────────────────────────
-- pos_break_recipes — reusable "break N parents into M children" recipe
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_break_recipes (
  id                   TEXT PRIMARY KEY,
  store_id             TEXT NOT NULL,
  parent_inventory_id  TEXT NOT NULL,
  child_inventory_id   TEXT NOT NULL,
  child_qty_per_parent INTEGER NOT NULL,
  name                 TEXT,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_break_recipes_store_fk FOREIGN KEY (store_id)
    REFERENCES pos_stores(id) ON DELETE CASCADE,
  CONSTRAINT pos_break_recipes_parent_fk FOREIGN KEY (parent_inventory_id)
    REFERENCES pos_inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT pos_break_recipes_child_fk FOREIGN KEY (child_inventory_id)
    REFERENCES pos_inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT pos_break_recipes_parent_child_unique
    UNIQUE (parent_inventory_id, child_inventory_id)
);

CREATE INDEX IF NOT EXISTS pos_break_recipes_store_id_idx
  ON pos_break_recipes(store_id);

-- ─────────────────────────────────────────────────────────────────────
-- pos_break_events — audit trail of break operations
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_break_events (
  id                   TEXT PRIMARY KEY,
  store_id             TEXT NOT NULL,
  recipe_id            TEXT,
  parent_inventory_id  TEXT NOT NULL,
  parent_qty_consumed  INTEGER NOT NULL,
  children             JSONB NOT NULL DEFAULT '[]',
  staff_id             TEXT,
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_break_events_store_fk FOREIGN KEY (store_id)
    REFERENCES pos_stores(id) ON DELETE CASCADE,
  CONSTRAINT pos_break_events_parent_fk FOREIGN KEY (parent_inventory_id)
    REFERENCES pos_inventory_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS pos_break_events_store_id_idx
  ON pos_break_events(store_id);
CREATE INDEX IF NOT EXISTS pos_break_events_store_created_idx
  ON pos_break_events(store_id, created_at);

COMMIT;
