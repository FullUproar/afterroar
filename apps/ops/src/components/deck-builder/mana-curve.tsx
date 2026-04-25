"use client";

/* ------------------------------------------------------------------ */
/*  ManaCurve — bar chart of CMC distribution, Operator Console style. */
/*  0, 1, 2, 3, 4, 5, 6, 7+. Lands excluded by caller (deck-analysis). */
/* ------------------------------------------------------------------ */

import type { ManaCurveBucket } from "@/lib/deck-analysis";

interface ManaCurveProps {
  buckets: ManaCurveBucket[];
  avgCmc: number;
  className?: string;
}

export function ManaCurve({ buckets, avgCmc, className }: ManaCurveProps) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between">
        <div
          className="font-mono uppercase font-semibold text-ink-faint"
          style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
        >
          Mana Curve
        </div>
        <div
          className="font-mono tabular-nums text-ink-faint"
          style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
        >
          avg <span className="text-ink font-semibold">{avgCmc.toFixed(2)}</span>
          <span className="mx-2 text-ink-ghost">·</span>
          <span className="text-ink font-semibold">{total}</span> nonland
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {buckets.map((b) => {
          const pct = (b.count / max) * 100;
          return (
            <div key={b.cmc} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full transition-all duration-300"
                  style={{
                    height: `${Math.max(2, pct)}%`,
                    minHeight: 2,
                    background: "linear-gradient(to top, var(--orange) 0%, rgba(255,122,0,0.4) 100%)",
                    boxShadow: "0 0 6px rgba(255,122,0,0.18)",
                  }}
                  title={`CMC ${b.cmc === 7 ? "7+" : b.cmc}: ${b.count}`}
                />
              </div>
              <div
                className="font-mono tabular-nums text-ink-faint"
                style={{ fontSize: "0.6rem", letterSpacing: "0.04em" }}
              >
                {b.cmc === 7 ? "7+" : b.cmc}
              </div>
              <div
                className="font-mono tabular-nums text-ink"
                style={{ fontSize: "0.66rem", fontWeight: 600, marginTop: "-0.2rem" }}
              >
                {b.count > 0 ? b.count : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
