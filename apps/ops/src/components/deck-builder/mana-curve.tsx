"use client";

/* ------------------------------------------------------------------ */
/*  ManaCurve — bar chart of CMC distribution                          */
/*  Follows Moxfield / Archidekt convention: 0, 1, 2, 3, 4, 5, 6, 7+.  */
/*  Lands are excluded by the caller (deck-analysis handles that).     */
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
        <div className="text-[10px] text-muted uppercase tracking-wider">Mana Curve</div>
        <div className="text-[11px] text-muted tabular-nums">
          avg <span className="text-foreground font-semibold">{avgCmc.toFixed(2)}</span>
          <span className="mx-2 text-card-border">|</span>
          <span className="text-foreground font-semibold">{total}</span> nonland
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {buckets.map((b) => {
          const pct = (b.count / max) * 100;
          return (
            <div key={b.cmc} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-accent/80 to-accent/40 min-h-[2px] transition-all duration-300"
                  style={{ height: `${Math.max(2, pct)}%` }}
                  title={`CMC ${b.cmc === 7 ? "7+" : b.cmc}: ${b.count}`}
                />
              </div>
              <div className="text-[10px] text-muted tabular-nums">
                {b.cmc === 7 ? "7+" : b.cmc}
              </div>
              <div className="text-[10px] text-foreground tabular-nums font-medium -mt-1">
                {b.count > 0 ? b.count : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
