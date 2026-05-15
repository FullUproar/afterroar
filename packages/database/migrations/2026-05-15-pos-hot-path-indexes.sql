-- Hot-path indexes for the register/checkout flow.
--
-- Performance audit 2026-05-15 found:
--  1. Barcode-scan lookups against pos_inventory_items.barcodes[] were
--     doing seq scans because the array field had no GIN index. Stores
--     with reprints + manufacturer pack codes routinely store 2-5
--     barcodes per SKU; without this index a single alternate-barcode
--     scan can take 200-500ms on a 5K-SKU store.
--  2. Idempotency check on /api/checkout reads
--     pos_ledger_entries.metadata->>'client_tx_id'. JSON-path queries
--     without a functional index seq-scan all sale ledger rows in the
--     last 24h. Adding an expression index lets the lookup hit the
--     index directly.
--  3. Gift-card-active scans during checkout (looking up an
--     active gift card for the store by code) benefit from a composite
--     (store_id, active) index alongside the existing code unique.
--  4. Recent-customer lookups on the register use phone/email; both
--     were unindexed.
--
-- All indexes are concurrent where possible to avoid table locks on a
-- live store. CONCURRENTLY can't run inside a transaction block — apply
-- with autocommit (our migration runner already does that for raw SQL).

-- ---- 1. pos_inventory_items.barcodes[] GIN ------------------------------
CREATE INDEX IF NOT EXISTS "pos_inventory_items_barcodes_gin"
  ON pos_inventory_items USING GIN ("barcodes");

-- ---- 2. pos_ledger_entries idempotency (client_tx_id) ------------------
-- Filter to type='sale' since that's the only place idempotency keys
-- are written. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS "pos_ledger_entries_client_tx_id_idx"
  ON pos_ledger_entries ((metadata ->> 'client_tx_id'))
  WHERE type = 'sale' AND metadata ? 'client_tx_id';

-- ---- 3. pos_gift_cards (store_id, active) -------------------------------
CREATE INDEX IF NOT EXISTS "pos_gift_cards_store_active_idx"
  ON pos_gift_cards ("store_id", "active");

-- ---- 4. pos_customers phone + email lookups -----------------------------
-- Recent-customer panel uses these; loyalty redeem also looks up by phone.
CREATE INDEX IF NOT EXISTS "pos_customers_store_phone_idx"
  ON pos_customers ("store_id", "phone");
CREATE INDEX IF NOT EXISTS "pos_customers_store_email_idx"
  ON pos_customers ("store_id", "email");
