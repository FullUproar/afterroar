"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FeatureGate } from "@/components/feature-gate";
import { SubNav } from "@/components/ui/sub-nav";
import { CardImage, PriceTag } from "@/components/tcg/shared";
import { FormatSelector } from "@/components/deck-builder/format-selector";
import { InventoryCard } from "@/components/deck-builder/inventory-card";
import { DeckSummary } from "@/components/deck-builder/deck-summary";
import { AnalysisPanel } from "@/components/deck-builder/analysis-panel";
import { ColorPips } from "@/components/deck-builder/color-pips";
import type { DeckAnalysis } from "@/lib/deck-analysis";
import { Recommendations as RecommendationsPanel } from "@/components/deck-builder/recommendations";
import { MetaArchetypes } from "@/components/deck-builder/meta-archetypes";
import { DeckBuilderEmptyState } from "@/components/deck-builder/empty-state";

const INVENTORY_TABS = [
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/catalog', label: 'Card Catalog' },
  { href: '/dashboard/deck-builder', label: 'Deck Builder' },
  { href: '/dashboard/trade-ins', label: 'Trade-Ins' },
  { href: '/dashboard/consignment', label: 'Consignment' },
];

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
  substitute?: {
    name: string;
    price_cents: number;
    inventory_item_id: string;
    image_url: string | null;
    reason: string;
  };
  network?: Array<{
    store_name: string;
    store_slug: string;
    city: string | null;
    state: string | null;
    quantity: number;
  }>;
}

interface LiveMetaResult {
  name: string;
  metaShare: number;
  format: string;
  deckUrl?: string;
}

interface CommanderSearchResult {
  name: string;
  color_identity: string[];
  image_url: string | null;
  type_line: string;
}

interface EDHRECCard {
  name: string;
  synergy: number;
  num_decks: number;
  potential_decks: number;
  category: string;
}

interface CommanderDeckResult {
  commander_name: string;
  num_decks: number;
  avg_price: number;
  color_identity: string[];
  synergy_cards: EDHRECCard[];
  inventory_matches: InventoryMatch[];
  substitutions: Array<{
    missing_card: string;
    substitute: string;
    substitute_synergy: number;
    in_stock: boolean;
  }>;
}

interface PokemonMetaDeck {
  archetype: string;
  placing: number;
  tournament_name: string;
  cards: Array<{ name: string; quantity: number; category: string }>;
}

/* ------------------------------------------------------------------ */
/*  Formats                                                             */
/* ------------------------------------------------------------------ */

const FORMATS = [
  { key: "standard", label: "MTG — Standard", game: "mtg" },
  { key: "modern", label: "MTG — Modern", game: "mtg" },
  { key: "pioneer", label: "MTG — Pioneer", game: "mtg" },
  { key: "commander", label: "MTG — Commander", game: "mtg" },
  { key: "pokemon", label: "Pokemon TCG", game: "pokemon" },
  { key: "yugioh", label: "Yu-Gi-Oh!", game: "yugioh" },
] as const;

/* ------------------------------------------------------------------ */
/*  Reusable Operator-Console primitives (local)                        */
/* ------------------------------------------------------------------ */

const TEXT_INPUT_STYLE: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--rule-hi)",
  color: "var(--ink)",
  fontSize: "0.92rem",
  padding: "0 0.85rem",
  minHeight: 48,
  letterSpacing: "0.005em",
  outline: "none",
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.66rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 600,
  padding: "0 1rem",
  minHeight: 48,
  background: "var(--orange)",
  color: "var(--void)",
  border: "1px solid var(--orange)",
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.62rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 600,
  padding: "0 0.85rem",
  minHeight: 44,
  background: "var(--panel-mute)",
  border: "1px solid var(--rule-hi)",
  color: "var(--ink-soft)",
};

function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: size, height: size }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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
  const [metaDecks, setMetaDecks] = useState<LiveMetaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [recommendations, setRecommendations] = useState<Array<{ type: string; name: string; reason: string; price_cents: number; inventory_item_id: string; image_url: string | null }>>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "paste">("search");

  // Commander state
  const [commanderQuery, setCommanderQuery] = useState("");
  const [commanderResults, setCommanderResults] = useState<CommanderSearchResult[]>([]);
  const [commanderData, setCommanderData] = useState<CommanderDeckResult | null>(null);
  const [commanderLoading, setCommanderLoading] = useState(false);
  const [commanderSearchLoading, setCommanderSearchLoading] = useState(false);

  // Pokemon state
  const [pokemonDecks, setPokemonDecks] = useState<PokemonMetaDeck[]>([]);
  const [pokemonLoading, setPokemonLoading] = useState(false);

  // URL import state (Moxfield / Archidekt)
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedDeck, setImportedDeck] = useState<{
    name: string | null;
    source: string;
    format: string | null;
    url: string;
  } | null>(null);

  // Deck analysis state (mana curve, colors, legality)
  const [deckAnalysis, setDeckAnalysis] = useState<DeckAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const isCommander = format === "commander";
  const isPokemon = format === "pokemon";
  const isYugioh = format === "yugioh";

  // Fetch meta deck suggestions
  const loadSuggestions = useCallback(async (fmt: string) => {
    const fmtInfo = FORMATS.find((f) => f.key === fmt);
    if (!fmtInfo) return;

    if (fmt === "pokemon") {
      setPokemonLoading(true);
      try {
        const res = await fetch("/api/deck-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pokemon_meta" }),
        });
        if (res.ok) {
          const data = await res.json();
          setPokemonDecks(data.decks ?? []);
        }
      } catch {
        // ignore
      } finally {
        setPokemonLoading(false);
      }
      return;
    }

    if (fmt === "commander" || fmt === "yugioh") {
      setMetaDecks([]);
      return;
    }

    setMetaLoading(true);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "meta", format: fmt, game: fmtInfo.game }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetaDecks(data.archetypes ?? []);
      }
    } catch {
      // ignore
    } finally {
      setMetaLoading(false);
    }
  }, []);

  // Load suggestions on format change
  const handleFormatChange = useCallback(
    (fmt: string) => {
      setFormat(fmt);
      setSearchResults([]);
      setInventoryResults([]);
      setParsedCards([]);
      setCommanderData(null);
      setCommanderResults([]);
      setPokemonDecks([]);
      setMetaDecks([]);
      loadSuggestions(fmt);
    },
    [loadSuggestions],
  );

  // Initial load
  useEffect(() => {
    loadSuggestions("standard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          format: format !== "other" && format !== "yugioh" && format !== "pokemon" ? format : undefined,
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

  // Fetch a real tournament decklist for an archetype
  async function handleFetchDeck(archetype: string) {
    setLoading(true);
    setInventoryResults([]);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_deck",
          archetype,
          format,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const cards: ParsedCard[] = data.cards ?? [];
        setParsedCards(cards);
        if (data.inventory) {
          setInventoryResults(data.inventory);
        }
        if (data.recommendations) {
          setRecommendations(data.recommendations);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Commander search
  async function handleCommanderSearch() {
    if (!commanderQuery.trim()) return;
    setCommanderSearchLoading(true);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commander_search", query: commanderQuery.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommanderResults(data.commanders ?? []);
      }
    } catch {
      // ignore
    } finally {
      setCommanderSearchLoading(false);
    }
  }

  // Select a commander and fetch EDHREC data
  async function handleSelectCommander(name: string) {
    setCommanderLoading(true);
    setCommanderResults([]);
    setInventoryResults([]);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commander", commander: name }),
      });
      if (res.ok) {
        const data: CommanderDeckResult = await res.json();
        setCommanderData(data);
        setInventoryResults(data.inventory_matches);
      }
    } catch {
      // ignore
    } finally {
      setCommanderLoading(false);
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
    void runDeckAnalysis(cards);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "match", cards, format, in_stock_only: inStockOnly }),
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryResults(data.results ?? []);
        setRecommendations(data.recommendations ?? []);
      }
    } catch {
      // ignore
    } finally {
      setMatchLoading(false);
    }
  }

  async function runDeckAnalysis(cards: ParsedCard[]) {
    if (cards.length === 0) return;
    setAnalyzing(true);
    setDeckAnalysis(null);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", cards }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeckAnalysis(data.analysis ?? null);
      }
    } catch {
      // Analysis is non-critical
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportedDeck(null);
    try {
      const res = await fetch("/api/deck-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_url", url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return;
      }
      const deck = data.deck as {
        source: string;
        source_url: string;
        deck_name: string | null;
        format: string | null;
        cards: ParsedCard[];
        sideboard: ParsedCard[];
        commanders: ParsedCard[];
      };

      const allCards = [...deck.commanders, ...deck.cards];
      const text = allCards.map((c) => `${c.quantity} ${c.name}`).join("\n");
      setDecklistText(text);
      setParsedCards(allCards);
      setImportedDeck({
        name: deck.deck_name,
        source: deck.source,
        format: deck.format,
        url: deck.source_url,
      });
      if (deck.format && FORMATS.some((f) => f.key === deck.format)) {
        setFormat(deck.format);
      }
      await checkInventory(allCards);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

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

  const stockPercent = totalCards > 0 ? Math.round((inStockCards / totalCards) * 100) : 0;
  const fmtLabel = FORMATS.find((f) => f.key === format)?.label ?? format;

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={INVENTORY_TABS} />
      <PageHeader
        title="Deck Builder"
        crumb="TCG · Deck Builder"
        desc="Match decklists against your store's inventory · suggest substitutes · price out the build."
      />

      {/* Stat strip */}
      <div
        className="grid grid-cols-3 md:grid-cols-6"
        style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
      >
        {[
          { k: "Format", v: fmtLabel.replace("MTG — ", "").replace("!", "") },
          { k: "Cards Needed", v: totalCards > 0 ? totalCards.toLocaleString() : "—" },
          { k: "In Stock", v: inventoryResults.length > 0 ? inStockCards.toLocaleString() : "—", tone: inStockCards > 0 ? "var(--teal)" : undefined },
          { k: "Missing", v: inventoryResults.length > 0 ? needToOrder.toLocaleString() : "—", tone: needToOrder > 0 ? "var(--yellow)" : undefined },
          { k: "Coverage", v: inventoryResults.length > 0 ? `${stockPercent}%` : "—", tone: stockPercent >= 80 ? "var(--teal)" : stockPercent >= 50 ? "var(--yellow)" : stockPercent > 0 ? "var(--red)" : undefined },
          { k: "Status", v: matchLoading ? "MATCHING" : analyzing ? "ANALYZING" : inventoryResults.length > 0 ? "READY" : "IDLE" },
        ].map((cell) => (
          <div key={cell.k} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
            <div
              className="font-mono uppercase font-semibold text-ink-faint"
              style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
            >
              {cell.k}
            </div>
            <div
              className="font-mono font-semibold mt-1"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---- Left Panel: Deck Building ---- */}
        <div className="space-y-4">
          <FormatSelector value={format} onChange={handleFormatChange} />

          {/* ---- Commander Tab ---- */}
          {isCommander && (
            <div className="space-y-3">
              <ZoneLabel>Search Commanders</ZoneLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commanderQuery}
                  onChange={(e) => setCommanderQuery(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleCommanderSearch();
                  }}
                  placeholder="Search for a commander (e.g. Yuriko)…"
                  className="flex-1 font-mono text-ink placeholder:text-ink-faint focus:outline-none"
                  style={TEXT_INPUT_STYLE}
                />
                <button
                  onClick={handleCommanderSearch}
                  disabled={commanderSearchLoading || !commanderQuery.trim()}
                  className="disabled:opacity-40 transition-opacity"
                  style={PRIMARY_BUTTON_STYLE}
                >
                  {commanderSearchLoading ? "…" : "Search"}
                </button>
              </div>

              {commanderResults.length > 0 && (
                <div
                  className="max-h-72 overflow-y-auto"
                  style={{
                    background: "var(--panel-mute)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  {commanderResults.map((cmdr) => (
                    <button
                      key={cmdr.name}
                      onClick={() => handleSelectCommander(cmdr.name)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-panel"
                      style={{ borderBottom: "1px solid var(--rule-faint)", minHeight: 56 }}
                    >
                      {cmdr.image_url && <CardImage src={cmdr.image_url} size="sm" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-ink truncate flex items-center gap-2" style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                          <span className="truncate">{cmdr.name}</span>
                          <ColorPips colors={cmdr.color_identity} size={14} />
                        </div>
                        <div className="font-mono text-ink-faint truncate mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                          {cmdr.type_line}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {commanderLoading && (
                <div
                  className="flex flex-col items-center justify-center h-24 gap-1"
                  style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
                >
                  <div className="flex items-center gap-2 font-mono uppercase text-ink-soft" style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}>
                    <Spinner />
                    Loading EDHREC synergy
                  </div>
                  <span className="text-ink-faint" style={{ fontSize: "0.66rem" }}>
                    This can take 5-10 seconds for popular commanders
                  </span>
                </div>
              )}

              {commanderData && !commanderLoading && (
                <div className="space-y-3">
                  <div
                    className="p-3 space-y-1"
                    style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
                  >
                    <div className="font-display text-ink flex items-center gap-2" style={{ fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.005em" }}>
                      <span>{commanderData.commander_name}</span>
                      <ColorPips colors={commanderData.color_identity} size={16} />
                    </div>
                    <div className="flex gap-3 font-mono text-ink-faint" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                      <span>{commanderData.num_decks.toLocaleString()} decks on EDHREC</span>
                      <span style={{ color: "var(--rule-hi)" }}>·</span>
                      <span>Avg ${commanderData.avg_price.toFixed(0)}</span>
                    </div>
                  </div>

                  <ZoneLabel>Top Synergy Cards ({commanderData.synergy_cards.length})</ZoneLabel>
                  <div
                    className="max-h-80 overflow-y-auto"
                    style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
                  >
                    {commanderData.synergy_cards.slice(0, 30).map((card, i) => (
                      <div
                        key={`${card.name}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-panel"
                        style={{ borderBottom: "1px solid var(--rule-faint)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-ink truncate" style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                            {card.name}
                          </div>
                          <div className="font-mono text-ink-faint mt-0.5" style={{ fontSize: "0.62rem", letterSpacing: "0.04em" }}>
                            {card.category}
                          </div>
                        </div>
                        <div className="shrink-0 font-mono tabular-nums" style={{ fontSize: "0.7rem" }}>
                          <span style={{ color: card.synergy > 0 ? "var(--teal)" : "var(--ink-faint)", fontWeight: 600 }}>
                            {card.synergy > 0 ? "+" : ""}{(card.synergy * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="shrink-0 font-mono text-ink-faint tabular-nums" style={{ fontSize: "0.62rem" }}>
                          {card.num_decks.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {commanderData.substitutions.length > 0 && (
                    <div className="space-y-2">
                      <ZoneLabel>In-Stock Substitutions</ZoneLabel>
                      <div
                        className="space-y-0"
                        style={{ background: "var(--yellow-mute)", border: "1px solid rgba(251,219,101,0.35)" }}
                      >
                        {commanderData.substitutions.map((sub, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2 font-mono"
                            style={{ borderBottom: "1px solid rgba(251,219,101,0.18)", fontSize: "0.78rem" }}
                          >
                            <span className="line-through truncate flex-1" style={{ color: "var(--red)" }}>
                              {sub.missing_card}
                            </span>
                            <span className="text-ink-faint shrink-0">→</span>
                            <span className="truncate flex-1" style={{ color: "var(--teal)" }}>
                              {sub.substitute}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- Pokemon Tab ---- */}
          {isPokemon && (
            <div className="space-y-3">
              <ZoneLabel>Recent Tournament Decks</ZoneLabel>
              {pokemonLoading && (
                <div
                  className="flex items-center justify-center gap-2 h-24 font-mono uppercase text-ink-soft"
                  style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.7rem", letterSpacing: "0.18em" }}
                >
                  <Spinner />
                  Loading tournament data…
                </div>
              )}
              {!pokemonLoading && pokemonDecks.length === 0 && (
                <div
                  className="text-center px-4 py-6 font-mono text-ink-soft"
                  style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.78rem" }}
                >
                  No tournament data available. Try again later.
                </div>
              )}
              {pokemonDecks.length > 0 && (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                  {pokemonDecks.map((deck, i) => (
                    <div
                      key={i}
                      className="p-3 space-y-2"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-display text-ink truncate" style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                            {deck.archetype}
                          </div>
                          <div className="font-mono text-ink-faint truncate mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                            {deck.tournament_name} · #{deck.placing}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const cards: ParsedCard[] = deck.cards.map((c) => ({
                              quantity: c.quantity,
                              name: c.name,
                            }));
                            setParsedCards(cards);
                            checkInventory(cards);
                          }}
                          className="shrink-0 transition-colors"
                          style={{
                            ...SECONDARY_BUTTON_STYLE,
                            background: "var(--orange-mute)",
                            border: "1px solid var(--orange)",
                            color: "var(--orange)",
                          }}
                        >
                          Check Inventory
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {deck.cards
                          .filter((c) => c.category === "pokemon")
                          .slice(0, 6)
                          .map((c, j) => (
                            <span
                              key={j}
                              className="font-mono text-ink"
                              style={{
                                padding: "1px 6px",
                                fontSize: "0.62rem",
                                background: "var(--panel)",
                                border: "1px solid var(--rule-hi)",
                                letterSpacing: "0.02em",
                              }}
                            >
                              {c.quantity}× {c.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Still allow pasting a Pokemon decklist */}
              <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--rule-faint)" }}>
                <ZoneLabel>Paste Decklist</ZoneLabel>
                <textarea
                  value={decklistText}
                  onChange={(e) => setDecklistText(e.target.value)}
                  placeholder={`Paste Pokemon decklist here…\n\n4 Charizard ex\n2 Arcanine\n4 Professor's Research`}
                  rows={6}
                  className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none p-3"
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--rule-hi)",
                    fontSize: "0.85rem",
                    resize: "none",
                  }}
                />
                <button
                  onClick={handleParseDeck}
                  disabled={loading || !decklistText.trim()}
                  className="w-full disabled:opacity-40 transition-opacity"
                  style={PRIMARY_BUTTON_STYLE}
                >
                  {loading ? "Parsing…" : "Parse & Check Inventory"}
                </button>
              </div>
            </div>
          )}

          {/* ---- MTG Competitive + Yu-Gi-Oh ---- */}
          {!isCommander && !isPokemon && (
            <>
              <MetaArchetypes
                decks={metaDecks}
                loading={metaLoading}
                onSelect={handleFetchDeck}
              />

              {/* Tab: Search vs Paste — operator console mono */}
              <div
                className="flex"
                style={{ background: "var(--slate)", borderBottom: "1px solid var(--rule)" }}
              >
                {[
                  { id: "search" as const, label: "Search Cards" },
                  { id: "paste" as const, label: "Paste Decklist" },
                ].map((t) => {
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className="font-mono uppercase font-semibold transition-colors"
                      style={{
                        padding: "0.85rem 1.1rem",
                        minHeight: 52,
                        fontSize: "0.7rem",
                        letterSpacing: "0.22em",
                        borderBottom: `2px solid ${isActive ? "var(--orange)" : "transparent"}`,
                        color: isActive ? "var(--orange)" : "var(--ink-soft)",
                        background: "transparent",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "search" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleSearch();
                      }}
                      placeholder={
                        isYugioh
                          ? "Search Yu-Gi-Oh cards…"
                          : "Search cards (e.g. red creature cmc<=3)…"
                      }
                      className="flex-1 font-mono text-ink placeholder:text-ink-faint focus:outline-none"
                      style={TEXT_INPUT_STYLE}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading || !searchQuery.trim()}
                      className="disabled:opacity-40 transition-opacity"
                      style={PRIMARY_BUTTON_STYLE}
                    >
                      {loading ? "…" : "Search"}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-mono uppercase font-semibold text-ink-soft"
                          style={{ fontSize: "0.66rem", letterSpacing: "0.18em" }}
                        >
                          {searchResults.length} cards found
                        </span>
                        <button
                          onClick={handleCheckSearchResults}
                          disabled={matchLoading}
                          className="transition-colors disabled:opacity-50"
                          style={{
                            ...SECONDARY_BUTTON_STYLE,
                            background: "var(--orange-mute)",
                            border: "1px solid var(--orange)",
                            color: "var(--orange)",
                          }}
                        >
                          {matchLoading ? "Checking…" : "Check Inventory"}
                        </button>
                      </div>
                      <div
                        className="max-h-96 overflow-y-auto"
                        style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
                      >
                        {searchResults.map((card, i) => (
                          <div
                            key={`${card.name}-${i}`}
                            className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-panel"
                            style={{ borderBottom: "1px solid var(--rule-faint)" }}
                          >
                            {card.image_url && <CardImage src={card.image_url} size="sm" />}
                            <div className="flex-1 min-w-0">
                              <div className="font-display text-ink truncate" style={{ fontSize: "0.92rem", fontWeight: 500 }}>
                                {card.name}
                              </div>
                              <div className="font-mono text-ink-faint truncate mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                                {card.type_line}
                                {card.mana_cost && (
                                  <span className="ml-2 opacity-70">{card.mana_cost}</span>
                                )}
                              </div>
                            </div>
                            {card.price_cents != null && <PriceTag cents={card.price_cents} size="sm" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* URL import */}
                  <div
                    className="p-3 space-y-2"
                    style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <ZoneLabel>Import from URL</ZoneLabel>
                      <span
                        className="font-mono uppercase text-ink-faint"
                        style={{ fontSize: "0.55rem", letterSpacing: "0.18em" }}
                      >
                        Moxfield · Archidekt
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" && importUrl.trim() && !importing) {
                            handleImportUrl();
                          }
                        }}
                        placeholder="https://www.moxfield.com/decks/…"
                        className="flex-1 min-w-0 font-mono text-ink placeholder:text-ink-faint focus:outline-none"
                        style={{ ...TEXT_INPUT_STYLE, fontSize: "0.85rem", minHeight: 44 }}
                      />
                      <button
                        onClick={handleImportUrl}
                        disabled={importing || !importUrl.trim()}
                        className="shrink-0 disabled:opacity-40 transition-opacity"
                        style={{ ...PRIMARY_BUTTON_STYLE, minHeight: 44 }}
                      >
                        {importing ? "Importing…" : "Import"}
                      </button>
                    </div>
                    {importError && (
                      <div
                        className="font-mono px-3 py-2"
                        style={{
                          fontSize: "0.74rem",
                          background: "var(--red-mute)",
                          border: "1px solid var(--red)",
                          color: "var(--red)",
                        }}
                      >
                        {importError}
                      </div>
                    )}
                    {importedDeck && (
                      <div
                        className="font-mono flex items-center gap-2 flex-wrap text-ink-soft"
                        style={{ fontSize: "0.7rem", letterSpacing: "0.02em" }}
                      >
                        <span style={{ color: "var(--teal)" }}>✓</span>
                        <span className="text-ink font-medium truncate">
                          {importedDeck.name ?? "Untitled deck"}
                        </span>
                        <span className="text-ink-ghost">·</span>
                        <span>from {importedDeck.source}</span>
                        {importedDeck.format && (
                          <>
                            <span className="text-ink-ghost">·</span>
                            <span className="capitalize">{importedDeck.format}</span>
                          </>
                        )}
                        <a
                          href={importedDeck.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto hover:underline"
                          style={{ color: "var(--orange)" }}
                        >
                          view original →
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "var(--rule)" }} />
                    <span
                      className="font-mono uppercase text-ink-faint"
                      style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                    >
                      or paste
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--rule)" }} />
                  </div>

                  <textarea
                    value={decklistText}
                    onChange={(e) => setDecklistText(e.target.value)}
                    placeholder={`Paste decklist here:\n\n4 Lightning Bolt\n4 Monastery Swiftspear\n2 Embercleave\n20 Mountain`}
                    rows={12}
                    className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none p-3"
                    style={{
                      background: "var(--panel)",
                      border: "1px solid var(--rule-hi)",
                      fontSize: "0.85rem",
                      resize: "none",
                    }}
                  />
                  <button
                    onClick={handleParseDeck}
                    disabled={loading || !decklistText.trim()}
                    className="w-full disabled:opacity-40 transition-opacity"
                    style={PRIMARY_BUTTON_STYLE}
                  >
                    {loading ? "Parsing…" : "Parse & Check Inventory"}
                  </button>

                  {parsedCards.length > 0 && !inventoryResults.length && (
                    <div
                      className="p-3"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
                    >
                      <div
                        className="font-mono uppercase font-semibold text-ink-faint mb-2"
                        style={{ fontSize: "0.6rem", letterSpacing: "0.22em" }}
                      >
                        Parsed: {parsedCards.length} unique · {parsedCards.reduce((s, c) => s + c.quantity, 0)} total
                      </div>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {parsedCards.map((c, i) => (
                          <div
                            key={i}
                            className="flex justify-between font-mono text-ink px-2 py-1"
                            style={{ fontSize: "0.78rem" }}
                          >
                            <span>{c.name}</span>
                            <span className="text-ink-faint tabular-nums">×{c.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- Right Panel: Inventory Match Results ---- */}
        <div className="space-y-4">
          {matchLoading && (
            <div
              className="flex items-center justify-center gap-2 h-32 font-mono uppercase text-ink-soft"
              style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.7rem", letterSpacing: "0.18em" }}
            >
              <Spinner />
              Checking store inventory…
            </div>
          )}

          {/* Deck analysis */}
          {deckAnalysis && (
            <AnalysisPanel analysis={deckAnalysis} targetFormat={format} />
          )}
          {analyzing && !deckAnalysis && (
            <div
              className="flex items-center gap-2 p-4 font-mono uppercase text-ink-soft"
              style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.66rem", letterSpacing: "0.18em" }}
            >
              <Spinner size={14} />
              Analyzing deck (colors · curve · legality)…
            </div>
          )}

          {inventoryResults.length > 0 && (
            <>
              <ZoneLabel>Inventory Match</ZoneLabel>

              <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                {inventoryResults.map((match, i) => (
                  <InventoryCard
                    key={`${match.name}-${i}`}
                    match={match}
                    onAddToCart={() => addToCart(match)}
                    onAddSubstitute={
                      match.substitute
                        ? () =>
                            addToCart({
                              name: match.substitute!.name,
                              needed: match.needed - match.in_stock,
                              in_stock: 1,
                              price_cents: match.substitute!.price_cents,
                              inventory_item_id: match.substitute!.inventory_item_id,
                              image_url: match.substitute!.image_url,
                              status: "available",
                            })
                        : undefined
                    }
                  />
                ))}
              </div>

              {/* In Stock Only toggle */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)" }}
              >
                <span
                  className="font-mono uppercase font-semibold text-ink-soft"
                  style={{ fontSize: "0.66rem", letterSpacing: "0.18em" }}
                >
                  In-Stock Only
                </span>
                <button
                  onClick={() => {
                    setInStockOnly(!inStockOnly);
                    if (parsedCards.length > 0) {
                      checkInventory(parsedCards);
                    }
                  }}
                  className="relative transition-colors"
                  style={{
                    width: 44,
                    height: 24,
                    background: inStockOnly ? "var(--orange)" : "var(--panel)",
                    border: `1px solid ${inStockOnly ? "var(--orange)" : "var(--rule-hi)"}`,
                  }}
                  aria-pressed={inStockOnly}
                >
                  <span
                    className="absolute transition-transform"
                    style={{
                      top: 2,
                      left: inStockOnly ? 22 : 2,
                      width: 18,
                      height: 18,
                      background: inStockOnly ? "var(--void)" : "var(--ink-soft)",
                    }}
                  />
                </button>
              </div>

              {/* Sticky summary */}
              <DeckSummary
                totalCards={totalCards}
                inStockCards={inStockCards}
                needToOrder={needToOrder}
                estimatedTotal={estimatedTotal}
                onAddAllToCart={addAllToCart}
              />

              <RecommendationsPanel
                items={recommendations}
                onAdd={(rec) => {
                  const cartItems = [{ inventory_item_id: rec.inventory_item_id, name: rec.name, price_cents: rec.price_cents, quantity: 1 }];
                  const existing = localStorage.getItem("deck-builder-cart");
                  const merged = existing ? [...JSON.parse(existing), ...cartItems] : cartItems;
                  localStorage.setItem("deck-builder-cart", JSON.stringify(merged));
                  setRecommendations((prev) => prev.filter((r) => r.inventory_item_id !== rec.inventory_item_id));
                }}
              />
            </>
          )}

          {!matchLoading && inventoryResults.length === 0 && (
            <DeckBuilderEmptyState format={format} />
          )}
        </div>
      </div>
    </div>
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
