/**
 * Landed cost allocation.
 *
 * Spreads PO header-level fees (freight, tax, other) across line items so
 * each unit's cost reflects what it actually cost to land in the store.
 *
 * Three allocation strategies:
 *   - "by_cost"   — proportional to line total (cost_cents × quantity_ordered).
 *                   Default. Closest to "expensive items absorb more freight"
 *                   which is what most stores want for general merchandise.
 *   - "by_weight" — proportional to line weight (weight_oz × quantity).
 *                   Fairer for shipping-dominated POs (think: a small expensive
 *                   item shouldn't pay the freight of a large cheap one) but
 *                   requires every line to have weight_oz set.
 *   - "even"      — split evenly per unit. Usually only useful for cases where
 *                   freight is a flat fuel surcharge unrelated to value.
 *
 * Numbers are kept in integer cents throughout. Final per-unit cost is
 * rounded; rounding crumbs are absorbed by the largest line so the sum
 * matches the PO total exactly.
 */

export type AllocationMethod = "by_cost" | "by_weight" | "even";

export interface AllocLine {
  /** Stable id used to link the result back to the source line. */
  id: string;
  /** Per-unit cost the distributor charged. */
  unit_cost_cents: number;
  /** Total quantity on the PO line. */
  quantity_ordered: number;
  /** Per-unit weight in ounces. Used by "by_weight". 0 falls back to "even". */
  weight_oz?: number | null;
}

export interface AllocResult {
  id: string;
  /** Per-unit landed cost (unit_cost + share of fees / qty), rounded. */
  landed_unit_cost_cents: number;
  /** Total fee allocation for the line (cents). */
  allocated_fee_cents: number;
}

/**
 * Allocate `total_fee_cents` across `lines` and return per-unit landed cost.
 * Pure function — no IO. Returns an array in the same order as `lines`.
 */
export function allocateLandedCost(
  lines: AllocLine[],
  total_fee_cents: number,
  method: AllocationMethod = "by_cost",
): AllocResult[] {
  if (lines.length === 0) return [];
  if (total_fee_cents <= 0) {
    return lines.map((l) => ({
      id: l.id,
      landed_unit_cost_cents: l.unit_cost_cents,
      allocated_fee_cents: 0,
    }));
  }

  // Compute per-line basis used for proportional split.
  const bases: number[] = lines.map((l) => {
    if (method === "by_weight") {
      const w = l.weight_oz ?? 0;
      return Math.max(0, w * l.quantity_ordered);
    }
    if (method === "even") {
      return Math.max(0, l.quantity_ordered);
    }
    // by_cost (default) — line total in cents
    return Math.max(0, l.unit_cost_cents * l.quantity_ordered);
  });

  let totalBasis = bases.reduce((sum, b) => sum + b, 0);
  // If basis is degenerate (all-zero), fall back to even-per-unit so we
  // never silently allocate everything to line 0.
  if (totalBasis === 0) {
    const totalQty = lines.reduce((s, l) => s + Math.max(0, l.quantity_ordered), 0);
    if (totalQty === 0) {
      // No quantity to receive → return zero-fee allocation.
      return lines.map((l) => ({
        id: l.id,
        landed_unit_cost_cents: l.unit_cost_cents,
        allocated_fee_cents: 0,
      }));
    }
    for (let i = 0; i < lines.length; i++) {
      bases[i] = Math.max(0, lines[i].quantity_ordered);
    }
    totalBasis = totalQty;
  }

  const allocations: number[] = bases.map((b) =>
    Math.round((b / totalBasis) * total_fee_cents),
  );

  // Reconcile rounding crumbs against the largest line so the sum matches.
  const sumAllocated = allocations.reduce((s, a) => s + a, 0);
  const drift = total_fee_cents - sumAllocated;
  if (drift !== 0) {
    let largestIdx = 0;
    for (let i = 1; i < allocations.length; i++) {
      if (allocations[i] > allocations[largestIdx]) largestIdx = i;
    }
    allocations[largestIdx] += drift;
  }

  return lines.map((l, i) => {
    const allocFee = allocations[i];
    const landedTotalCents = l.unit_cost_cents * l.quantity_ordered + allocFee;
    const landedPerUnit =
      l.quantity_ordered > 0
        ? Math.round(landedTotalCents / l.quantity_ordered)
        : l.unit_cost_cents;
    return {
      id: l.id,
      landed_unit_cost_cents: landedPerUnit,
      allocated_fee_cents: allocFee,
    };
  });
}
