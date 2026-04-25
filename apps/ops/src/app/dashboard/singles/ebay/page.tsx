"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCents } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { ConditionBadge, CardImage, PriceTag } from "@/components/tcg/shared";

/* ---------- types ---------- */

interface EbayItem {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  quantity: number;
  image_url: string | null;
  game: string | null;
  set_name: string | null;
  condition: string;
  foil: boolean;
  rarity: string | null;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  listed_on_ebay: boolean;
}

type FilterMode = "all" | "listed" | "unlisted";

const FILTER_MODES: Array<{ id: FilterMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "listed", label: "Listed" },
  { id: "unlisted", label: "Unlisted" },
];

/* ---------- component ---------- */

export default function EbayListingsPage() {
  const [items, setItems] = useState<EbayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listedCount, setListedCount] = useState(0);
  const [ebayConfigured, setEbayConfigured] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  // Actions
  const [listing, setListing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<{
    updated: number;
    removed: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState("");

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", filter);
      params.set("limit", "100");

      const res = await fetch(`/api/ebay/listings?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      setItems(data.items || []);
      setListedCount(data.listed_count || 0);
      setEbayConfigured(data.ebay_configured || false);
    } catch {
      setError("Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function listOnEbay(itemId: string) {
    setListing(itemId);
    setError("");

    try {
      const res = await fetch("/api/ebay/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_item_id: itemId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to list");
      }

      const result = await res.json();

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                listed_on_ebay: true,
                ebay_listing_id: result.listing_id,
                ebay_offer_id: result.offer_id,
              }
            : i
        )
      );
      setListedCount((c) => c + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list");
    } finally {
      setListing(null);
    }
  }

  async function removeFromEbay(itemId: string) {
    setRemoving(itemId);
    setError("");

    try {
      const res = await fetch("/api/ebay/listings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_item_id: itemId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove");
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                listed_on_ebay: false,
                ebay_listing_id: null,
                ebay_offer_id: null,
              }
            : i
        )
      );
      setListedCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemoving(null);
    }
  }

  async function syncAll() {
    setSyncing(true);
    setError("");
    setSyncReport(null);

    try {
      const res = await fetch("/api/ebay/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Sync failed");
      }

      const result = await res.json();
      setSyncReport({
        updated: result.updated,
        removed: result.removed,
        errors: result.errors || [],
      });

      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const listedItems = items.filter((i) => i.listed_on_ebay);
  const unlistedItems = items.filter((i) => !i.listed_on_ebay);
  const listedValueCents = listedItems.reduce((s, i) => s + i.price_cents * i.quantity, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8">
      <PageHeader
        title="eBay Listings"
        crumb="TCG · Singles"
        desc="Push singles to eBay, sync inventory, end listings — all from the operator console."
        backHref="/dashboard/singles"
        action={
          ebayConfigured ? (
            <button
              onClick={syncAll}
              disabled={syncing}
              className="font-mono uppercase font-semibold transition-opacity disabled:opacity-50"
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
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          ) : undefined
        }
      />

      {/* eBay not configured warning */}
      {!ebayConfigured && !loading && (
        <div
          className="p-4 font-mono"
          style={{
            background: "var(--yellow-mute)",
            border: "1px solid rgba(251,219,101,0.4)",
            color: "var(--yellow)",
            fontSize: "0.78rem",
          }}
        >
          <p
            className="font-semibold uppercase"
            style={{ letterSpacing: "0.16em", fontSize: "0.7rem" }}
          >
            eBay Not Connected
          </p>
          <p className="mt-1.5 text-ink-soft" style={{ fontSize: "0.78rem" }}>
            Set the <span className="font-mono text-ink">EBAY_USER_TOKEN</span>{" "}
            environment variable to enable eBay integration. You can still browse
            singles and prepare items for listing.
          </p>
        </div>
      )}

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

      {syncReport && (
        <div
          className="px-4 py-3 font-mono"
          style={{
            background: "var(--teal-mute)",
            border: "1px solid var(--teal)",
            color: "var(--teal)",
            fontSize: "0.78rem",
          }}
        >
          Sync complete · <b>{syncReport.updated}</b> updated · <b>{syncReport.removed}</b> removed
          {syncReport.errors.length > 0 && (
            <span className="ml-2" style={{ color: "var(--yellow)" }}>
              · {syncReport.errors.length} error{syncReport.errors.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Stat strip */}
      <div
        className="grid grid-cols-3"
        style={{ gap: 1, background: "var(--rule)", border: "1px solid var(--rule)" }}
      >
        {[
          { k: "Listed", v: listedCount.toLocaleString(), tone: listedCount > 0 ? "var(--orange)" : undefined },
          { k: "Available", v: unlistedItems.length.toLocaleString() },
          { k: "Listed Value", v: formatCents(listedValueCents), tone: "var(--teal)" },
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
                fontSize: "1rem",
                letterSpacing: "0.02em",
                color: cell.tone || "var(--ink)",
              }}
            >
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div
        className="flex"
        style={{ background: "var(--slate)", borderBottom: "1px solid var(--rule)" }}
      >
        {FILTER_MODES.map((m) => {
          const isActive = filter === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setFilter(m.id)}
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
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {loading ? (
        <div
          className="text-center py-12 font-mono uppercase text-ink-soft"
          style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }}
        >
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div
          className="text-center py-12 font-mono text-ink-soft"
          style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)", fontSize: "0.78rem" }}
        >
          No items found for this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Listed section */}
          {filter !== "unlisted" && listedItems.length > 0 && (
            <div className="space-y-2">
              {filter === "all" && (
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
                      background: "var(--orange)",
                      clipPath:
                        "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                    }}
                  />
                  Listed on eBay
                </div>
              )}
              <div
                style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
              >
                {listedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid var(--rule-faint)", minHeight: 72 }}
                  >
                    <CardImage src={item.image_url} alt={item.name} size="sm" game={item.game || undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-display text-ink truncate"
                          style={{ fontSize: "0.92rem", fontWeight: 500 }}
                        >
                          {item.name}
                        </span>
                        <ConditionBadge condition={item.condition} size="xs" />
                        {item.foil && (
                          <span
                            className="font-mono uppercase font-semibold inline-flex items-center"
                            style={{
                              padding: "1px 6px",
                              fontSize: "0.55rem",
                              letterSpacing: "0.16em",
                              color: "var(--yellow)",
                              background: "var(--yellow-mute)",
                              border: "1px solid rgba(251,219,101,0.35)",
                            }}
                          >
                            Foil
                          </span>
                        )}
                      </div>
                      <div
                        className="font-mono text-ink-faint mt-0.5"
                        style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
                      >
                        {item.set_name || ""}
                        {item.quantity > 1 && ` · Qty: ${item.quantity}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <PriceTag cents={item.price_cents} size="sm" />
                      <div className="flex items-center justify-end gap-2 mt-1">
                        {item.ebay_listing_id && (
                          <a
                            href={`https://www.ebay.com/itm/${item.ebay_listing_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono uppercase font-semibold transition-colors hover:underline"
                            style={{
                              fontSize: "0.6rem",
                              letterSpacing: "0.16em",
                              color: "var(--orange)",
                              padding: "0 0.5rem",
                              minHeight: 32,
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => removeFromEbay(item.id)}
                          disabled={removing === item.id}
                          className="font-mono uppercase font-semibold transition-colors disabled:opacity-50"
                          style={{
                            fontSize: "0.6rem",
                            letterSpacing: "0.16em",
                            color: "var(--red)",
                            padding: "0 0.5rem",
                            minHeight: 32,
                          }}
                        >
                          {removing === item.id ? "…" : "End"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unlisted section */}
          {filter !== "listed" && unlistedItems.length > 0 && (
            <div className="space-y-2">
              {filter === "all" && (
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
                      background: "var(--ink-soft)",
                      clipPath:
                        "polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)",
                    }}
                  />
                  Available to List
                </div>
              )}
              <div
                style={{ background: "var(--panel-mute)", border: "1px solid var(--rule)" }}
              >
                {unlistedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid var(--rule-faint)", minHeight: 72 }}
                  >
                    <CardImage src={item.image_url} alt={item.name} size="sm" game={item.game || undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-display text-ink truncate"
                          style={{ fontSize: "0.92rem", fontWeight: 500 }}
                        >
                          {item.name}
                        </span>
                        <ConditionBadge condition={item.condition} size="xs" />
                        {item.foil && (
                          <span
                            className="font-mono uppercase font-semibold inline-flex items-center"
                            style={{
                              padding: "1px 6px",
                              fontSize: "0.55rem",
                              letterSpacing: "0.16em",
                              color: "var(--yellow)",
                              background: "var(--yellow-mute)",
                              border: "1px solid rgba(251,219,101,0.35)",
                            }}
                          >
                            Foil
                          </span>
                        )}
                      </div>
                      <div
                        className="font-mono text-ink-faint mt-0.5"
                        style={{ fontSize: "0.66rem", letterSpacing: "0.04em" }}
                      >
                        {item.set_name || ""}
                        {item.quantity > 1 && ` · Qty: ${item.quantity}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <PriceTag cents={item.price_cents} size="sm" />
                      {ebayConfigured && (
                        <button
                          onClick={() => listOnEbay(item.id)}
                          disabled={listing === item.id}
                          className="mt-1 font-mono uppercase font-semibold transition-colors disabled:opacity-50"
                          style={{
                            fontSize: "0.62rem",
                            letterSpacing: "0.16em",
                            padding: "0 0.7rem",
                            minHeight: 36,
                            color: "var(--orange)",
                            background: "var(--orange-mute)",
                            border: "1px solid var(--orange)",
                          }}
                        >
                          {listing === item.id ? "Listing…" : "List on eBay"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
