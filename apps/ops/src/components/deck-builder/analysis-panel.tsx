"use client";

/* ------------------------------------------------------------------ */
/*  AnalysisPanel — deck analysis summary                              */
/*  Combines color identity, mana curve, and format legality.          */
/*  Level 2 of deck-builder scope: lives above the inventory match     */
/*  list, gives at-a-glance "is this deck sound" read.                 */
/* ------------------------------------------------------------------ */

import type { DeckAnalysis } from "@/lib/deck-analysis";
import { ManaCurve } from "./mana-curve";
import { ColorPips } from "./color-pips";
import { LegalityBadge } from "./legality-badge";

interface AnalysisPanelProps {
  analysis: DeckAnalysis;
  /** The format the user is targeting — highlighted in legality strip. */
  targetFormat?: string;
}

const FORMAT_ORDER = ["standard", "pioneer", "modern", "legacy", "commander", "pauper"];

export function AnalysisPanel({ analysis, targetFormat }: AnalysisPanelProps) {
  const { mana_curve, avg_cmc, colors, legality, total_cards, nonland_count, land_count } = analysis;

  // If target format specified, show that first and big.
  const featured = targetFormat ? legality[targetFormat] : undefined;
  const otherFormats = FORMAT_ORDER.filter((f) => f !== targetFormat);

  return (
    <div className="rounded-xl border border-card-border bg-card p-4 space-y-4">
      {/* Header: deck identity + totals */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <ColorPips colors={colors.identity} size={20} />
          <div className="text-sm">
            <div className="font-semibold text-foreground">
              {colors.identity.length === 0
                ? "Colorless"
                : formatIdentityName(colors.identity)}
            </div>
            <div className="text-[11px] text-muted tabular-nums">
              {total_cards} cards · {nonland_count} nonland · {land_count} lands
            </div>
          </div>
        </div>

        {/* Featured format legality — big */}
        {featured && (
          <LegalityBadge check={featured} />
        )}
      </div>

      {/* Mana curve */}
      {nonland_count > 0 && (
        <ManaCurve buckets={mana_curve} avgCmc={avg_cmc} />
      )}

      {/* All-format legality strip */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-card-border">
        <span className="text-[10px] text-muted uppercase tracking-wider mr-1">
          Also legal in
        </span>
        {otherFormats.map((f) => {
          const check = legality[f];
          if (!check || check.total_checked === 0) return null;
          // Compact: only render if this deck is legal in the format, to keep panel clean
          if (!check.legal) return null;
          return <LegalityBadge key={f} check={check} compact />;
        })}
        {otherFormats.every((f) => !legality[f]?.legal) && (
          <span className="text-[11px] text-muted">None.</span>
        )}
      </div>
    </div>
  );
}

/**
 * Name a color identity the way MTG players talk about it.
 * Falls back to listing colors if we don't know the common name.
 */
function formatIdentityName(identity: string[]): string {
  const key = identity.join("");
  const names: Record<string, string> = {
    W: "Mono-White",
    U: "Mono-Blue",
    B: "Mono-Black",
    R: "Mono-Red",
    G: "Mono-Green",
    WU: "Azorius (W/U)",
    UB: "Dimir (U/B)",
    BR: "Rakdos (B/R)",
    RG: "Gruul (R/G)",
    GW: "Selesnya (G/W)",
    WB: "Orzhov (W/B)",
    UR: "Izzet (U/R)",
    BG: "Golgari (B/G)",
    RW: "Boros (R/W)",
    UG: "Simic (U/G)",
    WUB: "Esper (W/U/B)",
    UBR: "Grixis (U/B/R)",
    BRG: "Jund (B/R/G)",
    RGW: "Naya (R/G/W)",
    GWU: "Bant (G/W/U)",
    WBG: "Abzan (W/B/G)",
    URW: "Jeskai (U/R/W)",
    BGU: "Sultai (B/G/U)",
    RWB: "Mardu (R/W/B)",
    GUR: "Temur (G/U/R)",
    WUBR: "Yore-Tiller (4-color)",
    UBRG: "Glint-Eye (4-color)",
    BRGW: "Dune-Brood (4-color)",
    RGWU: "Ink-Treader (4-color)",
    GWUB: "Witch-Maw (4-color)",
    WUBRG: "Five-Color",
  };

  // Canonicalize key against WUBRG ordering
  const canonicalKey = ["W", "U", "B", "R", "G"]
    .filter((c) => identity.includes(c))
    .join("");

  return names[canonicalKey] ?? identity.join("/");
}
