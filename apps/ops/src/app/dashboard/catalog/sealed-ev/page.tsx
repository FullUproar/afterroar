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

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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

      <PageHeader
        title="Sealed EV Calculator"
        crumb="TCG · Sealed EV"
        desc="Estimate the expected value of a Magic booster box by set. MTG only."
        backHref="/dashboard/catalog"
      />

      <FeatureGate module="tcg_engine">
        {/* Input */}
        <div
          className="p-4 space-y-3"
          style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
        >
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
              className="flex-1 font-mono uppercase text-ink placeholder:text-ink-faint focus:outline-none"
              style={{
                minWidth: 140,
                background: "var(--panel)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.95rem",
                padding: "0 0.85rem",
                minHeight: 48,
                letterSpacing: "0.04em",
              }}
            />
            <button
              onClick={() => calculate(setCode)}
              disabled={loading || setCode.trim().length < 2}
              className="font-mono uppercase font-semibold transition-opacity disabled:opacity-50"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                padding: "0 1.4rem",
                minHeight: 48,
                background: "var(--orange)",
                color: "var(--void)",
                border: "1px solid var(--orange)",
                minWidth: 120,
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Spinner />
                  Running
                </span>
              ) : "Calculate"}
            </button>
          </div>

          {/* Quick picks */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono uppercase font-semibold text-ink-faint"
              style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
            >
              Try
            </span>
            {EXAMPLE_SETS.map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  setSetCode(s.code);
                  calculate(s.code);
                }}
                disabled={loading}
                className="font-mono uppercase font-semibold transition-colors disabled:opacity-50"
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.16em",
                  padding: "0 0.7rem",
                  minHeight: 36,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  color: "var(--ink-soft)",
                }}
                title={s.name}
              >
                {s.code}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 font-mono"
            style={{
              background: "var(--red-mute)",
              border: "1px solid var(--red)",
              color: "var(--red)",
              fontSize: "0.78rem",
            }}
          >
            <div
              className="font-semibold uppercase"
              style={{ letterSpacing: "0.16em", fontSize: "0.66rem" }}
            >
              Couldn&apos;t Calculate EV
            </div>
            <div className="mt-1 text-ink-soft">{error}</div>
          </div>
        )}

        {/* Empty */}
        {!loading && !result && !error && (
          <div
            className="p-8 text-center"
            style={{
              background: "var(--panel-mute)",
              border: "1px dashed var(--rule-hi)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 28,
                height: 28,
                margin: "0 auto 0.75rem",
                background: "var(--orange-mute)",
                border: "1px solid var(--orange)",
                clipPath:
                  "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
              }}
            />
            <div
              className="font-display text-ink"
              style={{ fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.005em" }}
            >
              Enter a Magic set code
            </div>
            <p
              className="font-mono text-ink-faint mt-2"
              style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
            >
              Uses live Scryfall prices and approximate pull rates.
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Hero EV */}
            <div
              className="p-6 text-center"
              style={{
                background:
                  "linear-gradient(180deg,rgba(255,122,0,0.08),var(--panel)) ",
                border: "1px solid var(--orange)",
                boxShadow: "0 0 24px var(--orange-mute)",
              }}
            >
              <div
                className="font-mono uppercase font-semibold text-ink-faint"
                style={{ fontSize: "0.6rem", letterSpacing: "0.28em" }}
              >
                {result.set_code} · Estimated Box EV
              </div>
              <div
                className="font-display text-orange tabular-nums mt-2"
                style={{
                  fontSize: "3.5rem",
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {result.estimated_ev_display}
              </div>
              <div
                className="font-mono text-ink-faint mt-3"
                style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}
              >
                Based on {result.breakdown.rares_in_set} rares · {result.breakdown.mythics_in_set} mythics in set
              </div>
            </div>

            {/* Breakdown stat strip */}
            <div
              className="grid grid-cols-2 md:grid-cols-4"
              style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
            >
              {[
                {
                  k: "Avg Rare",
                  v: result.breakdown.avg_rare_price,
                  sub: `${result.breakdown.estimated_rares_per_box}/box`,
                },
                {
                  k: "Avg Mythic",
                  v: result.breakdown.avg_mythic_price,
                  sub: `${result.breakdown.estimated_mythics_per_box}/box`,
                  tone: "var(--orange)",
                },
                {
                  k: "Avg Rare Foil",
                  v: result.breakdown.avg_rare_foil_price,
                  tone: "var(--yellow)",
                },
                {
                  k: "Avg Mythic Foil",
                  v: result.breakdown.avg_mythic_foil_price,
                  tone: "var(--yellow)",
                },
              ].map((cell) => (
                <div key={cell.k} className="px-3 py-3" style={{ background: "var(--panel-mute)" }}>
                  <div
                    className="font-mono uppercase font-semibold text-ink-faint"
                    style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                  >
                    {cell.k}
                  </div>
                  <div
                    className="font-mono font-semibold mt-1 tabular-nums"
                    style={{
                      fontSize: "1.1rem",
                      letterSpacing: "0.02em",
                      color: cell.tone || "var(--ink)",
                    }}
                  >
                    {cell.v}
                  </div>
                  {cell.sub && (
                    <div
                      className="font-mono text-ink-faint mt-0.5 tabular-nums"
                      style={{ fontSize: "0.62rem", letterSpacing: "0.04em" }}
                    >
                      {cell.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chase cards */}
            {result.chase_cards.length > 0 && (
              <section className="ar-zone" style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}>
                <div className="ar-zone-head">
                  <span>Top Chase Cards</span>
                  <span className="text-ink-faint">By nonfoil market price</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-3">
                  {result.chase_cards.map((card, i) => (
                    <ChaseCardTile key={`${card.name}-${i}`} card={card} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* Disclaimer */}
            <div
              className="p-3 font-mono"
              style={{
                background: "var(--yellow-mute)",
                border: "1px solid rgba(251,219,101,0.35)",
                color: "var(--yellow)",
                fontSize: "0.74rem",
              }}
            >
              <span
                className="font-semibold uppercase"
                style={{ letterSpacing: "0.16em", fontSize: "0.62rem" }}
              >
                Heads Up
              </span>
              <span className="ml-2 text-ink-soft" style={{ letterSpacing: "0.02em" }}>
                {result.disclaimer}
              </span>
            </div>
          </div>
        )}
      </FeatureGate>
    </div>
  );
}

/* ---------- helpers ---------- */

function ChaseCardTile({ card, rank }: { card: ChaseCard; rank: number }) {
  return (
    <div
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule-hi)",
        overflow: "hidden",
      }}
    >
      <div
        className="relative"
        style={{
          aspectRatio: "5/7",
          background: "linear-gradient(180deg,var(--panel-hi),var(--panel))",
        }}
      >
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.55rem", letterSpacing: "0.18em" }}
          >
            No Image
          </div>
        )}
        <div
          className="absolute font-mono font-semibold tabular-nums"
          style={{
            top: 4,
            left: 4,
            padding: "1px 6px",
            background: "var(--void)",
            color: "var(--ink)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.62rem",
            letterSpacing: "0.04em",
          }}
        >
          #{rank}
        </div>
        {card.rarity === "mythic" && (
          <div
            className="absolute font-mono uppercase font-semibold"
            style={{
              top: 4,
              right: 4,
              padding: "1px 6px",
              background: "var(--orange)",
              color: "var(--void)",
              fontSize: "0.55rem",
              letterSpacing: "0.18em",
            }}
          >
            Mythic
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <div
          className="font-display text-ink truncate"
          style={{ fontSize: "0.78rem", fontWeight: 500, letterSpacing: "0.005em" }}
          title={card.name}
        >
          {card.name}
        </div>
        <div className="flex items-baseline justify-between gap-1 tabular-nums">
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--orange)", fontSize: "0.86rem", letterSpacing: "0.02em" }}
          >
            ${card.price_usd.toFixed(2)}
          </span>
          {card.price_foil_usd > 0 && (
            <span
              className="font-mono"
              style={{ color: "var(--yellow)", fontSize: "0.62rem", letterSpacing: "0.04em" }}
            >
              ✦${card.price_foil_usd.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
