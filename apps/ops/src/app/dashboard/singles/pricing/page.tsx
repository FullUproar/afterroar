"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCents } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { calculateSellPrice, type Condition } from "@/lib/tcg-pricing";

/* ---------- types ---------- */

interface PricingItem {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  quantity: number;
  image_url: string | null;
  game: string | null;
  set_name: string | null;
  set_code: string | null;
  condition: string;
  foil: boolean;
  scryfall_id: string | null;
  market_price_cents: number | null;
  new_price_cents: number;
}

type GameFilter = "All" | "MTG" | "Pokemon" | "Lorcana" | "Yu-Gi-Oh";
const GAME_OPTIONS: GameFilter[] = ["All", "MTG", "Pokemon", "Lorcana", "Yu-Gi-Oh"];

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ---------- component ---------- */

export default function BulkPricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ count: number } | null>(null);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Pricing strategy
  const [markupPercent, setMarkupPercent] = useState(130);
  const [gameFilter, setGameFilter] = useState<GameFilter>("All");
  const [conditionFilter, setConditionFilter] = useState("All");

  const fetchAndCompute = useCallback(async () => {
    setLoading(true);
    setError("");
    setApplied(null);

    try {
      const params = new URLSearchParams();
      if (gameFilter !== "All") params.set("game", gameFilter);
      if (conditionFilter !== "All") params.set("condition", conditionFilter);
      params.set("sort", "price");
      params.set("dir", "desc");
      params.set("limit", "100");
      params.set("stats", "false");

      const res = await fetch(`/api/singles?${params}`);
      if (!res.ok) throw new Error("Failed to load singles");
      const data = await res.json();

      const computed: PricingItem[] = data.items.map(
        (item: Record<string, unknown>) => {
          const attrs = (item.attributes ?? {}) as Record<string, unknown>;
          const scryfallId = (attrs.scryfall_id as string) || null;

          const marketCents = (item.price_cents as number) || 0;

          const condition = ((item.condition as string) || "NM") as Condition;
          const foil = (item.foil as boolean) || false;

          const newPrice = calculateSellPrice({
            marketPriceCents: marketCents,
            condition,
            isFoil: foil,
            markupPercent,
          });

          return {
            id: item.id as string,
            name: item.name as string,
            price_cents: item.price_cents as number,
            cost_cents: item.cost_cents as number,
            quantity: item.quantity as number,
            image_url: item.image_url as string | null,
            game: item.game as string | null,
            set_name: item.set_name as string | null,
            set_code: item.set_code as string | null,
            condition,
            foil,
            scryfall_id: scryfallId,
            market_price_cents: marketCents,
            new_price_cents: newPrice,
          };
        }
      );

      setItems(computed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [gameFilter, conditionFilter, markupPercent]);

  // Fetch market prices from Scryfall
  const [fetchingMarket, setFetchingMarket] = useState(false);

  async function fetchMarketPrices() {
    if (items.length === 0) return;
    setFetchingMarket(true);

    try {
      const res = await fetch("/api/inventory/price-drift?threshold=0");
      if (!res.ok) return;
      const data = await res.json();

      if (data.items && Array.isArray(data.items)) {
        const marketMap = new Map<string, number>();
        for (const d of data.items) {
          marketMap.set(d.id, d.market_price_cents);
        }

        setItems((prev) =>
          prev.map((item) => {
            const market = marketMap.get(item.id);
            if (market) {
              const newPrice = calculateSellPrice({
                marketPriceCents: market,
                condition: item.condition as Condition,
                isFoil: item.foil,
                markupPercent,
              });
              return {
                ...item,
                market_price_cents: market,
                new_price_cents: newPrice,
              };
            }
            return item;
          })
        );
      }
    } finally {
      setFetchingMarket(false);
    }
  }

  useEffect(() => {
    fetchAndCompute();
  }, [fetchAndCompute]);

  useEffect(() => {
    if (items.length === 0) return;
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        new_price_cents: calculateSellPrice({
          marketPriceCents: item.market_price_cents || item.price_cents,
          condition: item.condition as Condition,
          isFoil: item.foil,
          markupPercent,
        }),
      }))
    );
  }, [markupPercent]); // eslint-disable-line react-hooks/exhaustive-deps

  const changedItems = items.filter(
    (i) => i.new_price_cents !== i.price_cents
  );
  const significantChanges = changedItems.filter((i) => {
    const pctChange =
      i.price_cents > 0
        ? Math.abs(i.new_price_cents - i.price_cents) / i.price_cents
        : 1;
    return pctChange > 0.2;
  });

  async function applyAll() {
    if (changedItems.length === 0) return;
    setApplying(true);
    setError("");

    try {
      const updates = changedItems.map((i) => ({
        item_id: i.id,
        new_price_cents: i.new_price_cents,
      }));

      const res = await fetch("/api/singles/bulk-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to apply prices");
      }

      const result = await res.json();
      setApplied({ count: result.updated });

      setItems((prev) =>
        prev.map((i) => {
          const changed = changedItems.find((c) => c.id === i.id);
          if (changed) {
            return { ...i, price_cents: changed.new_price_cents };
          }
          return i;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  function exportPreview() {
    if (changedItems.length === 0) return;
    const header = "Card Name,Current Price,Market Price,New Price,Change %";
    const rows = changedItems.map((i) => {
      const pctChange =
        i.price_cents > 0
          ? (
              ((i.new_price_cents - i.price_cents) / i.price_cents) *
              100
            ).toFixed(1)
          : "N/A";
      return `"${i.name}","${(i.price_cents / 100).toFixed(2)}","${((i.market_price_cents || 0) / 100).toFixed(2)}","${(i.new_price_cents / 100).toFixed(2)}","${pctChange}%"`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `price-update-preview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalCents = items.reduce((s, i) => s + i.new_price_cents, 0);
  const currentTotalCents = items.reduce((s, i) => s + i.price_cents, 0);
  const deltaCents = totalCents - currentTotalCents;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <PageHeader
        title="Bulk Pricing"
        crumb="TCG · Pricing"
        desc="Re-price your singles against market mid with a markup multiplier. Preview before apply."
        backHref="/dashboard/singles"
      />

      {error && (
        <div
          className="px-4 py-3 font-mono flex items-center gap-3"
          style={{
            background: "var(--red-mute)",
            border: "1px solid var(--red)",
            color: "var(--red)",
            fontSize: "0.78rem",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto font-mono uppercase text-ink-soft hover:text-ink transition-colors"
            style={{ fontSize: "0.62rem", letterSpacing: "0.16em" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {applied && (
        <div
          className="px-4 py-3 font-mono"
          style={{
            background: "var(--teal-mute)",
            border: "1px solid var(--teal)",
            color: "var(--teal)",
            fontSize: "0.78rem",
          }}
        >
          {applied.count} item{applied.count !== 1 ? "s" : ""} updated successfully.
        </div>
      )}

      {/* Stat strip */}
      <div
        className="grid grid-cols-2 md:grid-cols-5"
        style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
      >
        {[
          { k: "Items", v: items.length.toLocaleString() },
          { k: "Will Change", v: changedItems.length.toLocaleString(), tone: changedItems.length > 0 ? "var(--orange)" : undefined },
          { k: "Big Swings", v: significantChanges.length.toLocaleString(), tone: significantChanges.length > 0 ? "var(--yellow)" : undefined, sub: ">20%" },
          { k: "Markup", v: `${markupPercent}%` },
          { k: "Net Change", v: `${deltaCents >= 0 ? "+" : ""}${formatCents(deltaCents)}`, tone: deltaCents > 0 ? "var(--teal)" : deltaCents < 0 ? "var(--red)" : undefined },
        ].map((cell) => (
          <div key={cell.k} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
            <div
              className="font-mono uppercase font-semibold text-ink-faint"
              style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
            >
              {cell.k}{cell.sub ? ` · ${cell.sub}` : ""}
            </div>
            <div
              className="font-mono font-semibold mt-1 tabular-nums"
              style={{
                fontSize: "0.95rem",
                letterSpacing: "0.02em",
                color: cell.tone || "var(--ink)",
              }}
            >
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      {/* Pricing Strategy */}
      <div
        className="p-4 space-y-4"
        style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
      >
        <div
          className="font-mono uppercase font-semibold text-ink-faint flex items-center gap-2"
          style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: "currentColor",
              clipPath:
                "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
            }}
          />
          Pricing Strategy
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono uppercase text-ink-soft"
            style={{ fontSize: "0.66rem", letterSpacing: "0.16em" }}
          >
            Market Mid ×
          </span>
          <div className="relative">
            <input
              type="number"
              min="50"
              max="300"
              step="5"
              value={markupPercent}
              onChange={(e) =>
                setMarkupPercent(
                  Math.max(50, Math.min(300, parseInt(e.target.value, 10) || 100))
                )
              }
              onKeyDown={(e) => e.stopPropagation()}
              className="font-mono text-ink text-center tabular-nums focus:outline-none"
              style={{
                width: 96,
                background: "var(--panel)",
                border: "1px solid var(--rule-hi)",
                fontSize: "0.95rem",
                padding: "0 1.4rem 0 0.5rem",
                minHeight: 44,
              }}
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-ink-faint"
              style={{ fontSize: "0.66rem" }}
            >
              %
            </span>
          </div>
          <span
            className="font-mono text-ink-faint"
            style={{ fontSize: "0.7rem", letterSpacing: "0.02em" }}
          >
            sell at {markupPercent}% of market
          </span>
          <button
            onClick={fetchMarketPrices}
            disabled={fetchingMarket || items.length === 0}
            className="ml-auto font-mono uppercase font-semibold transition-colors disabled:opacity-50"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.16em",
              padding: "0 0.85rem",
              minHeight: 44,
              background: "var(--orange-mute)",
              border: "1px solid var(--orange)",
              color: "var(--orange)",
            }}
          >
            {fetchingMarket ? (
              <span className="flex items-center gap-1.5">
                <Spinner size={12} />
                Refreshing…
              </span>
            ) : "Refresh Market Prices"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className="font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.6rem", letterSpacing: "0.18em" }}
          >
            Filter
          </label>
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value as GameFilter)}
            className="font-mono text-ink focus:outline-none"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--rule-hi)",
              fontSize: "0.78rem",
              padding: "0 0.7rem",
              minHeight: 40,
            }}
          >
            {GAME_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="font-mono text-ink focus:outline-none"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--rule-hi)",
              fontSize: "0.78rem",
              padding: "0 0.7rem",
              minHeight: 40,
            }}
          >
            <option value="All">All Conditions</option>
            <option value="NM">NM</option>
            <option value="LP">LP</option>
            <option value="MP">MP</option>
            <option value="HP">HP</option>
            <option value="DMG">DMG</option>
          </select>
        </div>
      </div>

      {/* Preview */}
      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-12 font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
        >
          <Spinner />
          Loading singles…
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-12 font-mono text-ink-soft"
          style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.78rem" }}
        >
          No singles match the current filters.
        </div>
      ) : (
        <>
          {/* Listings — operator console rich rows */}
          <section className="ar-zone" style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}>
            <div className="ar-zone-head">
              <span>
                Preview · <b style={{ color: "var(--ink)" }}>{changedItems.length}</b> of {items.length} will change
              </span>
              {significantChanges.length > 0 && (
                <span style={{ color: "var(--yellow)" }}>
                  {significantChanges.length} {">"}20% swing
                </span>
              )}
            </div>

            {/* Column header — desktop only */}
            <div
              className="hidden md:grid items-center px-4 py-2"
              style={{
                gridTemplateColumns: "1fr 90px 90px 90px 80px",
                gap: "0.85rem",
                background: "var(--panel-mute)",
                borderBottom: "1px solid var(--rule)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              {["Card", "Current", "Market", "New Price", "Change"].map((h, idx) => (
                <div
                  key={h}
                  className="font-mono uppercase font-semibold text-ink-faint"
                  style={{
                    fontSize: "0.55rem",
                    letterSpacing: "0.22em",
                    textAlign: idx === 0 ? "left" : "right",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            <div className="ar-stagger flex flex-col">
              {items.map((item) => {
                const pctChange =
                  item.price_cents > 0
                    ? (
                        ((item.new_price_cents - item.price_cents) /
                          item.price_cents) *
                        100
                      ).toFixed(1)
                    : "N/A";
                const isSignificant =
                  item.price_cents > 0 &&
                  Math.abs(item.new_price_cents - item.price_cents) /
                    item.price_cents >
                    0.2;
                const isChanged = item.new_price_cents !== item.price_cents;
                const isUp = item.new_price_cents > item.price_cents;

                return (
                  <div
                    key={item.id}
                    className="px-4 py-2.5"
                    style={{
                      borderBottom: "1px solid var(--rule-faint)",
                      background: isSignificant ? "var(--yellow-mute)" : "transparent",
                    }}
                  >
                    {/* Mobile */}
                    <div className="md:hidden space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-ink truncate" style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                          {item.name}
                        </span>
                        {isSignificant && (
                          <span
                            className="font-mono uppercase font-semibold shrink-0"
                            style={{
                              padding: "1px 6px",
                              fontSize: "0.55rem",
                              letterSpacing: "0.16em",
                              color: "var(--yellow)",
                              background: "var(--yellow-mute)",
                              border: "1px solid rgba(251,219,101,0.4)",
                            }}
                          >
                            Big Swing
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-3 font-mono tabular-nums text-ink-faint flex-wrap"
                        style={{ fontSize: "0.66rem" }}
                      >
                        <span>Now {formatCents(item.price_cents)}</span>
                        <span>Mkt {formatCents(item.market_price_cents || 0)}</span>
                        <span style={{ color: isChanged ? "var(--orange)" : "var(--ink-faint)", fontWeight: 600 }}>
                          New {formatCents(item.new_price_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div
                      className="hidden md:grid items-center"
                      style={{ gridTemplateColumns: "1fr 90px 90px 90px 80px", gap: "0.85rem" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-display text-ink truncate" style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                          {item.name}
                        </span>
                        <span
                          className="font-mono uppercase shrink-0 text-ink-faint"
                          style={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.16em",
                            padding: "1px 6px",
                            background: "var(--panel)",
                            border: "1px solid var(--rule-hi)",
                          }}
                        >
                          {item.condition}{item.foil ? " · F" : ""}
                        </span>
                        {isSignificant && (
                          <span
                            aria-label="Big swing"
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--yellow)",
                              boxShadow: "0 0 4px var(--yellow)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        className="text-right font-mono tabular-nums text-ink-faint"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {formatCents(item.price_cents)}
                      </div>
                      <div
                        className="text-right font-mono tabular-nums text-ink-faint"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {formatCents(item.market_price_cents || 0)}
                      </div>
                      <div
                        className="text-right font-mono font-semibold tabular-nums"
                        style={{
                          fontSize: "0.92rem",
                          color: isChanged ? "var(--orange)" : "var(--ink-faint)",
                        }}
                      >
                        {formatCents(item.new_price_cents)}
                      </div>
                      <div
                        className="text-right font-mono tabular-nums"
                        style={{
                          fontSize: "0.7rem",
                          letterSpacing: "0.02em",
                          fontWeight: 600,
                          color: isSignificant
                            ? "var(--yellow)"
                            : isChanged
                              ? isUp ? "var(--teal)" : "var(--red)"
                              : "var(--ink-faint)",
                        }}
                      >
                        {typeof pctChange === "string" && pctChange !== "N/A"
                          ? `${parseFloat(pctChange) > 0 ? "+" : ""}${pctChange}%`
                          : pctChange}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={applying || changedItems.length === 0}
              className="flex-1 md:flex-none font-display uppercase transition-opacity disabled:opacity-40"
              style={{
                padding: "0 1.5rem",
                minHeight: 56,
                background: "var(--orange)",
                color: "var(--void)",
                letterSpacing: "0.06em",
                fontWeight: 600,
                fontSize: "0.95rem",
                border: "1px solid var(--orange)",
              }}
            >
              {applying ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size={16} />
                  Applying…
                </span>
              ) : `Apply ${changedItems.length} Price${changedItems.length !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={exportPreview}
              disabled={changedItems.length === 0}
              className="font-mono uppercase font-semibold transition-colors disabled:opacity-40"
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                padding: "0 1.2rem",
                minHeight: 56,
                background: "var(--panel)",
                border: "1px solid var(--rule-hi)",
                color: "var(--ink-soft)",
              }}
            >
              Export Preview
            </button>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "var(--overlay-bg)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm shadow-2xl"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--rule-hi)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5"
              style={{
                background: "var(--slate)",
                borderBottom: "1px solid var(--rule)",
                minHeight: 56,
              }}
            >
              <div>
                <div
                  className="font-mono uppercase font-semibold text-ink-faint"
                  style={{ fontSize: "0.55rem", letterSpacing: "0.28em" }}
                >
                  Pricing · Confirm
                </div>
                <div
                  className="font-display text-ink mt-0.5"
                  style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.005em", lineHeight: 1 }}
                >
                  Apply Price Changes?
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p
                className="font-mono text-ink-soft"
                style={{ fontSize: "0.78rem", letterSpacing: "0.02em" }}
              >
                This will update prices for{" "}
                <span className="font-semibold text-ink">
                  {changedItems.length} item{changedItems.length !== 1 ? "s" : ""}
                </span>
                .
              </p>
              {(() => {
                const totalChange = changedItems.reduce(
                  (sum, i) => sum + (i.new_price_cents - i.price_cents),
                  0
                );
                const avgChange =
                  changedItems.length > 0
                    ? totalChange / changedItems.length
                    : 0;
                return (
                  <div
                    className="p-3 space-y-1"
                    style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
                  >
                    <div className="flex justify-between font-mono" style={{ fontSize: "0.78rem" }}>
                      <span className="uppercase text-ink-faint" style={{ letterSpacing: "0.16em", fontSize: "0.62rem" }}>Items Changing</span>
                      <span className="text-ink font-semibold tabular-nums">{changedItems.length}</span>
                    </div>
                    <div className="flex justify-between font-mono" style={{ fontSize: "0.78rem" }}>
                      <span className="uppercase text-ink-faint" style={{ letterSpacing: "0.16em", fontSize: "0.62rem" }}>Avg Change</span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{
                          color: avgChange > 0
                            ? "var(--teal)"
                            : avgChange < 0
                              ? "var(--red)"
                              : "var(--ink)",
                        }}
                      >
                        {avgChange > 0 ? "+" : ""}{formatCents(Math.round(avgChange))}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2" style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="font-display uppercase transition-colors"
                  style={{
                    minHeight: 56,
                    background: "var(--panel)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.06em",
                    fontWeight: 500,
                    fontSize: "0.92rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    applyAll();
                  }}
                  disabled={applying}
                  className="font-display uppercase transition-colors disabled:opacity-50"
                  style={{
                    minHeight: 56,
                    background: "var(--orange)",
                    color: "var(--void)",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  {applying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size={16} />
                      Applying…
                    </span>
                  ) : "Apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
