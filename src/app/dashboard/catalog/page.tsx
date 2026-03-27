"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/lib/store-context";
import { formatCents, parseDollars } from "@/lib/types";

interface CatalogCard {
  scryfall_id: string;
  name: string;
  set_name: string;
  set_code: string;
  collector_number: string;
  rarity: string;
  price_usd: string | null;
  price_usd_foil: string | null;
  image_url: string | null;
  small_image_url: string | null;
  foil: boolean;
  nonfoil: boolean;
  type_line: string;
  mana_cost: string;
}

interface AddModalState {
  card: CatalogCard;
  quantity: number;
  cost: string;
  price: string;
  condition: string;
  foil: boolean;
}

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;

const RARITY_COLORS: Record<string, string> = {
  common: "text-muted",
  uncommon: "text-slate-300",
  rare: "text-amber-400",
  mythic: "text-orange-500",
  special: "text-purple-400",
  bonus: "text-purple-400",
};

const RARITY_BG: Record<string, string> = {
  common: "bg-card-hover",
  uncommon: "bg-slate-800",
  rare: "bg-amber-900/40",
  mythic: "bg-orange-900/40",
  special: "bg-purple-900/40",
  bonus: "bg-purple-900/40",
};

export default function CatalogPage() {
  const { can } = useStore();

  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Existing external_ids in inventory for "Already in inventory" badges
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  // Add modal
  const [addModal, setAddModal] = useState<AddModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Search Scryfall
  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;

    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/catalog/scryfall?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) {
        throw new Error("Search failed");
      }
      const data = await res.json();
      setCards(data.cards || []);
      setTotal(data.total || 0);

      // Check which cards already exist in our inventory
      if (data.cards && data.cards.length > 0) {
        const ids = data.cards.map(
          (c: CatalogCard) => `scryfall:${c.scryfall_id}`
        );
        try {
          const invRes = await fetch(
            `/api/catalog/scryfall/check?ids=${encodeURIComponent(JSON.stringify(ids))}`
          );
          if (invRes.ok) {
            const existing = await invRes.json();
            setExistingIds(new Set(existing));
          }
        } catch {
          // Non-critical, ignore
        }
      }
    } catch {
      setError("Failed to search Scryfall. Please try again.");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Debounced search on Enter or after typing pause
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  // Open add modal
  const openAddModal = (card: CatalogCard) => {
    const defaultFoil = !card.nonfoil && card.foil;
    const priceStr = defaultFoil
      ? card.price_usd_foil
      : card.price_usd;

    setAddModal({
      card,
      quantity: 1,
      cost: "",
      price: priceStr || "",
      condition: "NM",
      foil: defaultFoil,
    });
    setError(null);
  };

  // Handle foil toggle in modal (update price)
  const handleFoilToggle = (foil: boolean) => {
    if (!addModal) return;
    const priceStr = foil
      ? addModal.card.price_usd_foil
      : addModal.card.price_usd;
    setAddModal({
      ...addModal,
      foil,
      price: priceStr || addModal.price,
    });
  };

  // Submit add to inventory
  const handleAdd = useCallback(async () => {
    if (!addModal) return;

    setSubmitting(true);
    setError(null);

    try {
      const priceCents = addModal.price
        ? parseDollars(addModal.price)
        : 0;
      const costCents = addModal.cost ? parseDollars(addModal.cost) : 0;

      const res = await fetch("/api/catalog/scryfall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scryfall_id: addModal.card.scryfall_id,
          foil: addModal.foil,
          quantity: addModal.quantity,
          cost_cents: costCents,
          condition: addModal.condition,
          price_cents: priceCents,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to add item");
      }

      const data = await res.json();
      showToast(data.message);

      // Mark as existing
      const externalId = `scryfall:${addModal.card.scryfall_id}:${addModal.foil ? "foil" : "nonfoil"}`;
      setExistingIds((prev) => new Set([...prev, externalId]));

      setAddModal(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add item";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [addModal, showToast]);

  const isInInventory = (card: CatalogCard) => {
    return (
      existingIds.has(`scryfall:${card.scryfall_id}:foil`) ||
      existingIds.has(`scryfall:${card.scryfall_id}:nonfoil`)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="hidden md:block text-2xl font-semibold text-foreground">Catalog</h1>
        <p className="text-sm text-muted mt-1">
          Search external product databases and add items to inventory
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Search MTG cards on Scryfall..."
          autoFocus
          className="w-full rounded-xl border border-input-border bg-card px-5 py-3 text-lg text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Results info */}
      {searched && !loading && (
        <div className="text-sm text-muted">
          {cards.length === 0
            ? "No cards found. Try a different search."
            : `Showing ${cards.length} of ${total.toLocaleString()} results`}
        </div>
      )}

      {/* Error */}
      {error && !addModal && (
        <div className="rounded-md bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-muted py-12">
          Searching Scryfall...
        </div>
      )}

      {/* Card Grid */}
      {!loading && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={`${card.scryfall_id}-${card.set_code}`}
              className="rounded-xl border border-card-border bg-card overflow-hidden hover:border-zinc-600 transition-colors"
            >
              {/* Card Image */}
              {card.image_url ? (
                <div className="relative aspect-[488/680] bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  {isInInventory(card) && (
                    <div className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-foreground shadow">
                      In Inventory
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[488/680] bg-background flex items-center justify-center text-zinc-600 text-sm">
                  No Image
                </div>
              )}

              {/* Card Info */}
              <div className="p-3 space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">
                    {card.name}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {card.set_name}{" "}
                    <span className="text-zinc-600">#{card.collector_number}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium capitalize ${
                      RARITY_BG[card.rarity] || "bg-card-hover"
                    } ${RARITY_COLORS[card.rarity] || "text-muted"}`}
                  >
                    {card.rarity}
                  </span>

                  <div className="text-right">
                    {card.price_usd && (
                      <span className="text-sm font-medium text-emerald-400">
                        ${card.price_usd}
                      </span>
                    )}
                    {card.price_usd_foil && (
                      <span className="ml-2 text-xs text-yellow-400">
                        Foil ${card.price_usd_foil}
                      </span>
                    )}
                    {!card.price_usd && !card.price_usd_foil && (
                      <span className="text-xs text-muted">No price</span>
                    )}
                  </div>
                </div>

                {/* Add button */}
                {can("inventory.adjust") && (
                  <button
                    onClick={() => openAddModal(card)}
                    className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-foreground hover:opacity-90 transition-colors"
                  >
                    {isInInventory(card)
                      ? "Update Inventory"
                      : "Add to Inventory"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !searched && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-30">&#x2318;</div>
          <p className="text-muted text-sm">
            Search for MTG cards by name, set, or collector number.
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Powered by Scryfall -- 80,000+ unique cards
          </p>
        </div>
      )}

      {/* Add to Inventory Modal */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-bg"
          onClick={() => {
            setAddModal(null);
            setError(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-card-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Add to Inventory
            </h2>

            <div className="flex gap-4 mb-5">
              {/* Card image */}
              {addModal.card.small_image_url && (
                <div className="flex-shrink-0 w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={addModal.card.small_image_url}
                    alt={addModal.card.name}
                    className="w-full rounded"
                  />
                </div>
              )}

              {/* Card details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-foreground font-semibold text-sm">
                  {addModal.card.name}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {addModal.card.set_name}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  #{addModal.card.collector_number} --{" "}
                  <span className="capitalize">{addModal.card.rarity}</span>
                </p>
                {addModal.card.type_line && (
                  <p className="text-xs text-muted mt-1">
                    {addModal.card.type_line}
                  </p>
                )}
                <div className="mt-2 flex gap-3">
                  {addModal.card.price_usd && (
                    <span className="text-xs text-emerald-400">
                      Market: ${addModal.card.price_usd}
                    </span>
                  )}
                  {addModal.card.price_usd_foil && (
                    <span className="text-xs text-yellow-400">
                      Foil: ${addModal.card.price_usd_foil}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-400">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={addModal.quantity}
                  onChange={(e) =>
                    setAddModal({
                      ...addModal,
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              {/* Cost */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Cost ($)
                </label>
                <input
                  type="text"
                  value={addModal.cost}
                  onChange={(e) =>
                    setAddModal({ ...addModal, cost: e.target.value })
                  }
                  className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="What you paid"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Sell Price ($)
                </label>
                <input
                  type="text"
                  value={addModal.price}
                  onChange={(e) =>
                    setAddModal({ ...addModal, price: e.target.value })
                  }
                  className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Condition
                </label>
                <select
                  value={addModal.condition}
                  onChange={(e) =>
                    setAddModal({ ...addModal, condition: e.target.value })
                  }
                  className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Foil toggle */}
            <div className="mb-5">
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={addModal.foil}
                  onChange={(e) => handleFoilToggle(e.target.checked)}
                  disabled={
                    addModal.foil
                      ? !addModal.card.nonfoil
                      : !addModal.card.foil
                  }
                  className="rounded border-input-border bg-background text-indigo-600 focus:ring-indigo-500"
                />
                Foil
                {addModal.foil && (
                  <span className="text-yellow-400 text-xs">(foil pricing applied)</span>
                )}
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAddModal(null);
                  setError(null);
                }}
                className="flex-1 rounded-md border border-input-border px-4 py-2 text-sm text-foreground/70 hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? "Adding..."
                  : isInInventory(addModal.card)
                    ? "Update Stock"
                    : "Add to Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-foreground shadow-lg animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
