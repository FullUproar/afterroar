/**
 * Pricing health classifier.
 *
 * Given a store's price (cents) for an item and the current market reference
 * price (cents, e.g. TCGplayer 7d avg), classify how "healthy" the listing
 * is — used by the Operator Console UI to render the green/yellow/red
 * health-dot signal next to a price.
 *
 * Bands (configurable via env if needed later):
 *   ok    — within ±2% of market
 *   warn  — > 2% below market (we're underpricing — opportunity to raise)
 *           or > 5% above market (we're priced too high — risk of stale stock)
 *   err   — > 8% above market (definitely overpriced)
 *           or no market reference at all (market data missing/stale)
 *
 * The asymmetry is intentional: being slightly above market is worse than
 * being slightly below (customers comparison-shop).
 *
 * Returns a tuple of { state, deltaPct, hint } so callers can render
 * color + text + arrow without re-computing.
 */

export type PricingHealthState = "ok" | "warn" | "err" | "unknown";

export interface PricingHealth {
  state: PricingHealthState;
  /** Signed percentage difference: positive = your price above market. */
  deltaPct: number;
  /** Short label suitable for tooltip / mono caption. */
  hint: string;
}

const OK_BAND = 0.02;        // ±2% considered healthy
const UNDER_WARN = -0.02;    // > 2% below market: warn (underpricing)
const OVER_WARN = 0.05;      // > 5% above market: warn (overpriced)
const OVER_ERR = 0.08;       // > 8% above market: err (definitely overpriced)

export function pricingHealth(yourCents: number | null | undefined, marketCents: number | null | undefined): PricingHealth {
  if (!marketCents || marketCents <= 0) {
    return { state: "unknown", deltaPct: 0, hint: "no market data" };
  }
  if (!yourCents || yourCents <= 0) {
    return { state: "err", deltaPct: 0, hint: "not priced" };
  }

  const delta = (yourCents - marketCents) / marketCents;
  const pct = Math.round(delta * 1000) / 10; // tenths of a percent

  if (Math.abs(delta) <= OK_BAND) {
    return { state: "ok", deltaPct: pct, hint: "at market" };
  }
  if (delta < UNDER_WARN && delta > -0.05) {
    return { state: "warn", deltaPct: pct, hint: "below market — raise?" };
  }
  if (delta <= -0.05) {
    return { state: "warn", deltaPct: pct, hint: "well below market" };
  }
  if (delta >= OVER_ERR) {
    return { state: "err", deltaPct: pct, hint: "overpriced" };
  }
  if (delta >= OVER_WARN) {
    return { state: "warn", deltaPct: pct, hint: "above market" };
  }
  return { state: "ok", deltaPct: pct, hint: "near market" };
}

/**
 * Compact human-readable delta string: "+2.1%", "−5.4%", "flat".
 */
export function formatDelta(deltaPct: number): string {
  if (Math.abs(deltaPct) < 0.05) return "flat";
  const sign = deltaPct > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaPct).toFixed(1)}%`;
}
