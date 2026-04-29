"use client";

/**
 * Catalog lookup widget for the inventory edit page.
 *
 * Shows category-appropriate "Lookup from <source>" buttons. Each opens a
 * search dialog backed by the adapter at /api/integrations/[id]/search.
 * Picking a result prefills the form's name, image, and category-specific
 * attributes via the onApply callback.
 *
 * Sources are filtered by the registry's `categories` field — if you're
 * editing a comic, you see ComicVine + Open Library; if you're editing
 * a TCG single, you see Scryfall + Pokemon TCG. The integrations
 * dashboard reflects the same registry.
 */

import { useCallback, useEffect, useState } from "react";
import type { ItemCategory } from "@/lib/types";
import { useEnabledModules } from "@/hooks/use-enabled-modules";

interface IntegrationLite {
  id: string;
  name: string;
  status: string;
  capabilities: { search?: boolean; lookup?: boolean };
}

interface SearchResult {
  external_id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  preview?: CatalogRecord;
}

interface CatalogRecord {
  external_id: string;
  name: string;
  category: string;
  barcode?: string;
  image_url?: string;
  msrp_cents?: number;
  market_price_cents?: number;
  attributes: Record<string, unknown>;
  external_ids: Record<string, string>;
}

interface Props {
  category: ItemCategory;
  onApply: (record: CatalogRecord) => void;
}

export function CatalogLookup({ category, onApply }: Props) {
  const [available, setAvailable] = useState<IntegrationLite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { isIntegrationEnabled } = useEnabledModules();

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : { integrations: [] }))
      .then((data) => {
        const list: IntegrationLite[] = (data.integrations ?? []).filter(
          (i: {
            id: string;
            categories: string[];
            active: boolean;
            capabilities: { search?: boolean };
          }) =>
            i.active &&
            i.capabilities.search &&
            i.categories.includes(category) &&
            // Per-store vertical-module gating: hide an integration when
            // every product line that owns it is disabled for this store.
            isIntegrationEnabled(i.id),
        );
        setAvailable(list);
      })
      .catch(() => setAvailable([]));
  }, [category, isIntegrationEnabled]);

  if (available.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-card-border bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-mono uppercase text-ink-faint"
          style={{ fontSize: "0.62rem", letterSpacing: "0.18em", fontWeight: 600 }}
        >
          Lookup from catalog
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {available.map((i) => {
          const ok = i.status === "ok" || i.status === "untested";
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setActiveId(i.id)}
              disabled={!ok}
              className="font-mono uppercase border px-2.5 py-1 transition-colors disabled:opacity-30"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                borderColor: i.status === "ok" ? "var(--teal)" : "var(--rule)",
                color: i.status === "ok" ? "var(--teal)" : "var(--ink-soft)",
              }}
              title={i.status !== "ok" && i.status !== "untested" ? `${i.name} status: ${i.status}` : ""}
            >
              {i.name}
              {i.status === "unconfigured" && " (needs key)"}
            </button>
          );
        })}
      </div>

      {activeId && (
        <SearchDialog
          integrationId={activeId}
          integrationName={available.find((i) => i.id === activeId)?.name ?? ""}
          onClose={() => setActiveId(null)}
          onApply={(record) => {
            onApply(record);
            setActiveId(null);
          }}
        />
      )}
    </div>
  );
}

function SearchDialog({
  integrationId,
  integrationName,
  onClose,
  onApply,
}: {
  integrationId: string;
  integrationName: string;
  onClose: () => void;
  onApply: (record: CatalogRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/${integrationId}/search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Search failed (${res.status})`);
        return;
      }
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, integrationId]);

  async function pick(r: SearchResult) {
    if (r.preview) {
      onApply(r.preview);
      return;
    }
    setPicking(r.external_id);
    try {
      const res = await fetch(
        `/api/integrations/${integrationId}/lookup?ext_id=${encodeURIComponent(r.external_id)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.record) {
        setError(data.error ?? "Lookup failed");
        return;
      }
      onApply(data.record);
    } finally {
      setPicking(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule)",
          maxWidth: "32rem",
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}>
            {integrationName} lookup
          </h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-xl">×</button>
        </div>
        <div className="p-3 border-b border-rule">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder="Search by name…"
              className="flex-1 rounded-md border border-input-border bg-input-bg px-3 py-1.5 text-sm text-foreground"
            />
            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
              style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-xs" style={{ color: "var(--red)" }}>
              {error}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && !searching ? (
            <p className="p-4 text-xs text-ink-faint">No results yet — type a query and hit Search.</p>
          ) : (
            <div className="divide-y divide-rule">
              {results.map((r) => (
                <button
                  key={r.external_id}
                  type="button"
                  onClick={() => pick(r)}
                  disabled={picking === r.external_id}
                  className="w-full text-left px-3 py-2 hover:bg-card-hover disabled:opacity-50 flex items-center gap-3"
                >
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt=""
                      className="w-10 h-10 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded shrink-0 bg-input-bg" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{r.title}</div>
                    {r.subtitle && (
                      <div className="text-[10px] text-ink-faint truncate">{r.subtitle}</div>
                    )}
                  </div>
                  {picking === r.external_id && (
                    <span className="text-[10px] text-ink-soft">…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
