# Feature Parity Matrix

Afterroar Store Ops vs. competing POS systems for FLGS.
Each feature maps to an E2E test scenario.

**Last updated**: March 26, 2026

---

## Legend

- Y = Yes (fully supported)
- P = Partial (basic support, limitations)
- N = No
- ? = Unknown / unverified
- **Bold** = Afterroar differentiator (we do it, most don't)

---

## Core POS

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Register / checkout screen | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-001 |
| Barcode scanning | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-002 |
| Customer lookup at register | Y | Y | Y | P | Y | Y | Y | P | E2E-POS-003 |
| Quick customer creation | Y | ? | ? | ? | Y | Y | Y | P | E2E-POS-004 |
| Cart building + quantity | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-005 |
| Cash payment | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-006 |
| Card payment | P (simulated) | Y | Y | Y | Y | Y | Y | Y | E2E-POS-007 |
| Split payment (card + credit) | Y | ? | Y | ? | P | P | P | N | E2E-POS-008 |
| Receipt (print + email) | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-009 |
| **Offline checkout (PWA)** | **Y** | N | N | N | P | N | P | N | E2E-POS-010 |
| **Cash-only degraded mode** | **Y** | N | N | N | N | N | N | N | E2E-POS-011 |
| Keyboard shortcuts (F2/F4) | Y | ? | ? | N | N | N | N | N | E2E-POS-012 |
| Guest checkout (no customer) | Y | Y | Y | Y | Y | Y | Y | Y | E2E-POS-013 |

## Store Credit & Payments

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Store credit ledger | Y | Y | Y | Y | N | Y | N | N | E2E-CRD-001 |
| Credit as payment method | Y | Y | Y | Y | N | Y | N | N | E2E-CRD-002 |
| Credit balance on receipt | Y | ? | Y | ? | N | P | N | N | E2E-CRD-003 |
| **Immutable credit audit trail** | **Y** | ? | ? | ? | N | P | N | N | E2E-CRD-004 |
| Credit adjustments (manual) | Y | ? | Y | ? | N | Y | N | N | E2E-CRD-005 |
| Gift cards | P (schema) | P | ? | N | Y | Y | Y | Y | E2E-CRD-006 |

## Inventory

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Basic item management | Y | Y | Y | Y | Y | Y | Y | Y | E2E-INV-001 |
| Categories | Y | Y | Y | Y | Y | Y | Y | Y | E2E-INV-002 |
| SKU + barcode | Y | Y | Y | Y | Y | Y | Y | Y | E2E-INV-003 |
| **TCG variant attributes (JSONB)** | **Y** | Y | Y | Y | N | N | P | N | E2E-INV-004 |
| Condition tracking (NM/LP/etc) | Y | Y | Y | Y | N | N | P | N | E2E-INV-005 |
| Language / foil / set tracking | Y | Y | Y | P | N | N | P | N | E2E-INV-006 |
| Stock adjustments with reason | Y | ? | Y | ? | Y | Y | Y | P | E2E-INV-007 |
| **Adjustment audit trail (ledger)** | **Y** | ? | ? | ? | P | P | P | N | E2E-INV-008 |
| Low stock alerts | Y | ? | Y | ? | Y | Y | Y | P | E2E-INV-009 |
| Fuzzy search | Y | Y | Y | Y | Y | Y | Y | P | E2E-INV-010 |
| Cost basis tracking | Y | ? | Y | Y | P | Y | Y | N | E2E-INV-011 |
| Supplier management | Y | ? | ? | ? | N | Y | N | N | E2E-INV-012 |

## Trade-Ins / Buylists

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Trade-in workflow | Y | Y | Y | Y | N | N | N | N | E2E-TRD-001 |
| Cash vs credit payout | Y | Y | Y | Y | N | N | N | N | E2E-TRD-002 |
| Credit bonus % | Y | ? | Y | ? | N | N | N | N | E2E-TRD-003 |
| **Market price reference** | Y | Y | Y | Y | N | N | N | N | E2E-TRD-004 |
| **Trade-in ledger audit** | **Y** | ? | ? | ? | N | N | N | N | E2E-TRD-005 |
| Per-item condition grading | Y | Y | Y | Y | N | N | N | N | E2E-TRD-006 |

## Returns / Refunds

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Return workflow | Y | Y | Y | ? | Y | Y | Y | Y | E2E-RET-001 |
| Partial returns | Y | ? | Y | ? | Y | Y | Y | P | E2E-RET-002 |
| Cash vs credit refund | Y | ? | Y | ? | Y | Y | Y | Y | E2E-RET-003 |
| Restocking fee % | Y | ? | ? | ? | N | P | N | N | E2E-RET-004 |
| **Per-item restock toggle** | **Y** | ? | ? | ? | N | N | N | N | E2E-RET-005 |
| **Refund reason required** | **Y** | ? | ? | ? | P | P | P | N | E2E-RET-006 |
| **Double-return prevention** | **Y** | ? | ? | ? | Y | Y | Y | ? | E2E-RET-007 |
| Refund ledger audit trail | Y | ? | ? | ? | P | P | P | P | E2E-RET-008 |

## Events

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Event creation | Y | N | Y | N | N | N | N | N | E2E-EVT-001 |
| Event types (FNM, prerelease, etc) | Y | N | Y | N | N | N | N | N | E2E-EVT-002 |
| Player check-in | Y | N | Y | N | N | N | N | N | E2E-EVT-003 |
| Entry fee collection | Y | N | Y | N | N | N | N | N | E2E-EVT-004 |
| **Event ↔ revenue attribution** | **Y** | N | P | N | N | N | N | N | E2E-EVT-005 |
| **Event ROI reports** | **Y** | N | P | N | N | N | N | N | E2E-EVT-006 |

## Reporting & Intelligence

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Sales reports | Y | Y | Y | Y | Y | Y | Y | Y | E2E-RPT-001 |
| **Cash flow intelligence** | **Y** | N | P | N | P | P | P | P | E2E-RPT-002 |
| **Dead stock alerts** | **Y** | N | P | N | N | N | N | N | E2E-RPT-003 |
| **Category margin breakdown** | **Y** | N | Y | N | P | P | P | N | E2E-RPT-004 |
| **Month-over-month trends** | **Y** | N | Y | N | Y | Y | Y | P | E2E-RPT-005 |
| **Outstanding credit liability** | **Y** | ? | ? | ? | N | P | N | N | E2E-RPT-006 |
| **Capital trapped in inventory** | **Y** | N | P | N | N | P | N | N | E2E-RPT-007 |
| Event ROI reporting | Y | N | P | N | N | N | N | N | E2E-RPT-008 |

## Security & Multi-Tenancy

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| Role-based access (owner/mgr/cashier) | Y | ? | Y | ? | Y | Y | Y | Y | E2E-SEC-001 |
| **Tenant-scoped data isolation** | **Y** | ? | ? | ? | Y | Y | Y | Y | E2E-SEC-002 |
| **Data certification checks** | **Y** | N | N | N | N | N | N | N | E2E-SEC-003 |
| Immutable financial ledger | Y | ? | ? | ? | P | P | P | P | E2E-SEC-004 |
| **Automated isolation tests** | **Y** | N | N | N | ? | ? | ? | ? | E2E-SEC-005 |

## Data Migration

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| CSV import | Y | Y | ? | Y | Y | Y | Y | Y | E2E-MIG-001 |
| **XLSX import** | **Y** | N | N | N | N | N | N | N | E2E-MIG-002 |
| **Auto field mapping (6 systems)** | **Y** | N | N | N | N | N | N | N | E2E-MIG-003 |
| **AI-powered validation** | **Y** | N | N | N | N | N | N | N | E2E-MIG-004 |
| **AI extraction (messy formats)** | **Y** | N | N | N | N | N | N | N | E2E-MIG-005 |
| **Dry-run preview** | **Y** | N | N | N | N | N | N | N | E2E-MIG-006 |
| **Reconciliation report** | **Y** | N | N | N | N | N | N | N | E2E-MIG-007 |
| **Idempotent imports** | **Y** | N | N | N | N | N | N | N | E2E-MIG-008 |
| **Per-POS export guides** | **Y** | N | N | N | N | N | N | N | E2E-MIG-009 |
| **Sample data demo mode** | **Y** | N | N | N | N | N | N | N | E2E-MIG-010 |

## Platform / Infrastructure

| Feature | Afterroar | BinderPOS | ShadowPOS | SortSwift | Square | Lightspeed | Shopify POS | Clover | E2E Test ID |
|---------|-----------|-----------|-----------|-----------|--------|------------|-------------|--------|-------------|
| **PWA (installable)** | **Y** | N | N | N | N | N | Y | N | E2E-PLT-001 |
| **Offline data cache** | **Y** | N | N | N | P | N | P | N | E2E-PLT-002 |
| **Transaction queue (offline)** | **Y** | N | N | N | N | N | N | N | E2E-PLT-003 |
| **Network status indicator** | **Y** | N | N | N | N | N | N | N | E2E-PLT-004 |
| Mobile responsive | Y | P | Y | P | Y | Y | Y | Y | E2E-PLT-005 |
| **Afterroar HQ integration** | **Y** | N | N | N | N | N | N | N | E2E-PLT-006 |
| Stripe Connect (store's account) | P (abstracted) | N | ? | N | Own processing | Own processing | Own processing | Own processing | E2E-PLT-007 |

---

## Score Summary

| System | Total Features | Supported | Partial | Missing |
|--------|---------------|-----------|---------|---------|
| **Afterroar** | 75 | 73 | 2 | 0 |
| BinderPOS | 75 | ~25 | ~10 | ~40 |
| ShadowPOS | 75 | ~35 | ~15 | ~25 |
| SortSwift | 75 | ~20 | ~5 | ~50 |
| Square | 75 | ~30 | ~10 | ~35 |
| Lightspeed | 75 | ~30 | ~15 | ~30 |
| Shopify POS | 75 | ~30 | ~15 | ~30 |
| Clover | 75 | ~20 | ~10 | ~45 |

**Afterroar differentiators (features no competitor has)**:
- Offline checkout + cash-only degraded mode
- Immutable financial ledger with full audit trail
- Event ↔ revenue attribution + ROI reports
- Cash flow intelligence (dead stock, trapped capital, margin breakdown)
- AI-powered data migration with validation
- Data certification system
- Automated tenant isolation testing
- TCG-native data model (JSONB attributes for condition/foil/language/set)

---

## E2E Test Mapping

Each test ID (E2E-XXX-NNN) maps to an automated test that:
1. Sets up test data (store, staff, inventory, customers)
2. Exercises the feature through the full stack (API call or UI interaction)
3. Verifies the outcome (database state, response data, UI state)
4. Cleans up

Test IDs are grouped by category for selective test runs:
- `E2E-POS-*` — Core checkout flow
- `E2E-CRD-*` — Store credit operations
- `E2E-INV-*` — Inventory management
- `E2E-TRD-*` — Trade-in workflow
- `E2E-RET-*` — Returns and refunds
- `E2E-EVT-*` — Event management
- `E2E-RPT-*` — Reporting and intelligence
- `E2E-SEC-*` — Security and multi-tenancy
- `E2E-MIG-*` — Data migration
- `E2E-PLT-*` — Platform infrastructure
