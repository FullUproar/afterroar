"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FeatureGate } from "@/components/feature-gate";
import { formatCents } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface DeckCard {
  name: string;
  mana_cost: string | null;
  type_line: string;
  image_url: string | null;
  price_cents: number | null;
  set_name: string | null;
  rarity: string | null;
}

interface ParsedCard {
  quantity: number;
  name: string;
}

interface InventoryMatch {
  name: string;
  needed: number;
  in_stock: number;
  price_cents: number;
  inventory_item_id: string | null;
  image_url: string | null;
  status: "available" | "partial" | "unavailable";
}

interface MetaDeck {
  name: string;
  format: string;
  searchQuery: string;
}

/* ------------------------------------------------------------------ */
/*  Formats                                                             */
/* ------------------------------------------------------------------ */

const FORMATS = [
  { key: "standard", label: "Standard" },
  { key: "modern", label: "Modern" },
  { key: "pioneer", label: "Pioneer" },
  { key: "commander", label: "Commander" },
  { key: "other", label: "Other" },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

function DeckBuilderContent() {
  const router = useRouter();

  // State
  const [format, setFormat] = useState("standard");
  const [searchQuery, setSearchQuery] = useState("");
  const [decklistText, setDecklistText] = useState("");
  const [searchResults, setSearchResults] = useState<DeckCard[]>([]);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [inventoryResults, setInventoryResults] = useState<InventoryMatch[]>([]);
  const [metaDecks, setMetaDecks] = useState<MetaDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "paste">("search");

  // Fetch meta deck suggestions when format changes
  const loadSuggestions = useCallback(async (fmt: string) => {
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", format: fmt }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetaDecks(data.decks ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load suggestions on format change
  const handleFormatChange = useCallback(
    (fmt: string) => {
      setFormat(fmt);
      setSearchResults([]);
      setInventoryResults([]);
      setParsedCards([]);
      loadSuggestions(fmt);
    },
    [loadSuggestions],
  );

  // Initial load
  useState(() => {
    loadSuggestions("standard");
  });

  // Search Scryfall for cards
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setInventoryResults([]);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: searchQuery.trim(),
          format: format !== "other" ? format : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.cards ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Search from a meta deck suggestion
  async function handleMetaDeckSearch(deck: MetaDeck) {
    setSearchQuery(deck.searchQuery);
    setLoading(true);
    setInventoryResults([]);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query: deck.searchQuery,
          format: format !== "other" ? format : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.cards ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Parse pasted decklist text
  async function handleParseDeck() {
    if (!decklistText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", decklist: decklistText }),
      });
      if (res.ok) {
        const data = await res.json();
        const cards: ParsedCard[] = data.cards ?? [];
        setParsedCards(cards);
        // Automatically check inventory
        if (cards.length > 0) {
          await checkInventory(cards);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Add search results to parsed list and check inventory
  async function handleCheckSearchResults() {
    if (searchResults.length === 0) return;
    const cards: ParsedCard[] = searchResults.map((c) => ({
      quantity: 1,
      name: c.name,
    }));
    setParsedCards(cards);
    await checkInventory(cards);
  }

  // Match cards against store inventory
  async function checkInventory(cards: ParsedCard[]) {
    setMatchLoading(true);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "match", cards }),
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryResults(data.results ?? []);
      }
    } catch {
      // ignore
    } finally {
      setMatchLoading(false);
    }
  }

  // Add a single card to register cart via localStorage
  function addToCart(match: InventoryMatch) {
    if (!match.inventory_item_id || match.in_stock <= 0) return;
    const qty = Math.min(match.needed, match.in_stock);
    const existing = getDeckBuilderCart();
    const idx = existing.findIndex(
      (c) => c.inventory_item_id === match.inventory_item_id,
    );
    if (idx >= 0) {
      existing[idx].quantity += qty;
    } else {
      existing.push({
        inventory_item_id: match.inventory_item_id,
        name: match.name,
        price_cents: match.price_cents,
        quantity: qty,
        image_url: match.image_url,
      });
    }
    localStorage.setItem("deck-builder-cart", JSON.stringify(existing));
  }

  // Add all available to register cart and navigate
  function addAllToCart() {
    const items = inventoryResults
      .filter((m) => m.status !== "unavailable" && m.inventory_item_id)
      .map((m) => ({
        inventory_item_id: m.inventory_item_id,
        name: m.name,
        price_cents: m.price_cents,
        quantity: Math.min(m.needed, m.in_stock),
        image_url: m.image_url,
      }));

    if (items.length === 0) return;
    localStorage.setItem("deck-builder-cart", JSON.stringify(items));
    router.push("/dashboard/register");
  }

  // Summary stats
  const totalCards = inventoryResults.reduce((s, m) => s + m.needed, 0);
  const inStockCards = inventoryResults.reduce(
    (s, m) => s + Math.min(m.needed, m.in_stock),
    0,
  );
  const needToOrder = totalCards - inStockCards;
  const estimatedTotal = inventoryResults
    .filter((m) => m.status !== "unavailable")
    .reduce((s, m) => s + m.price_cents * Math.min(m.needed, m.in_stock), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Deck Builder" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---- Left Panel: Deck Building ---- */}
        <div className="space-y-4">
          {/* Format selector */}
          <div>
            <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-2">
              Format
            </label>
            <div className="flex gap-1 bg-card-hover rounded-xl p-1">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => handleFormatChange(f.key)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    format === f.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                  style={{ minHeight: "auto" }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Meta deck suggestions */}
          {metaDecks.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                Popular Archetypes
              </label>
              <div className="flex flex-wrap gap-2">
                {metaDecks.map((deck) => (
                  <button
                    key={deck.name}
                    onClick={() => handleMetaDeckSearch(deck)}
                    className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-card-hover hover:border-accent/50 transition-colors"
                    style={{ minHeight: "auto" }}
                  >
                    {deck.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Search vs Paste */}
          <div className="flex gap-1 bg-card-hover rounded-xl p-1">
            <button
              onClick={() => setActiveTab("search")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === "search"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              style={{ minHeight: "auto" }}
            >
              Search Cards
            </button>
            <button
              onClick={() => setActiveTab("paste")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === "paste"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
              style={{ minHeight: "auto" }}
            >
              Paste Decklist
            </button>
          </div>

          {activeTab === "search" ? (
            <div className="space-y-3">
              {/* Search input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  placeholder="Search cards (e.g. red creature cmc<=3)..."
                  className="flex-1 rounded-xl border border-input-border bg-input-bg px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  style={{ fontSize: 16 }}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !searchQuery.trim()}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {loading ? "..." : "Search"}
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">
                      {searchResults.length} cards found
                    </span>
                    <button
                      onClick={handleCheckSearchResults}
                      disabled={matchLoading}
                      className="rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/30 transition-colors"
                      style={{ minHeight: "auto" }}
                    >
                      {matchLoading ? "Checking..." : "Check Inventory"}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-1.5 rounded-xl border border-card-border bg-card p-2">
                    {searchResults.map((card, i) => (
                      <div
                        key={`${card.name}-${i}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-card-hover transition-colors"
                      >
                        {card.image_url && (
                          <div className="shrink-0 w-[40px] h-[56px] rounded overflow-hidden bg-card-hover">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={card.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {card.name}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {card.type_line}
                            {card.mana_cost && (
                              <span className="ml-2 opacity-70">
                                {card.mana_cost}
                              </span>
                            )}
                          </div>
                        </div>
                        {card.price_cents != null && (
                          <div className="shrink-0 text-sm font-mono tabular-nums text-foreground">
                            {formatCents(card.price_cents)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Paste decklist */}
              <textarea
                value={decklistText}
                onChange={(e) => setDecklistText(e.target.value)}
                placeholder={`Paste decklist here:\n\n4 Lightning Bolt\n4 Monastery Swiftspear\n2 Embercleave\n20 Mountain`}
                rows={12}
                className="w-full rounded-xl border border-input-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none font-mono text-sm"
              />
              <button
                onClick={handleParseDeck}
                disabled={loading || !decklistText.trim()}
                className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading ? "Parsing..." : "Parse & Check Inventory"}
              </button>

              {/* Parsed cards preview */}
              {parsedCards.length > 0 && !inventoryResults.length && (
                <div className="rounded-xl border border-card-border bg-card p-3">
                  <div className="text-sm font-semibold text-muted mb-2">
                    Parsed: {parsedCards.length} unique cards,{" "}
                    {parsedCards.reduce((s, c) => s + c.quantity, 0)} total
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {parsedCards.map((c, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm text-foreground px-2 py-1"
                      >
                        <span>{c.name}</span>
                        <span className="text-muted font-mono">
                          x{c.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Right Panel: Inventory Match Results ---- */}
        <div className="space-y-4">
          {matchLoading && (
            <div className="flex items-center justify-center h-32 text-muted">
              Checking store inventory...
            </div>
          )}

          {inventoryResults.length > 0 && (
            <>
              <div className="text-sm font-semibold text-muted uppercase tracking-wider">
                Inventory Match
              </div>

              <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                {inventoryResults.map((match, i) => (
                  <div
                    key={`${match.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-3 py-2.5"
                  >
                    {/* Card image */}
                    <div className="shrink-0 w-[40px] h-[56px] rounded overflow-hidden bg-card-hover border border-card-border/50">
                      {match.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={match.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
                          TCG
                        </div>
                      )}
                    </div>

                    {/* Card info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {match.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <StatusBadge match={match} />
                        <span className="text-muted">
                          Need {match.needed} / Have {match.in_stock}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    {match.price_cents > 0 && (
                      <div className="shrink-0 text-sm font-mono tabular-nums text-foreground">
                        {formatCents(match.price_cents)}
                      </div>
                    )}

                    {/* Add to cart */}
                    {match.status !== "unavailable" && match.inventory_item_id && (
                      <button
                        onClick={() => addToCart(match)}
                        className="shrink-0 rounded-lg bg-green-600/20 px-2.5 py-1 text-xs font-medium text-green-400 hover:bg-green-600/30 transition-colors"
                        style={{ minHeight: "auto" }}
                        title="Add to cart"
                      >
                        + Cart
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-card-border bg-card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total cards needed</span>
                  <span className="text-foreground font-medium">
                    {totalCards}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">In stock</span>
                  <span className="text-green-400 font-medium">
                    {inStockCards}
                  </span>
                </div>
                {needToOrder > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Need to order</span>
                    <span className="text-red-400 font-medium">
                      {needToOrder}
                    </span>
                  </div>
                )}
                <div className="border-t border-card-border my-2" />
                <div className="flex justify-between text-base">
                  <span className="text-muted">Estimated total (in stock)</span>
                  <span className="text-foreground font-bold font-mono tabular-nums">
                    {formatCents(estimatedTotal)}
                  </span>
                </div>

                <button
                  onClick={addAllToCart}
                  disabled={inStockCards === 0}
                  className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity mt-2"
                >
                  Add All Available to Cart ({inStockCards} cards)
                </button>
              </div>
            </>
          )}

          {!matchLoading && inventoryResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-muted text-center px-4">
              <div className="text-4xl mb-3">{"\u2660"}</div>
              <div className="text-base font-medium mb-1">
                Deck Builder
              </div>
              <div className="text-sm">
                Search for cards or paste a decklist to check your store inventory.
                Results will appear here with stock availability and pricing.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                        */
/* ------------------------------------------------------------------ */

function StatusBadge({ match }: { match: InventoryMatch }) {
  if (match.status === "available") {
    return (
      <span className="rounded border bg-green-500/20 text-green-400 border-green-500/30 px-1.5 py-0.5 text-xs font-bold">
        In Stock
      </span>
    );
  }
  if (match.status === "partial") {
    return (
      <span className="rounded border bg-yellow-500/20 text-yellow-400 border-yellow-500/30 px-1.5 py-0.5 text-xs font-bold">
        Partial ({match.in_stock}/{match.needed})
      </span>
    );
  }
  return (
    <span className="rounded border bg-red-500/20 text-red-400 border-red-500/30 px-1.5 py-0.5 text-xs font-bold">
      Not Available
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: get deck-builder cart from localStorage                     */
/* ------------------------------------------------------------------ */

interface DeckBuilderCartItem {
  inventory_item_id: string | null;
  name: string;
  price_cents: number;
  quantity: number;
  image_url: string | null;
}

function getDeckBuilderCart(): DeckBuilderCartItem[] {
  try {
    const raw = localStorage.getItem("deck-builder-cart");
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

/* ------------------------------------------------------------------ */
/*  Page Export — wrapped in FeatureGate                                */
/* ------------------------------------------------------------------ */

export default function DeckBuilderPage() {
  return (
    <FeatureGate module="tcg_engine">
      <DeckBuilderContent />
    </FeatureGate>
  );
}
