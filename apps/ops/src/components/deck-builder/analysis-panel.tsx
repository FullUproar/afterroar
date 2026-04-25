"use client";

/* ------------------------------------------------------------------ */
/*  AnalysisPanel — deck analysis summary in Operator Console style.   */
/*  Color identity, mana curve, and format legality at a glance.       */
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

  const featured = targetFormat ? legality[targetFormat] : undefined;
  const otherFormats = FORMAT_ORDER.filter((f) => f !== targetFormat);

  return (
    <section
      className="ar-zone"
      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
    >
      <div className="ar-zone-head">
        <span>Deck Analysis</span>
        <span className="text-ink-faint">Curve · Colors · Legality</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Header: deck identity + totals */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <ColorPips colors={colors.identity} size={20} />
            <div>
              <div
                className="font-display text-ink"
                style={{ fontSize: "0.98rem", fontWeight: 600, letterSpacing: "0.005em" }}
              >
                {colors.identity.length === 0
                  ? "Colorless"
                  : formatIdentityName(colors.identity)}
              </div>
              <div
                className="font-mono text-ink-faint tabular-nums mt-0.5"
                style={{ fontSize: "0.62rem", letterSpacing: "0.06em" }}
              >
                {total_cards} cards · {nonland_count} nonland · {land_count} lands
              </div>
            </div>
          </div>

          {featured && <LegalityBadge check={featured} />}
        </div>

        {/* Mana curve */}
        {nonland_count > 0 && (
          <ManaCurve buckets={mana_curve} avgCmc={avg_cmc} />
        )}

        {/* All-format legality strip */}
        <div
          className="flex items-center gap-1.5 flex-wrap pt-3"
          style={{ borderTop: "1px solid var(--rule-faint)" }}
        >
          <span
            className="font-mono uppercase font-semibold text-ink-faint mr-1"
            style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
          >
            Also legal in
          </span>
          {otherFormats.map((f) => {
            const check = legality[f];
            if (!check || check.total_checked === 0) return null;
            if (!check.legal) return null;
            return <LegalityBadge key={f} check={check} compact />;
          })}
          {otherFormats.every((f) => !legality[f]?.legal) && (
            <span className="font-mono text-ink-faint" style={{ fontSize: "0.66rem" }}>
              None.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function formatIdentityName(identity: string[]): string {
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

  const canonicalKey = ["W", "U", "B", "R", "G"]
    .filter((c) => identity.includes(c))
    .join("");

  return names[canonicalKey] ?? identity.join("/");
}
