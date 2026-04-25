"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ConditionGrader } from "@/components/condition-grader";
import type { Condition } from "@/lib/tcg-pricing";
import { CONDITION_PERCENT } from "@/lib/tcg-pricing";
import type { CatalogCard } from "@/lib/scryfall";

/* ---------- types ---------- */

interface EvalItem {
  key: number;
  name: string;
  set_name: string;
  set_code: string;
  scryfall_id: string;
  image_url: string | null;
  condition: Condition;
  foil: boolean;
  market_price_cents: number;
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ---------- component ---------- */

export default function CardEvaluatorPage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [currentCard, setCurrentCard] = useState<CatalogCard | null>(null);
  const [condition, setCondition] = useState<Condition>("NM");
  const [isFoil, setIsFoil] = useState(false);

  const [items, setItems] = useState<EvalItem[]>([]);
  const nextKey = useRef(1);

  const [exporting, setExporting] = useState(false);

  /* ---- card search (debounced 200ms) ---- */
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      fetch(
        `/api/catalog/scryfall/search?q=${encodeURIComponent(searchQuery)}`
      )
        .then((r) => r.json())
        .then((d) => {
          setSearchResults(d.cards || []);
          setSearchLoading(false);
        })
        .catch(() => setSearchLoading(false));
    }, 200);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  function selectCard(card: CatalogCard) {
    setCurrentCard(card);
    setCondition("NM");
    const cardIsFoil = !card.nonfoil && card.foil;
    setIsFoil(cardIsFoil);
    setSearchQuery("");
    setSearchResults([]);
  }

  function getMarketCents(card: CatalogCard, foil: boolean): number {
    const priceStr = foil ? card.price_usd_foil : card.price_usd;
    return priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
  }

  function addToList() {
    if (!currentCard) return;

    const marketCents = getMarketCents(currentCard, isFoil);
    const condMul = CONDITION_PERCENT[condition] / 100;
    const adjustedMarket = Math.round(marketCents * condMul);

    const item: EvalItem = {
      key: nextKey.current++,
      name: isFoil ? `${currentCard.name} (Foil)` : currentCard.name,
      set_name: currentCard.set_name,
      set_code: currentCard.set_code,
      scryfall_id: currentCard.scryfall_id,
      image_url: currentCard.small_image_url,
      condition,
      foil: isFoil,
      market_price_cents: adjustedMarket,
    };

    setItems((prev) => [item, ...prev]);
    setCurrentCard(null);
    setCondition("NM");
    setIsFoil(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const totalMarketCents = items.reduce((s, i) => s + i.market_price_cents, 0);

  function exportCSV() {
    if (items.length === 0) return;
    setExporting(true);

    const header = "Card Name,Set,Set Code,Condition,Foil,Market Value";
    const rows = items.map(
      (i) =>
        `"${i.name}","${i.set_name}","${i.set_code}","${i.condition}","${i.foil ? "Yes" : "No"}","${(i.market_price_cents / 100).toFixed(2)}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `card-evaluation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  }

  function startTradeIn() {
    const payload = items.map((i) => ({
      name: i.name,
      set_name: i.set_name,
      set_code: i.set_code,
      scryfall_id: i.scryfall_id,
      image_url: i.image_url,
      condition: i.condition,
      foil: i.foil,
      market_price_cents: i.market_price_cents,
    }));
    sessionStorage.setItem("eval_to_tradein", JSON.stringify(payload));
    router.push("/dashboard/trade-ins/bulk");
  }

  function printEvaluation() {
    window.print();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (e.key === "Enter" && searchResults.length > 0) {
      e.preventDefault();
      selectCard(searchResults[0]);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title="Card Evaluator"
        crumb="TCG · Evaluator"
        desc="Quickly value a binder or collection — not a trade-in, just &quot;what's this worth?&quot;"
        backHref="/dashboard/singles"
        action={
          items.length > 0 ? (
            <button
              onClick={() => {
                setItems([]);
                setCurrentCard(null);
              }}
              className="font-mono uppercase font-semibold transition-colors"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.16em",
                padding: "0 0.85rem",
                minHeight: 44,
                background: "var(--panel-mute)",
                border: "1px solid var(--rule-hi)",
                color: "var(--ink-soft)",
              }}
            >
              Clear All
            </button>
          ) : undefined
        }
      />

      {/* Stat strip */}
      {items.length > 0 && (
        <div
          className="grid grid-cols-2"
          style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
        >
          {[
            { k: "Cards Evaluated", v: items.length.toLocaleString() },
            { k: "Total Value", v: formatCents(totalMarketCents), tone: "var(--teal)" },
          ].map((cell) => (
            <div key={cell.k} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
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
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search card name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoFocus
          className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.95rem",
            padding: "0 1rem",
            minHeight: 48,
          }}
        />
        {searchLoading && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 font-mono uppercase text-ink-faint"
            style={{ fontSize: "0.62rem", letterSpacing: "0.16em" }}
          >
            <Spinner />
            Scryfall
          </div>
        )}

        {searchResults.length > 0 && (
          <div
            className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto shadow-xl"
            style={{
              background: "var(--panel-mute)",
              border: "1px solid var(--rule-hi)",
            }}
          >
            {searchResults.map((card) => {
              const priceUsd = card.price_usd ? `$${card.price_usd}` : null;
              const priceFoil = card.price_usd_foil
                ? `$${card.price_usd_foil} foil`
                : null;
              return (
                <button
                  key={card.scryfall_id}
                  onClick={() => selectCard(card)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-panel"
                  style={{ borderBottom: "1px solid var(--rule-faint)", minHeight: 56 }}
                >
                  {card.small_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.small_image_url}
                      alt=""
                      className="object-cover shrink-0"
                      style={{ width: 32, height: 44, border: "1px solid var(--rule-hi)" }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-ink truncate" style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                      {card.name}
                    </div>
                    <div className="font-mono text-ink-faint truncate mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                      {card.set_name} · {card.set_code}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {priceUsd && (
                      <div className="font-mono font-semibold text-ink tabular-nums" style={{ fontSize: "0.78rem" }}>
                        {priceUsd}
                      </div>
                    )}
                    {priceFoil && (
                      <div className="font-mono tabular-nums" style={{ fontSize: "0.66rem", color: "var(--yellow)" }}>
                        {priceFoil}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Current card grading */}
      {currentCard && (
        <div
          className="p-4 space-y-4"
          style={{
            background: "var(--panel-mute)",
            border: "1px solid var(--orange)",
            boxShadow: "0 0 18px var(--orange-mute)",
          }}
        >
          <div className="flex items-start gap-4">
            {currentCard.small_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentCard.small_image_url}
                alt={currentCard.name}
                className="shrink-0 object-cover"
                style={{ width: 64, height: 88, border: "1px solid var(--rule-hi)" }}
              />
            )}
            <div className="min-w-0 flex-1">
              <h3
                className="font-display text-ink"
                style={{ fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.1, letterSpacing: "0.005em" }}
              >
                {currentCard.name}
              </h3>
              <p className="font-mono text-ink-faint mt-1" style={{ fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                {currentCard.set_name} · {currentCard.set_code}
              </p>
              <p className="font-mono text-ink-soft mt-2 tabular-nums" style={{ fontSize: "0.78rem" }}>
                Market:{" "}
                <span className="font-semibold text-ink">
                  {formatCents(getMarketCents(currentCard, isFoil))}
                </span>
                {condition !== "NM" && (
                  <span className="ml-3 text-ink-faint">
                    {condition}: {formatCents(Math.round(getMarketCents(currentCard, isFoil) * CONDITION_PERCENT[condition] / 100))}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div>
            <label
              className="block font-mono uppercase font-semibold text-ink-faint mb-2"
              style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
            >
              Condition
            </label>
            <ConditionGrader value={condition} onChange={setCondition} size="large" />
          </div>

          <div>
            <label
              className="block font-mono uppercase font-semibold text-ink-faint mb-2"
              style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
            >
              Foil
            </label>
            <div className="grid grid-cols-2" style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}>
              <button
                type="button"
                onClick={() => setIsFoil(false)}
                className="font-mono uppercase font-semibold transition-colors"
                style={{
                  minHeight: 48,
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  background: !isFoil ? "var(--panel)" : "var(--panel-mute)",
                  color: !isFoil ? "var(--ink)" : "var(--ink-soft)",
                  borderTop: !isFoil ? "2px solid var(--ink)" : "2px solid transparent",
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setIsFoil(true)}
                className="font-mono uppercase font-semibold transition-colors"
                style={{
                  minHeight: 48,
                  fontSize: "0.7rem",
                  letterSpacing: "0.18em",
                  background: isFoil ? "var(--yellow-mute)" : "var(--panel-mute)",
                  color: isFoil ? "var(--yellow)" : "var(--ink-soft)",
                  borderTop: isFoil ? "2px solid var(--yellow)" : "2px solid transparent",
                }}
              >
                Foil
              </button>
            </div>
          </div>

          <button
            onClick={addToList}
            className="w-full font-display uppercase transition-colors"
            style={{
              minHeight: 56,
              background: "var(--orange)",
              color: "var(--void)",
              letterSpacing: "0.06em",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "1px solid var(--orange)",
            }}
          >
            Add to Evaluation
          </button>
        </div>
      )}

      {/* Items List */}
      {items.length > 0 && (
        <section className="ar-zone" style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}>
          <div className="ar-zone-head">
            <span>Evaluation · <b style={{ color: "var(--ink)" }}>{items.length} cards</b></span>
            <span className="text-ink-faint">Newest first</span>
          </div>
          <div className="ar-stagger flex flex-col">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 px-3 py-2"
                style={{ borderBottom: "1px solid var(--rule-faint)", minHeight: 56 }}
              >
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="shrink-0 object-cover"
                    style={{ width: 32, height: 44, border: "1px solid var(--rule-hi)" }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-ink truncate" style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                    {item.name}
                  </div>
                  <div className="font-mono text-ink-faint mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                    {item.set_code} · {item.condition}
                    {item.foil && " · Foil"}
                  </div>
                </div>
                <div
                  className="font-mono font-semibold text-ink tabular-nums shrink-0"
                  style={{ fontSize: "0.92rem", letterSpacing: "0.02em" }}
                >
                  {formatCents(item.market_price_cents)}
                </div>
                <button
                  onClick={() => removeItem(item.key)}
                  aria-label="Remove"
                  className="shrink-0 transition-colors hover:text-red-fu"
                  style={{
                    width: 36,
                    height: 36,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-faint)",
                    border: "1px solid var(--rule-hi)",
                    background: "var(--panel)",
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action Buttons */}
      {items.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={startTradeIn}
            className="w-full font-display uppercase transition-colors"
            style={{
              minHeight: 56,
              background: "var(--teal)",
              color: "var(--void)",
              letterSpacing: "0.06em",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "1px solid var(--teal)",
            }}
          >
            Start Trade-In with These Cards
          </button>
          <div className="grid grid-cols-2" style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}>
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="font-mono uppercase font-semibold transition-colors disabled:opacity-50"
              style={{
                minHeight: 48,
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                background: "var(--panel)",
                color: "var(--ink-soft)",
              }}
            >
              Export CSV
            </button>
            <button
              onClick={printEvaluation}
              className="font-mono uppercase font-semibold transition-colors"
              style={{
                minHeight: 48,
                fontSize: "0.7rem",
                letterSpacing: "0.18em",
                background: "var(--panel)",
                color: "var(--ink-soft)",
              }}
            >
              Print
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
