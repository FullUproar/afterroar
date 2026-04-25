"use client";

import { formatCents } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Deck Summary — sticky bottom panel with stock progress + total.    */
/*  Operator-grade: mono caps labels, Antonio numerics, orange CTA.    */
/* ------------------------------------------------------------------ */

interface DeckSummaryProps {
  totalCards: number;
  inStockCards: number;
  needToOrder: number;
  estimatedTotal: number;
  onAddAllToCart: () => void;
  loading?: boolean;
}

export function DeckSummary({
  totalCards,
  inStockCards,
  needToOrder,
  estimatedTotal,
  onAddAllToCart,
  loading,
}: DeckSummaryProps) {
  if (totalCards === 0) return null;

  const stockPercent = totalCards > 0 ? Math.round((inStockCards / totalCards) * 100) : 0;
  const barColor =
    stockPercent >= 80 ? "var(--teal)" :
    stockPercent >= 50 ? "var(--yellow)" :
    "var(--red)";

  return (
    <div
      className="sticky bottom-0 z-10 space-y-3 p-4"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--rule-hi)",
        boxShadow: "0 -8px 30px -10px rgba(0,0,0,0.7)",
      }}
    >
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.18em" }}>
          <span className="text-ink-faint font-semibold">Stock Availability</span>
          <span className="text-ink font-bold tabular-nums">{stockPercent}%</span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--panel-mute)",
            border: "1px solid var(--rule-faint)",
            overflow: "hidden",
          }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${stockPercent}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-3"
        style={{
          gap: 1,
          background: "var(--rule)",
          border: "1px solid var(--rule)",
        }}
      >
        {[
          { k: "Cards Needed", v: totalCards.toLocaleString(), tone: "var(--ink)" },
          { k: "In Stock", v: inStockCards.toLocaleString(), tone: "var(--teal)" },
          { k: "Est. Total", v: formatCents(estimatedTotal), tone: "var(--ink)", isMono: true },
        ].map((cell) => (
          <div key={cell.k} className="px-2 py-2 text-center" style={{ background: "var(--panel-mute)" }}>
            <div
              className={cell.isMono ? "font-mono font-semibold tabular-nums" : "font-display font-semibold"}
              style={{
                fontSize: cell.isMono ? "1rem" : "1.4rem",
                color: cell.tone,
                lineHeight: 1,
                letterSpacing: cell.isMono ? "0.02em" : "0.005em",
              }}
            >
              {cell.v}
            </div>
            <div
              className="font-mono uppercase font-semibold text-ink-faint mt-1"
              style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
            >
              {cell.k}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onAddAllToCart}
        disabled={inStockCards === 0 || loading}
        className="w-full font-display uppercase transition-colors disabled:opacity-40"
        style={{
          minHeight: 56,
          background: "var(--orange)",
          color: "var(--void)",
          letterSpacing: "0.06em",
          fontWeight: 600,
          fontSize: "0.95rem",
          border: "1px solid var(--orange)",
          boxShadow: "0 0 18px rgba(255,122,0,0.18)",
        }}
      >
        {loading
          ? "Adding…"
          : `Add ${inStockCards} Available Cards to Cart`}
      </button>

      {needToOrder > 0 && (
        <p
          className="text-center font-mono text-ink-faint"
          style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
        >
          {needToOrder} card{needToOrder !== 1 ? "s" : ""} unavailable — check substitutes or nearby stores above
        </p>
      )}
    </div>
  );
}
