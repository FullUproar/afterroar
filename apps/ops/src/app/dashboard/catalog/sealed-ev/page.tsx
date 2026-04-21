"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { SubNav } from "@/components/ui/sub-nav";
import { FeatureGate } from "@/components/feature-gate";

const INVENTORY_TABS = [
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/catalog", label: "Card Catalog" },
  { href: "/dashboard/deck-builder", label: "Deck Builder" },
  { href: "/dashboard/trade-ins", label: "Trade-Ins" },
  { href: "/dashboard/consignment", label: "Consignment" },
];

interface ChaseCard {
  name: string;
  rarity: string;
  price_usd: number;
  price_foil_usd: number;
  image_url: string | null;
}

interface SealedEVResult {
  set_code: string;
  estimated_ev_cents: number;
  estimated_ev_display: string;
  breakdown: {
    rares_in_set: number;
    mythics_in_set: number;
    avg_rare_price: string;
    avg_mythic_price: string;
    avg_rare_foil_price: string;
    avg_mythic_foil_price: string;
    estimated_rares_per_box: number;
    estimated_mythics_per_box: number;
  };
  chase_cards: ChaseCard[];
  disclaimer: string;
}

const EXAMPLE_SETS = [
  { code: "MH3", name: "Modern Horizons 3" },
  { code: "BLB", name: "Bloomburrow" },
  { code: "OTJ", name: "Outlaws of Thunder Junction" },
  { code: "DSK", name: "Duskmourn" },
];

export default function SealedEVPage() {
  const [setCode, setSetCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SealedEVResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length < 2) {
      setError("Enter a set code (e.g., MH3, BLB)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/catalog/sealed-ev?set=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to calculate EV");
      }
      const data: SealedEVResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={INVENTORY_TABS} />

      <div>
        <PageHeader title="Sealed EV Calculator" backHref="/dashboard/catalog" />
        <p className="text-sm text-muted mt-1">
          Estimate the expected value of a Magic booster box by set. MTG only.
        </p>
      </div>

      <FeatureGate module="tcg_engine">
        {/* Input */}
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <div className="flex gap-2 items-stretch flex-wrap">
            <input
              type="text"
              value={setCode}
              onChange={(e) => setSetCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") calculate(setCode);
              }}
              placeholder="Set code (e.g., MH3)"
              maxLength={6}
              className="flex-1 min-w-[140px] rounded-lg border border-input-border bg-card-hover px-3 py-2.5 text-sm font-mono uppercase text-foreground focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => calculate(setCode)}
              disabled={loading || setCode.trim().length < 2}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 transition-opacity disabled:opacity-50 min-w-24"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running
                </span>
              ) : "Calculate"}
            </button>
          </div>

          {/* Quick picks */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted uppercase tracking-wider">Try:</span>
            {EXAMPLE_SETS.map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  setSetCode(s.code);
                  calculate(s.code);
                }}
                disabled={loading}
                className="rounded-md border border-card-border bg-card-hover px-2 py-1 text-[11px] font-mono text-muted hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-50"
                title={s.name}
              >
                {s.code}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <div className="font-medium">Couldn't calculate EV</div>
            <div className="text-red-300/80 mt-1">{error}</div>
          </div>
        )}

        {/* Empty — nothing searched yet */}
        {!loading && !result && !error && (
          <div className="rounded-xl border border-dashed border-card-border bg-card/40 p-8 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm text-muted">
              Enter a Magic set code to see estimated booster box value.
            </p>
            <p className="text-xs text-muted/70 mt-1">
              Uses live Scryfall prices and approximate pull rates.
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Hero: EV number */}
            <div className="rounded-xl border border-card-border bg-gradient-to-br from-card to-card-hover p-6 text-center">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">
                {result.set_code} — Estimated Box EV
              </div>
              <div className="text-5xl font-bold text-accent tabular-nums tracking-tight">
                {result.estimated_ev_display}
              </div>
              <div className="text-xs text-muted mt-2">
                Based on {result.breakdown.rares_in_set} rares and{" "}
                {result.breakdown.mythics_in_set} mythics in set
              </div>
            </div>

            {/* Breakdown chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatChip
                label="Avg Rare"
                value={result.breakdown.avg_rare_price}
                sub={`${result.breakdown.estimated_rares_per_box}/box`}
              />
              <StatChip
                label="Avg Mythic"
                value={result.breakdown.avg_mythic_price}
                sub={`${result.breakdown.estimated_mythics_per_box}/box`}
                accent
              />
              <StatChip
                label="Avg Rare Foil"
                value={result.breakdown.avg_rare_foil_price}
              />
              <StatChip
                label="Avg Mythic Foil"
                value={result.breakdown.avg_mythic_foil_price}
                accent
              />
            </div>

            {/* Chase cards */}
            {result.chase_cards.length > 0 && (
              <div className="rounded-xl border border-card-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Top chase cards
                  </h3>
                  <span className="text-[11px] text-muted">
                    Sorted by nonfoil market price
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {result.chase_cards.map((card, i) => (
                    <ChaseCardTile key={`${card.name}-${i}`} card={card} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80">
              <span className="font-medium text-amber-300">Heads up:</span>{" "}
              {result.disclaimer}
            </div>
          </div>
        )}
      </FeatureGate>
    </div>
  );
}

/* ---------- helpers ---------- */

function StatChip({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent
          ? "border-accent/30 bg-accent/5"
          : "border-card-border bg-card"
      }`}
    >
      <div className="text-[10px] text-muted uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`text-lg font-semibold tabular-nums mt-0.5 ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted/80 mt-0.5 tabular-nums">
          {sub}
        </div>
      )}
    </div>
  );
}

function ChaseCardTile({ card, rank }: { card: ChaseCard; rank: number }) {
  return (
    <div className="rounded-lg border border-card-border bg-card-hover/40 overflow-hidden">
      <div className="relative aspect-[5/7] bg-card-hover">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/50 text-xs">
            No image
          </div>
        )}
        <div className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-foreground tabular-nums">
          #{rank}
        </div>
        {card.rarity === "mythic" && (
          <div className="absolute top-1 right-1 rounded bg-orange-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white tracking-wider">
            Mythic
          </div>
        )}
      </div>
      <div className="p-2 space-y-0.5">
        <div className="text-xs font-medium text-foreground truncate" title={card.name}>
          {card.name}
        </div>
        <div className="flex items-baseline justify-between gap-1 tabular-nums">
          <span className="text-sm font-semibold text-accent">
            ${card.price_usd.toFixed(2)}
          </span>
          {card.price_foil_usd > 0 && (
            <span className="text-[10px] text-muted">
              foil ${card.price_foil_usd.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
