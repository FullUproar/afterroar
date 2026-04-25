"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store-context";
import { formatCents, parseDollars } from "@/lib/types";
import type { Permission } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ConditionBadge, CardImage } from "@/components/tcg/shared";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface SingleItem {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  quantity: number;
  image_url: string | null;
  external_id: string | null;
  game: string | null;
  set_name: string | null;
  set_code: string | null;
  condition: string;
  foil: boolean;
  rarity: string | null;
  scryfall_id: string | null;
  collector_number: string | null;
  margin_percent: number | null;
  listed_on_ebay: boolean;
}

interface Stats {
  total_singles: number;
  unique_cards: number;
  total_cost_cents: number;
  total_retail_cents: number;
  avg_margin_percent: number;
  alert_eligible: number;
}

type GameFilter = "All" | "MTG" | "Pokemon" | "Lorcana" | "Yu-Gi-Oh";
type SortField = "name" | "set" | "condition" | "quantity" | "price" | "cost" | "margin";
type SortState = { field: SortField; dir: "asc" | "desc" } | null;

type MainTab = "inventory" | "marketplace";
type MarketplaceGame = "mtg" | "pokemon" | "yugioh";

interface MarketplaceCard {
  id: string;
  name: string;
  set_name: string;
  set_code: string;
  collector_number: string;
  rarity: string | null;
  price_usd: string | null;
  price_usd_foil: string | null;
  image_url: string | null;
  small_image_url: string | null;
  foil: boolean;
  nonfoil: boolean;
  type_line: string;
  mana_cost: string;
  in_stock_qty?: number;
  inventory_id?: string;
}

interface AddFormState {
  card: MarketplaceCard;
  quantity: number;
  cost: string;
  price: string;
  condition: string;
  foil: boolean;
}

const GAME_TABS: GameFilter[] = ["All", "MTG", "Pokemon", "Lorcana", "Yu-Gi-Oh"];
const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
const CONDITION_MULTIPLIERS: Record<string, number> = {
  NM: 1.0, LP: 0.85, MP: 0.7, HP: 0.5, DMG: 0.3,
};
const PAGE_SIZE = 10;

const RARITY_TONE: Record<string, string> = {
  common: "var(--ink-soft)",
  uncommon: "var(--ink)",
  rare: "var(--yellow)",
  mythic: "var(--orange)",
};

/* ================================================================== */
/*  Spinner                                                            */
/* ================================================================== */

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: size, height: size }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function SinglesDashboard() {
  const router = useRouter();
  const { can } = useStore();
  const [mainTab, setMainTab] = useState<MainTab>("inventory");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  const [marketplacePreSearch, setMarketplacePreSearch] = useState<string | null>(null);
  function switchToMarketplace(query: string) {
    setMarketplacePreSearch(query);
    setMainTab("marketplace");
  }

  return (
    <div className="mx-auto max-w-6xl flex flex-col h-full gap-4 pb-8 min-w-0">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 font-mono uppercase font-semibold shadow-2xl"
          style={{
            background: toast.type === "error" ? "var(--red)" : "var(--teal)",
            color: "var(--void)",
            fontSize: "0.7rem",
            letterSpacing: "0.18em",
            border: `1px solid ${toast.type === "error" ? "var(--red)" : "var(--teal)"}`,
          }}
        >
          {toast.message}
        </div>
      )}

      <PageHeader
        title="TCG Singles"
        crumb="TCG · Singles"
        desc="Your inventory of singles + a live marketplace search to fill gaps."
        backHref="/dashboard"
        action={
          <Link
            href="/dashboard/catalog"
            className="font-mono uppercase font-semibold transition-opacity hover:opacity-90 inline-flex items-center"
            style={{
              fontSize: "0.66rem",
              letterSpacing: "0.18em",
              padding: "0 1rem",
              minHeight: 48,
              background: "var(--orange)",
              color: "var(--void)",
              border: "1px solid var(--orange)",
            }}
          >
            + Add Cards
          </Link>
        }
      />

      {/* Main Tabs — operator console mono */}
      <div
        className="flex"
        style={{ background: "var(--slate)", borderBottom: "1px solid var(--rule)" }}
      >
        {[
          { id: "inventory" as const, label: "My Inventory" },
          { id: "marketplace" as const, label: "Marketplace" },
        ].map((t) => {
          const isActive = mainTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
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

      {mainTab === "inventory" ? (
        <InventoryTab
          router={router}
          showToast={showToast}
          switchToMarketplace={switchToMarketplace}
        />
      ) : (
        <MarketplaceTab
          can={can}
          showToast={showToast}
          preSearch={marketplacePreSearch}
          clearPreSearch={() => setMarketplacePreSearch(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  INVENTORY TAB                                                      */
/* ================================================================== */

function InventoryTab({
  router,
  switchToMarketplace,
}: {
  router: ReturnType<typeof useRouter>;
  showToast: (msg: string, type?: "success" | "error") => void;
  switchToMarketplace: (query: string) => void;
}) {
  const [items, setItems] = useState<SingleItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [gameFilter, setGameFilter] = useState<GameFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [sort, setSort] = useState<SortState>({ field: "name", dir: "asc" });

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [gameFilter]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (gameFilter !== "All") params.set("game", gameFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sort) {
        params.set("sort", sort.field);
        params.set("dir", sort.dir);
      }
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      params.set("stats", page === 1 ? "true" : "false");

      const res = await fetch(`/api/singles?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      setItems(data.items);
      if (data.stats) setStats(data.stats);
      if (typeof data.total === "number") setTotal(data.total);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [gameFilter, debouncedSearch, sort, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleSort(field: SortField) {
    setSort((prev) => {
      if (!prev || prev.field !== field) {
        const numericFields: SortField[] = ["price", "cost", "quantity", "margin"];
        return { field, dir: numericFields.includes(field) ? "desc" : "asc" };
      }
      if (prev.dir === "asc") return { field, dir: "desc" };
      if (prev.dir === "desc") return null;
      return { field, dir: "asc" };
    });
    setPage(1);
  }

  function sortIndicator(field: SortField) {
    if (!sort || sort.field !== field) return null;
    return (
      <span className="ml-0.5">{sort.dir === "asc" ? "▲" : "▼"}</span>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      {stats && (
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
        >
          {[
            { k: "Total Singles", v: stats.total_singles.toLocaleString(), sub: `${stats.unique_cards} unique` },
            { k: "Total Value", v: formatCents(stats.total_retail_cents), sub: `Cost ${formatCents(stats.total_cost_cents)}`, tone: "var(--teal)" },
            { k: "Avg Margin", v: `${stats.avg_margin_percent}%`, sub: "across all singles", tone: stats.avg_margin_percent >= 30 ? "var(--teal)" : stats.avg_margin_percent >= 10 ? "var(--yellow)" : "var(--red)" },
            { k: "Unique Cards", v: stats.unique_cards.toLocaleString(), sub: "distinct items" },
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
                  fontSize: "1rem",
                  letterSpacing: "0.02em",
                  color: cell.tone || "var(--ink)",
                }}
              >
                {cell.v}
              </div>
              <div
                className="font-mono text-ink-faint mt-0.5"
                style={{ fontSize: "0.6rem", letterSpacing: "0.04em" }}
              >
                {cell.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tool Links */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/dashboard/singles/evaluate", label: "Card Evaluator" },
          { href: "/dashboard/singles/pricing", label: "Bulk Pricing" },
          { href: "/dashboard/singles/ebay", label: "eBay Listings" },
          { href: "/dashboard/trade-ins/bulk", label: "Bulk Buylist" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="font-mono uppercase font-semibold transition-colors hover:text-ink hover:border-ink-faint"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.16em",
              padding: "0 0.85rem",
              minHeight: 44,
              background: "var(--panel-mute)",
              border: "1px solid var(--rule-hi)",
              color: "var(--ink-soft)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Game Filter Pills */}
      <div className="overflow-hidden w-full">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {GAME_TABS.map((tab) => {
            const isActive = gameFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setGameFilter(tab)}
                className="font-mono uppercase font-semibold whitespace-nowrap transition-colors"
                style={{
                  fontSize: "0.66rem",
                  letterSpacing: "0.18em",
                  padding: "0 0.85rem",
                  minHeight: 40,
                  background: isActive ? "var(--orange-mute)" : "var(--panel-mute)",
                  border: `1px solid ${isActive ? "var(--orange)" : "var(--rule-hi)"}`,
                  color: isActive ? "var(--orange)" : "var(--ink-soft)",
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          style={{ width: 16, height: 16 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.5-4.5" />
        </svg>
        <input
          type="text"
          placeholder="Search your inventory…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.92rem",
            padding: "0 0.85rem 0 2.4rem",
            minHeight: 48,
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-12 font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
        >
          <Spinner />
          Loading singles…
        </div>
      ) : items.length === 0 && !debouncedSearch && gameFilter === "All" ? (
        <EmptyInventory />
      ) : items.length === 0 ? (
        <div
          className="text-center py-12 space-y-3 px-6"
          style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
        >
          <p className="font-mono text-ink-soft" style={{ fontSize: "0.78rem" }}>
            No singles found matching your search
          </p>
          <Link
            href="/dashboard/catalog"
            className="inline-flex items-center font-mono uppercase font-semibold transition-opacity"
            style={{
              fontSize: "0.66rem",
              letterSpacing: "0.18em",
              padding: "0 1rem",
              minHeight: 44,
              background: "var(--orange)",
              color: "var(--void)",
              border: "1px solid var(--orange)",
            }}
          >
            Add from Catalog
          </Link>
        </div>
      ) : (
        <>
          <section className="ar-zone" style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}>
            <div className="ar-zone-head">
              <span>Inventory · <b style={{ color: "var(--ink)" }}>{items.length}</b> of {total.toLocaleString()}</span>
              <span className="text-ink-faint">{gameFilter}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--panel-mute)", borderBottom: "1px solid var(--rule)" }}>
                    <SortHeader field="name" label="Name" sort={sort} onSort={handleSort} indicator={sortIndicator} />
                    <SortHeader field="set" label="Set" sort={sort} onSort={handleSort} indicator={sortIndicator} className="hidden md:table-cell" />
                    <SortHeader field="condition" label="Cond" sort={sort} onSort={handleSort} indicator={sortIndicator} className="hidden sm:table-cell" />
                    <SortHeader field="quantity" label="Qty" sort={sort} onSort={handleSort} indicator={sortIndicator} align="right" />
                    <SortHeader field="price" label="Price" sort={sort} onSort={handleSort} indicator={sortIndicator} align="right" />
                    <SortHeader field="cost" label="Cost" sort={sort} onSort={handleSort} indicator={sortIndicator} align="right" className="hidden lg:table-cell" />
                    <SortHeader field="margin" label="Margin" sort={sort} onSort={handleSort} indicator={sortIndicator} align="right" className="hidden lg:table-cell" />
                    <th
                      className="px-3 py-2.5 text-right font-mono uppercase font-semibold text-ink-faint"
                      style={{ fontSize: "0.55rem", letterSpacing: "0.22em", width: 60 }}
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const marginTone = item.margin_percent != null
                      ? item.margin_percent >= 30
                        ? "var(--teal)"
                        : item.margin_percent >= 10
                          ? "var(--yellow)"
                          : "var(--red)"
                      : "var(--ink-faint)";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                        className="transition-colors cursor-pointer hover:bg-panel"
                        style={{ borderBottom: "1px solid var(--rule-faint)" }}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CardImage src={item.image_url} alt={item.name} size="xs" game={item.game || undefined} />
                            <div className="min-w-0">
                              <div
                                className="font-display text-ink truncate"
                                style={{ fontSize: "0.92rem", fontWeight: 500, maxWidth: 240 }}
                              >
                                {item.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 md:hidden">
                                <span
                                  className="font-mono text-ink-faint truncate"
                                  style={{ fontSize: "0.6rem", letterSpacing: "0.04em", maxWidth: 120 }}
                                >
                                  {item.set_name || item.set_code || ""}
                                </span>
                                <ConditionBadge condition={item.condition} size="xs" />
                                {item.foil && <FoilTag />}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span
                            className="font-mono text-ink-soft truncate block"
                            style={{ fontSize: "0.7rem", letterSpacing: "0.04em", maxWidth: 160 }}
                          >
                            {item.set_name || item.set_code || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <ConditionBadge condition={item.condition} size="xs" />
                            {item.foil && <FoilTag />}
                          </div>
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono tabular-nums text-ink"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {item.quantity}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-ink"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {formatCents(item.price_cents)}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-soft hidden lg:table-cell"
                          style={{ fontSize: "0.78rem" }}
                        >
                          {formatCents(item.cost_cents)}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono tabular-nums hidden lg:table-cell"
                          style={{ fontSize: "0.78rem", color: marginTone, fontWeight: 600 }}
                        >
                          {item.margin_percent !== null ? `${item.margin_percent}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              switchToMarketplace(item.name.replace(/\s*\(Foil\)\s*$/, ""));
                            }}
                            className="font-mono uppercase font-semibold transition-colors whitespace-nowrap hover:underline"
                            style={{
                              fontSize: "0.6rem",
                              letterSpacing: "0.16em",
                              color: "var(--orange)",
                              padding: "0 0.5rem",
                              minHeight: 32,
                            }}
                            title="Check market price"
                          >
                            Market
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span
              className="font-mono text-ink-faint tabular-nums"
              style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
            >
              {total > 0
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
                : ""}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="font-mono uppercase font-semibold transition-colors disabled:opacity-40"
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.16em",
                  padding: "0 0.85rem",
                  minHeight: 36,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  color: "var(--ink-soft)",
                }}
              >
                Prev
              </button>
              <span
                className="font-mono text-ink-faint tabular-nums px-3"
                style={{ fontSize: "0.66rem" }}
              >
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="font-mono uppercase font-semibold transition-colors disabled:opacity-40"
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.16em",
                  padding: "0 0.85rem",
                  minHeight: 36,
                  background: "var(--panel)",
                  border: "1px solid var(--rule-hi)",
                  color: "var(--ink-soft)",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MARKETPLACE TAB                                                    */
/* ================================================================== */

function MarketplaceTab({
  can: canFn,
  showToast,
  preSearch,
  clearPreSearch,
}: {
  can: (p: Permission) => boolean;
  showToast: (msg: string, type?: "success" | "error") => void;
  preSearch: string | null;
  clearPreSearch: () => void;
}) {
  const [gameTab, setGameTab] = useState<MarketplaceGame>("mtg");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketplaceCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingIds, setExistingIds] = useState<Map<string, { qty: number; id: string }>>(new Map());

  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterSet, setFilterSet] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterRarity, setFilterRarity] = useState("");
  const [filterFormat, setFilterFormat] = useState("");

  useEffect(() => {
    if (preSearch) {
      setQuery(preSearch);
      clearPreSearch();
      const timer = setTimeout(() => {
        doSearch(preSearch);
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSearch]);

  const doSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || q.length < 2) return;

    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      if (gameTab === "pokemon" || gameTab === "yugioh") {
        const endpoint = gameTab === "pokemon" ? "/api/catalog/pokemon" : "/api/catalog/yugioh";
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        const cards: MarketplaceCard[] = (data.cards || []).map((card: Record<string, unknown>) => {
          const cardId = String(card.pokemon_id || card.yugioh_id || "");
          const priceCents = (card.price_market as number) || (card.price_tcgplayer as number) || null;
          return {
            id: cardId,
            name: String(card.name || ""),
            set_name: String(card.set_name || ""),
            set_code: String(card.set_code || ""),
            collector_number: String(card.number || ""),
            rarity: (card.rarity as string) || null,
            price_usd: priceCents ? (priceCents / 100).toFixed(2) : null,
            price_usd_foil: null,
            image_url: (card.image_url as string) || null,
            small_image_url: (card.small_image_url as string) || (card.image_url as string) || null,
            foil: false,
            nonfoil: true,
            type_line: gameTab === "pokemon" ? "Pokemon" : "Yu-Gi-Oh",
            mana_cost: "",
          };
        });

        setResults(cards);
        setTotal(data.total || 0);

        await crossReferenceInventory(cards);
      } else {
        let scryfallQuery = q;
        if (filterSet) scryfallQuery += ` set:${filterSet}`;
        if (filterColor) scryfallQuery += ` c:${filterColor}`;
        if (filterRarity) scryfallQuery += ` r:${filterRarity}`;
        if (filterFormat) scryfallQuery += ` f:${filterFormat}`;

        const res = await fetch(`/api/catalog/scryfall?q=${encodeURIComponent(scryfallQuery)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();

        const cards: MarketplaceCard[] = (data.cards || []).map((card: Record<string, unknown>) => ({
          id: card.scryfall_id as string,
          name: card.name as string,
          set_name: card.set_name as string,
          set_code: card.set_code as string,
          collector_number: card.collector_number as string,
          rarity: (card.rarity as string) || null,
          price_usd: (card.price_usd as string) || null,
          price_usd_foil: (card.price_usd_foil as string) || null,
          image_url: (card.image_url as string) || null,
          small_image_url: (card.small_image_url as string) || (card.image_url as string) || null,
          foil: (card.foil as boolean) || false,
          nonfoil: (card.nonfoil as boolean) ?? true,
          type_line: (card.type_line as string) || "",
          mana_cost: (card.mana_cost as string) || "",
        }));

        setResults(cards);
        setTotal(data.total || 0);

        if (cards.length > 0) {
          const ids = cards.map((c) => `scryfall:${c.id}`);
          try {
            const invRes = await fetch(`/api/catalog/scryfall/check?ids=${encodeURIComponent(JSON.stringify(ids))}`);
            if (invRes.ok) {
              const existing: string[] = await invRes.json();
              await crossReferenceByNames(cards, new Set(existing));
            }
          } catch {
            // Non-critical
          }
        }
      }
    } catch {
      setError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, gameTab, filterSet, filterColor, filterRarity, filterFormat]);

  async function crossReferenceInventory(cards: MarketplaceCard[]) {
    if (cards.length === 0) return;
    const uniqueNames = [...new Set(cards.map((c) => c.name))];
    const map = new Map<string, { qty: number; id: string }>();

    for (const name of uniqueNames.slice(0, 10)) {
      try {
        const res = await fetch(`/api/singles?search=${encodeURIComponent(name)}&limit=5&stats=false`);
        if (res.ok) {
          const data = await res.json();
          for (const item of data.items || []) {
            const key = (item.name as string).toLowerCase().replace(/\s*\(foil\)\s*$/i, "");
            if (!map.has(key) || (map.get(key)!.qty < (item.quantity as number))) {
              map.set(key, { qty: item.quantity as number, id: item.id as string });
            }
          }
        }
      } catch {
        // Non-critical
      }
    }
    setExistingIds(map);
  }

  async function crossReferenceByNames(cards: MarketplaceCard[], _existingExternalIds: Set<string>) {
    const map = new Map<string, { qty: number; id: string }>();
    const uniqueNames = [...new Set(cards.map((c) => c.name))];
    for (const name of uniqueNames.slice(0, 10)) {
      try {
        const res = await fetch(`/api/singles?search=${encodeURIComponent(name)}&limit=5&stats=false`);
        if (res.ok) {
          const data = await res.json();
          for (const item of data.items || []) {
            const key = (item.name as string).toLowerCase().replace(/\s*\(foil\)\s*$/i, "");
            const existing = map.get(key);
            const itemQty = item.quantity as number;
            if (!existing || existing.qty < itemQty) {
              map.set(key, { qty: itemQty, id: item.id as string });
            }
          }
        }
      } catch {
        // Non-critical
      }
    }
    setExistingIds(map);
  }

  function getInStockInfo(card: MarketplaceCard): { qty: number; id: string } | null {
    const key = card.name.toLowerCase().replace(/\s*\(foil\)\s*$/i, "");
    return existingIds.get(key) || null;
  }

  function openAddForm(card: MarketplaceCard) {
    const defaultFoil = !card.nonfoil && card.foil;
    const priceStr = defaultFoil ? card.price_usd_foil : card.price_usd;
    setAddForm({
      card,
      quantity: 1,
      cost: "",
      price: priceStr || "",
      condition: "NM",
      foil: defaultFoil,
    });
    setAddError(null);
  }

  async function handleAdd() {
    if (!addForm) return;
    setSubmitting(true);
    setAddError(null);

    try {
      const priceCents = addForm.price ? parseDollars(addForm.price) : 0;
      const costCents = addForm.cost ? parseDollars(addForm.cost) : 0;

      const isPokemon = gameTab === "pokemon";
      const isYuGiOh = gameTab === "yugioh";
      const endpoint = isPokemon ? "/api/catalog/pokemon" : isYuGiOh ? "/api/catalog/yugioh" : "/api/catalog/scryfall";
      const payload = isYuGiOh
        ? {
            yugioh_id: addForm.card.id,
            name: addForm.card.name,
            set_name: addForm.card.set_name,
            rarity: addForm.card.rarity,
            image_url: addForm.card.image_url,
            price_cents: priceCents,
            cost_cents: costCents,
            quantity: addForm.quantity,
            condition: addForm.condition,
          }
        : isPokemon
          ? {
              pokemon_id: addForm.card.id,
              name: addForm.card.name,
              set_name: addForm.card.set_name,
              number: addForm.card.collector_number,
              rarity: addForm.card.rarity,
              image_url: addForm.card.image_url,
              price_cents: priceCents,
              cost_cents: costCents,
              quantity: addForm.quantity,
              condition: addForm.condition,
            }
          : {
              scryfall_id: addForm.card.id,
              foil: addForm.foil,
              quantity: addForm.quantity,
              cost_cents: costCents,
              condition: addForm.condition,
              price_cents: priceCents,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add item");
      }

      const data = await res.json();
      showToast(data.message || `${addForm.card.name} added to inventory`);

      const key = addForm.card.name.toLowerCase().replace(/\s*\(foil\)\s*$/i, "");
      setExistingIds((prev) => {
        const next = new Map(prev);
        const existing = next.get(key);
        next.set(key, {
          qty: (existing?.qty || 0) + addForm.quantity,
          id: existing?.id || data.item?.id || "",
        });
        return next;
      });

      setAddForm(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Game Pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(["mtg", "pokemon", "yugioh"] as MarketplaceGame[]).map((g) => {
          const isActive = gameTab === g;
          return (
            <button
              key={g}
              onClick={() => {
                setGameTab(g);
                setResults([]);
                setSearched(false);
                setExistingIds(new Map());
              }}
              className="font-mono uppercase font-semibold inline-flex items-center gap-2 transition-colors"
              style={{
                fontSize: "0.66rem",
                letterSpacing: "0.18em",
                padding: "0 1rem",
                minHeight: 44,
                background: isActive ? "var(--orange-mute)" : "var(--panel-mute)",
                border: `1px solid ${isActive ? "var(--orange)" : "var(--rule-hi)"}`,
                color: isActive ? "var(--orange)" : "var(--ink-soft)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  background: "currentColor",
                  clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                }}
              />
              {g === "mtg" ? "Magic: The Gathering" : g === "pokemon" ? "Pokemon" : "Yu-Gi-Oh"}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
          style={{ width: 16, height: 16 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.5-4.5" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") doSearch();
          }}
          placeholder={
            gameTab === "mtg"
              ? "Search MTG cards on Scryfall…"
              : gameTab === "pokemon"
                ? "Search Pokemon cards…"
                : "Search Yu-Gi-Oh cards…"
          }
          autoFocus
          className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--rule-hi)",
            fontSize: "0.95rem",
            padding: "0 6.5rem 0 2.4rem",
            minHeight: 48,
          }}
        />
        <button
          onClick={() => doSearch()}
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 font-mono uppercase font-semibold transition-opacity disabled:opacity-50"
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.16em",
            padding: "0 0.85rem",
            minHeight: 36,
            background: "var(--orange)",
            color: "var(--void)",
            border: "1px solid var(--orange)",
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      {/* Advanced Filters (MTG) */}
      {gameTab === "mtg" && (
        <div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="font-mono uppercase transition-colors hover:text-ink"
            style={{ fontSize: "0.62rem", letterSpacing: "0.16em", color: showFilters ? "var(--orange)" : "var(--ink-soft)", minHeight: 36, padding: "0 0.5rem" }}
          >
            {showFilters ? "Hide Filters ▲" : "Advanced Filters ▼"}
          </button>
          {showFilters && (
            <div
              className="mt-2 grid grid-cols-2 md:grid-cols-4"
              style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
            >
              {[
                {
                  label: "Set Code",
                  el: (
                    <input
                      type="text"
                      value={filterSet}
                      onChange={(e) => setFilterSet(e.target.value.toLowerCase())}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="mh3"
                      className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none bg-transparent"
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0", border: "none" }}
                    />
                  ),
                },
                {
                  label: "Color",
                  el: (
                    <select
                      value={filterColor}
                      onChange={(e) => setFilterColor(e.target.value)}
                      className="w-full font-mono text-ink focus:outline-none bg-transparent"
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0", border: "none" }}
                    >
                      <option value="">Any</option>
                      <option value="w">White</option>
                      <option value="u">Blue</option>
                      <option value="b">Black</option>
                      <option value="r">Red</option>
                      <option value="g">Green</option>
                      <option value="c">Colorless</option>
                      <option value="m">Multicolor</option>
                    </select>
                  ),
                },
                {
                  label: "Rarity",
                  el: (
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value)}
                      className="w-full font-mono text-ink focus:outline-none bg-transparent"
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0", border: "none" }}
                    >
                      <option value="">Any</option>
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="mythic">Mythic</option>
                    </select>
                  ),
                },
                {
                  label: "Format",
                  el: (
                    <select
                      value={filterFormat}
                      onChange={(e) => setFilterFormat(e.target.value)}
                      className="w-full font-mono text-ink focus:outline-none bg-transparent"
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0", border: "none" }}
                    >
                      <option value="">Any</option>
                      <option value="standard">Standard</option>
                      <option value="pioneer">Pioneer</option>
                      <option value="modern">Modern</option>
                      <option value="legacy">Legacy</option>
                      <option value="commander">Commander</option>
                      <option value="pauper">Pauper</option>
                    </select>
                  ),
                },
              ].map((f) => (
                <div key={f.label} className="px-3 py-2" style={{ background: "var(--panel-mute)" }}>
                  <div
                    className="font-mono uppercase font-semibold text-ink-faint mb-1"
                    style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                  >
                    {f.label}
                  </div>
                  {f.el}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Condition multipliers reference */}
      <div className="flex items-center gap-3 flex-wrap font-mono uppercase text-ink-faint" style={{ fontSize: "0.6rem", letterSpacing: "0.16em" }}>
        <span className="font-semibold">Condition multipliers</span>
        {CONDITIONS.map((c) => (
          <span key={c} className="tabular-nums text-ink-soft">
            {c} {Math.round(CONDITION_MULTIPLIERS[c] * 100)}%
          </span>
        ))}
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
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-12 font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
        >
          <Spinner />
          Searching…
        </div>
      )}

      {/* Results info */}
      {searched && !loading && (
        <div
          className="font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.66rem", letterSpacing: "0.16em" }}
        >
          {results.length === 0
            ? "No cards found · try a different search"
            : `Showing ${results.length} of ${total.toLocaleString()} results`}
        </div>
      )}

      {/* Results Grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((card) => {
            const stockInfo = getInStockInfo(card);
            const rarityTone = card.rarity ? RARITY_TONE[card.rarity.toLowerCase()] || "var(--ink-soft)" : "var(--ink-soft)";

            return (
              <div
                key={`${card.id}-${card.set_code}`}
                style={{
                  background: "var(--panel-mute)",
                  border: "1px solid var(--rule-hi)",
                  overflow: "hidden",
                }}
              >
                {/* Card Image */}
                {card.image_url ? (
                  <div className="relative" style={{ aspectRatio: "488/680", background: "var(--panel)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image_url}
                      alt={card.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    {stockInfo && stockInfo.qty > 0 && (
                      <Link
                        href={`/dashboard/inventory/${stockInfo.id}`}
                        className="absolute font-mono uppercase font-semibold transition-colors"
                        style={{
                          top: 8,
                          right: 8,
                          padding: "2px 8px",
                          fontSize: "0.6rem",
                          letterSpacing: "0.16em",
                          background: "var(--teal)",
                          color: "var(--void)",
                          border: "1px solid var(--teal)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        In Stock · {stockInfo.qty}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center font-mono uppercase text-ink-faint"
                    style={{ aspectRatio: "488/680", background: "var(--panel)", fontSize: "0.66rem", letterSpacing: "0.18em" }}
                  >
                    No Image
                  </div>
                )}

                {/* Card Info */}
                <div className="p-3 space-y-2">
                  <div>
                    <h3
                      className="font-display text-ink"
                      style={{ fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.15, letterSpacing: "0.005em" }}
                    >
                      {card.name}
                    </h3>
                    <p
                      className="font-mono text-ink-faint mt-0.5 truncate"
                      style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
                    >
                      {card.set_name}
                      {card.collector_number && (
                        <span className="text-ink-ghost"> · #{card.collector_number}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {card.rarity && (
                      <span
                        className="font-mono uppercase font-semibold"
                        style={{
                          fontSize: "0.55rem",
                          letterSpacing: "0.18em",
                          padding: "1px 6px",
                          background: "var(--panel)",
                          border: "1px solid var(--rule-hi)",
                          color: rarityTone,
                        }}
                      >
                        {card.rarity}
                      </span>
                    )}
                    <div className="text-right font-mono">
                      {card.price_usd && (
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: "var(--teal)", fontSize: "0.85rem", letterSpacing: "0.02em" }}
                        >
                          ${card.price_usd}
                        </span>
                      )}
                      {card.price_usd_foil && (
                        <span
                          className="ml-2 tabular-nums"
                          style={{ color: "var(--yellow)", fontSize: "0.66rem", letterSpacing: "0.04em" }}
                        >
                          ✦${card.price_usd_foil}
                        </span>
                      )}
                      {!card.price_usd && !card.price_usd_foil && (
                        <span className="font-mono text-ink-faint" style={{ fontSize: "0.66rem" }}>
                          No price
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add button */}
                  {canFn("inventory.adjust") && (
                    <button
                      onClick={() => openAddForm(card)}
                      className="w-full font-mono uppercase font-semibold transition-opacity"
                      style={{
                        fontSize: "0.66rem",
                        letterSpacing: "0.18em",
                        padding: "0 0.85rem",
                        minHeight: 44,
                        background: "var(--orange)",
                        color: "var(--void)",
                        border: "1px solid var(--orange)",
                      }}
                    >
                      {stockInfo && stockInfo.qty > 0
                        ? "Add More to Inventory"
                        : "Add to Inventory"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !searched && (
        <div
          className="text-center px-6 py-16"
          style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
        >
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              margin: "0 auto 0.75rem",
              background: "var(--orange-mute)",
              border: "1px solid var(--orange)",
              clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
            }}
          />
          <p
            className="font-display text-ink"
            style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.005em" }}
          >
            Search external card databases
          </p>
          <p className="font-mono text-ink-soft mt-2" style={{ fontSize: "0.78rem" }}>
            Find market prices and add cards to inventory.
          </p>
          <p className="font-mono text-ink-faint mt-1" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
            Powered by Scryfall · Pokemon TCG · YGOPRODeck
          </p>
        </div>
      )}

      {/* Add to Inventory Modal */}
      {addForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "var(--overlay-bg)" }}
          onClick={() => { setAddForm(null); setAddError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setAddForm(null); setAddError(null); }
          }}
        >
          <div
            className="w-full max-w-lg shadow-2xl"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--rule-hi)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
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
                  Marketplace · Add
                </div>
                <div
                  className="font-display text-ink mt-0.5"
                  style={{ fontSize: "1.15rem", fontWeight: 600, letterSpacing: "0.005em", lineHeight: 1 }}
                >
                  Add to Inventory
                </div>
              </div>
              <button
                onClick={() => { setAddForm(null); setAddError(null); }}
                aria-label="Close"
                className="flex items-center justify-center text-ink-soft hover:text-orange transition-colors"
                style={{ width: 44, height: 44, border: "1px solid var(--rule-hi)", background: "var(--panel-mute)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <div className="flex gap-4 mb-5">
                {addForm.card.small_image_url && (
                  <div className="shrink-0" style={{ width: 96 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={addForm.card.small_image_url}
                      alt={addForm.card.name}
                      className="w-full"
                      style={{ border: "1px solid var(--rule-hi)" }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-ink" style={{ fontSize: "1.05rem", fontWeight: 500, lineHeight: 1.1 }}>
                    {addForm.card.name}
                  </h3>
                  <p className="font-mono text-ink-faint mt-1" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                    {addForm.card.set_name}
                  </p>
                  {addForm.card.collector_number && (
                    <p className="font-mono text-ink-faint mt-0.5" style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}>
                      #{addForm.card.collector_number}
                      {addForm.card.rarity && (
                        <span style={{ color: RARITY_TONE[addForm.card.rarity.toLowerCase()] || "var(--ink-soft)", fontWeight: 600 }}>
                          {" · "}{addForm.card.rarity}
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {addForm.card.price_usd && (
                      <span className="font-mono" style={{ color: "var(--teal)", fontSize: "0.72rem" }}>
                        Market ${addForm.card.price_usd}
                      </span>
                    )}
                    {addForm.card.price_usd_foil && (
                      <span className="font-mono" style={{ color: "var(--yellow)", fontSize: "0.72rem" }}>
                        Foil ${addForm.card.price_usd_foil}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {addError && (
                <div
                  className="mb-3 px-3 py-2 font-mono"
                  style={{
                    background: "var(--red-mute)",
                    border: "1px solid var(--red)",
                    color: "var(--red)",
                    fontSize: "0.74rem",
                  }}
                >
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Quantity", el: (
                    <input
                      type="number"
                      min={1}
                      value={addForm.quantity}
                      onChange={(e) => setAddForm({ ...addForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full font-mono text-ink focus:outline-none"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)", padding: "0 0.85rem", minHeight: 44, fontSize: "0.92rem" }}
                    />
                  )},
                  { label: "Cost ($)", el: (
                    <input
                      type="text"
                      value={addForm.cost}
                      onChange={(e) => setAddForm({ ...addForm, cost: e.target.value })}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="What you paid"
                      className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)", padding: "0 0.85rem", minHeight: 44, fontSize: "0.92rem" }}
                    />
                  )},
                  { label: "Sell Price ($)", el: (
                    <input
                      type="text"
                      value={addForm.price}
                      onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="0.00"
                      className="w-full font-mono text-ink placeholder:text-ink-faint focus:outline-none"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)", padding: "0 0.85rem", minHeight: 44, fontSize: "0.92rem" }}
                    />
                  )},
                  { label: "Condition", el: (
                    <select
                      value={addForm.condition}
                      onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
                      className="w-full font-mono text-ink focus:outline-none"
                      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule-hi)", padding: "0 0.85rem", minHeight: 44, fontSize: "0.92rem" }}
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )},
                ].map((f) => (
                  <div key={f.label}>
                    <label
                      className="block font-mono uppercase font-semibold text-ink-faint mb-1.5"
                      style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
                    >
                      {f.label}
                    </label>
                    {f.el}
                  </div>
                ))}
              </div>

              {/* Foil toggle (MTG only) */}
              {gameTab === "mtg" && (
                <label
                  className="flex items-center gap-2 cursor-pointer mb-5 font-mono uppercase"
                  style={{ fontSize: "0.66rem", letterSpacing: "0.18em", color: "var(--ink-soft)" }}
                >
                  <input
                    type="checkbox"
                    checked={addForm.foil}
                    onChange={(e) => {
                      const foil = e.target.checked;
                      const priceStr = foil ? addForm.card.price_usd_foil : addForm.card.price_usd;
                      setAddForm({ ...addForm, foil, price: priceStr || addForm.price });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    disabled={addForm.foil ? !addForm.card.nonfoil : !addForm.card.foil}
                    style={{ width: 18, height: 18, accentColor: "var(--orange)" }}
                  />
                  Foil
                  {addForm.foil && (
                    <span style={{ color: "var(--yellow)", letterSpacing: "0.04em", fontSize: "0.68rem", textTransform: "none" }}>
                      · foil pricing applied
                    </span>
                  )}
                </label>
              )}

              <div className="grid grid-cols-2" style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}>
                <button
                  onClick={() => { setAddForm(null); setAddError(null); }}
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
                  onClick={handleAdd}
                  disabled={submitting}
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
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size={16} />
                      Adding…
                    </span>
                  ) : "Add to Inventory"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sort Header                                                        */
/* ================================================================== */

function SortHeader({
  field,
  label,
  sort,
  onSort,
  indicator,
  align = "left",
  className = "",
}: {
  field: SortField;
  label: string;
  sort: SortState;
  onSort: (field: SortField) => void;
  indicator: (field: SortField) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = sort?.field === field;
  return (
    <th
      className={`px-3 py-2.5 font-mono uppercase font-semibold cursor-pointer select-none transition-colors ${
        isActive ? "text-ink" : "text-ink-faint hover:text-ink"
      } ${align === "right" ? "text-right" : "text-left"} ${className}`}
      onClick={() => onSort(field)}
      style={{ fontSize: "0.55rem", letterSpacing: "0.22em" }}
    >
      {label}
      {indicator(field)}
    </th>
  );
}

/* ================================================================== */
/*  Foil Tag                                                           */
/* ================================================================== */

function FoilTag() {
  return (
    <span
      className="font-mono uppercase font-semibold inline-flex items-center"
      style={{
        padding: "1px 5px",
        fontSize: "0.5rem",
        letterSpacing: "0.16em",
        color: "var(--yellow)",
        background: "var(--yellow-mute)",
        border: "1px solid rgba(251,219,101,0.35)",
      }}
    >
      F
    </span>
  );
}

/* ================================================================== */
/*  Empty State                                                        */
/* ================================================================== */

function EmptyInventory() {
  return (
    <div
      className="space-y-6 py-8 px-6"
      style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
    >
      <div className="text-center space-y-2">
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            margin: "0 auto 0.5rem",
            background: "var(--orange-mute)",
            border: "1px solid var(--orange)",
            clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
          }}
        />
        <h2 className="font-display text-ink" style={{ fontSize: "1.2rem", fontWeight: 600, letterSpacing: "0.005em" }}>
          No TCG singles in inventory yet
        </h2>
        <p className="font-mono text-ink-soft max-w-md mx-auto" style={{ fontSize: "0.78rem" }}>
          TCG singles are cards from games like Magic: The Gathering, Pokemon, and Yu-Gi-Oh. Add them from the Marketplace tab or scan barcodes.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
        {[
          { href: "/dashboard/catalog", title: "Search Catalog", desc: "Browse the full catalog" },
          { href: "/dashboard/import", title: "Bulk Import", desc: "Upload a CSV or spreadsheet" },
          { href: "/dashboard/catalog?scan=1", title: "Scan a Card", desc: "Use your camera or scanner" },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="ar-stripe flex flex-col items-center text-center gap-2 p-5 transition-colors hover:bg-panel"
            style={{ background: "var(--panel)", border: "1px solid var(--rule-hi)" }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "var(--orange)",
                clipPath: "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
              }}
            />
            <span className="font-display text-ink" style={{ fontSize: "0.92rem", fontWeight: 600 }}>
              {c.title}
            </span>
            <span className="font-mono text-ink-faint" style={{ fontSize: "0.66rem", letterSpacing: "0.02em" }}>
              {c.desc}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
