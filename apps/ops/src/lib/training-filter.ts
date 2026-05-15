/**
 * Helpers for excluding training-mode transactions from financial
 * reports. Training mode is a per-device flag that tags every sale,
 * void, refund, etc. with `metadata.training = true` so test work
 * doesn't pollute end-of-day numbers, sales tax filings, or margin
 * dashboards.
 *
 * Used by every endpoint under `/api/reports/*` plus tax-period.
 */

/**
 * True iff the entry's metadata flags it as a training-mode action.
 * Safe for any record with a `metadata: Json` field; returns false
 * when metadata is missing or shaped weirdly.
 */
export function isTrainingEntry(entry: { metadata?: unknown }): boolean {
  const meta = entry?.metadata;
  if (!meta || typeof meta !== "object") return false;
  return (meta as Record<string, unknown>).training === true;
}

/**
 * Filter helper. Reports iterate ledger entries anyway, so a
 * post-query filter is cheap and avoids Prisma JSON-path complications.
 */
export function excludeTraining<T extends { metadata?: unknown }>(
  entries: T[],
): T[] {
  return entries.filter((e) => !isTrainingEntry(e));
}

/**
 * Prisma where-clause fragment that filters out training entries at the
 * SQL level. Required for aggregate/groupBy queries where post-filter
 * isn't an option. JSON-path filter is Postgres-specific (we always
 * run on Neon), and `NOT` semantics include NULL-metadata rows, which
 * is what we want.
 *
 * Usage:
 *   where: { ...notTraining(), store_id, type: "sale", ... }
 */
export function notTraining() {
  return {
    NOT: { metadata: { path: ["training"], equals: true } },
  } as const;
}
