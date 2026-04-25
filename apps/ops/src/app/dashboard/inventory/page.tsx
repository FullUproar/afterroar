"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { SubNav } from "@/components/ui/sub-nav";

const INVENTORY_TABS = [
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/catalog', label: 'Card Catalog' },
  { href: '/dashboard/deck-builder', label: 'Deck Builder' },
  { href: '/dashboard/trade-ins', label: 'Trade-Ins' },
  { href: '/dashboard/consignment', label: 'Consignment' },
];
import { useStore } from "@/lib/store-context";
import {
  InventoryItem,
  ItemCategory,
  formatCents,
  parseDollars,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { BarcodeLearnModal } from "@/components/barcode-learn-modal";
import { PrintLabelsModal } from "@/components/print-labels-modal";
import { useScanner } from "@/hooks/use-scanner";

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "tcg_single", label: "TCG Single" },
  { value: "sealed", label: "Sealed" },
  { value: "board_game", label: "Board Game" },
  { value: "miniature", label: "Miniature" },
  { value: "accessory", label: "Accessory" },
  { value: "food_drink", label: "Food & Drink" },
  { value: "other", label: "Other" },
];

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;

const ADJUSTMENT_REASONS = [
  "Received shipment",
  "Damaged/defective",
  "Physical count correction",
  "Theft/shrinkage",
  "Returned to supplier",
  "Other",
];

interface NewItemForm {
  name: string;
  category: ItemCategory;
  price: string;
  cost: string;
  quantity: number;
  barcode: string;
  condition: string;
  foil: boolean;
  language: string;
  set_name: string;
}

const EMPTY_FORM: NewItemForm = {
  name: "",
  category: "other",
  price: "",
  cost: "",
  quantity: 1,
  barcode: "",
  condition: "NM",
  foil: false,
  language: "English",
  set_name: "",
};

interface AdjustState {
  item: InventoryItem;
  type: "add" | "remove";
  amount: string;
  reason: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/*  Operator-Console form & control style helpers (inline so this     */
/*  file stays self-contained — these mirror tokens in globals.css).  */
/* ------------------------------------------------------------------ */
const inputStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--rule-hi)',
  color: 'var(--ink)',
  fontSize: '0.92rem',
  padding: '0.65rem 0.85rem',
  minHeight: 44,
  outline: 'none',
  width: '100%',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a8adb8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.7rem center',
  backgroundSize: 14,
  paddingRight: '2rem',
};

export default function InventoryPage() {
  const { can } = useStore();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NewItemForm>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  // Sorting
  type SortField = "name" | "price" | "quantity" | "category";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Stock adjustment modal
  const [adjust, setAdjust] = useState<AdjustState | null>(null);

  // Location breakdown
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showLocationBreakdown, setShowLocationBreakdown] = useState<string | null>(null);
  const [locationLevels, setLocationLevels] = useState<
    Array<{ location_id: string; location_name: string; quantity: number }>
  >([]);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Print labels modal
  const [showLabels, setShowLabels] = useState(false);

  // Shopify sync
  const [showShopifySync, setShowShopifySync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Scan to add
  const [showScanner, setShowScanner] = useState(false);
  const [learnBarcode, setLearnBarcode] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // USB/Bluetooth barcode scanner support (same as register)
  useScanner({
    onScan: (code) => handleInventoryScan(code),
    enabled: !showScanner && !learnBarcode && !showAddForm,
  });

  const loadInventory = useCallback(async () => {
    try {
      setLoadError(null);
      const [invRes, locRes] = await Promise.all([
        fetch(`/api/inventory?page=${page}&pageSize=${pageSize}`),
        fetch("/api/locations"),
      ]);
      if (!invRes.ok) {
        setLoadError("Failed to load inventory. Try again.");
        return;
      }
      const result = await invRes.json();
      setItems((result.data || result) as InventoryItem[]);
      if (result.total != null) setTotalItems(result.total);
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
      }
    } catch {
      setLoadError("Failed to load inventory. Try again.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/inventory/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to full list when search is cleared
  useEffect(() => {
    if (searchQuery.trim() === "") {
      loadInventory();
    }
  }, [searchQuery, loadInventory]);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          price_cents: parseDollars(form.price),
          cost_cents: parseDollars(form.cost),
          quantity: form.quantity,
          barcode: form.barcode.trim() || null,
          attributes: {
            condition: form.condition,
            foil: form.foil,
            language: form.language.trim() || "English",
            set_name: form.set_name.trim() || null,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create item");
      }

      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);
      setForm({ ...EMPTY_FORM });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const handleAdjustSubmit = useCallback(async () => {
    if (!adjust) return;

    const amount = parseInt(adjust.amount, 10);
    if (!amount || amount <= 0) {
      setAdjustError("Enter a valid amount greater than 0");
      return;
    }

    if (!adjust.reason) {
      setAdjustError("Please select a reason");
      return;
    }

    const adjustment = adjust.type === "add" ? amount : -amount;

    setAdjustSubmitting(true);
    setAdjustError(null);

    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: adjust.item.id,
          adjustment,
          reason: adjust.reason,
          notes: adjust.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to adjust stock");
      }

      const updatedItem = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
      );
      setAdjust(null);
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setAdjustSubmitting(false);
    }
  }, [adjust]);

  async function handleToggleCatalogShare(item: InventoryItem) {
    if (item.shared_to_catalog) {
      // Unshare: set shared_to_catalog = false, catalog_product_id = null
      try {
        const res = await fetch("/api/inventory/catalog-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventory_item_id: item.id,
            action: "unshare",
          }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, shared_to_catalog: false, catalog_product_id: null }
                : i
            )
          );
        }
      } catch {
        // Silently fail
      }
    } else {
      // Share to catalog
      try {
        const res = await fetch("/api/catalog/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inventory_item_id: item.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    shared_to_catalog: true,
                    catalog_product_id: data.catalog_product_id,
                  }
                : i
            )
          );
        }
      } catch {
        // Silently fail
      }
    }
  }

  async function handleToggleLendable(item: InventoryItem) {
    const newValue = !item.lendable;
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, lendable: newValue }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, lendable: newValue } : i))
        );
      }
    } catch {
      // Silently fail
    }
  }

  const getCategoryLabel = (cat: string) =>
    CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  /**
   * Returns CSS color for a stock quantity readout.
   * Operator-console palette:
   *   0 → red (out)
   *   1-3 → yellow (low)
   *   else → ink (ok)
   */
  const stockColor = (qty: number): string => {
    if (qty === 0) return 'var(--red)';
    if (qty <= 3) return 'var(--yellow)';
    return 'var(--ink)';
  };

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function getSortArrow(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  async function handleInventoryScan(code: string) {
    setShowScanner(false);
    setScanMessage(null);

    // Check if item already exists
    try {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data: InventoryItem[] = await res.json();
        const match = data.find((d) => d.barcode === code);
        if (match) {
          // Highlight existing item and filter to it
          setSearchQuery(code);
          setScanMessage(`✓ ${match.name} — ${match.quantity} in stock`);
          setTimeout(() => setScanMessage(null), 5000);
          return;
        }
      }
    } catch {}

    // Not found — open learn modal for UPC lookup + auto-fill
    setLearnBarcode(code);
  }

  const sortedItems = [...items].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "price":
        return dir * (a.price_cents - b.price_cents);
      case "quantity":
        return dir * (a.quantity - b.quantity);
      case "category":
        return dir * a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });

  /* -------- KPI strip data ------------------------------------- */
  const kpis = useMemo(() => {
    const inStock = items.filter((i) => i.quantity > 0);
    const outOfStock = items.filter((i) => i.quantity === 0).length;
    const lowStock = items.filter((i) => i.quantity > 0 && i.quantity <= 3).length;
    const stockValueCents = items.reduce((sum, i) => sum + i.cost_cents * i.quantity, 0);
    const sellThruCents = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
    return {
      uniqueSkus: items.length,
      inStockSkus: inStock.length,
      outOfStock,
      lowStock,
      stockValueCents,
      sellThruCents,
    };
  }, [items]);

  return (
    <div className="flex flex-col h-full gap-4 min-w-0">
      <SubNav items={INVENTORY_TABS} />
      <PageHeader
        title="Inventory"
        crumb="Console · Stock"
        desc="Every SKU, every shelf — the operator's truth source for what you have, what it costs, and what it sells for."
        action={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={() => setShowShopifySync(!showShopifySync)}
              className="hidden sm:inline-flex items-center font-mono uppercase transition-colors"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                padding: '0 0.85rem',
                minHeight: 44,
                color: 'var(--ink-soft)',
                border: '1px solid var(--rule-hi)',
                background: 'var(--panel)',
              }}
            >
              Shopify Sync
            </button>
            <button
              onClick={() => setShowLabels(true)}
              className="hidden sm:inline-flex items-center font-mono uppercase transition-colors"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                padding: '0 0.85rem',
                minHeight: 44,
                color: 'var(--ink-soft)',
                border: '1px solid var(--rule-hi)',
                background: 'var(--panel)',
              }}
            >
              Print Labels
            </button>
            <button
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center gap-2 font-mono uppercase transition-colors"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                padding: '0 0.85rem',
                minHeight: 44,
                color: 'var(--ink-soft)',
                border: '1px solid var(--rule-hi)',
                background: 'var(--panel)',
              }}
              title="Scanner listening"
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--teal)',
                  boxShadow: '0 0 6px var(--teal)',
                }}
              />
              <span className="hidden sm:inline">Scan to Add</span>
              <span className="sm:hidden">Scan</span>
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center font-display uppercase transition-colors"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                fontWeight: 700,
                padding: '0 1rem',
                minHeight: 48,
                color: showAddForm ? 'var(--ink)' : 'var(--void)',
                background: showAddForm ? 'transparent' : 'var(--orange)',
                border: showAddForm ? '1px solid var(--rule-hi)' : '1px solid var(--orange)',
              }}
            >
              {showAddForm ? "Cancel" : "Add Item"}
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <section
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px"
        style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}
      >
        <KpiCell
          k="Unique SKUs"
          v={(totalItems > 0 ? totalItems : kpis.uniqueSkus).toLocaleString()}
          primary
        />
        <KpiCell
          k="In Stock"
          v={kpis.inStockSkus.toLocaleString()}
          sub={kpis.uniqueSkus > 0 ? `${Math.round((kpis.inStockSkus / kpis.uniqueSkus) * 100)}% of catalog` : undefined}
        />
        <KpiCell
          k="Out of Stock"
          v={kpis.outOfStock.toLocaleString()}
          sub={kpis.outOfStock > 0 ? 'Re-order' : 'All stocked'}
          tone={kpis.outOfStock > 0 ? 'err' : 'ok'}
        />
        <KpiCell
          k="Low Stock (≤3)"
          v={kpis.lowStock.toLocaleString()}
          sub={kpis.lowStock > 0 ? 'Watch list' : '—'}
          tone={kpis.lowStock > 0 ? 'warn' : undefined}
        />
        <KpiCell
          k="Stock Value"
          v={formatCents(kpis.stockValueCents)}
          sub={`Sell-thru ${formatCents(kpis.sellThruCents)}`}
        />
      </section>

      {/* Shopify Sync Panel */}
      {showShopifySync && (
        <div
          className="ar-zone"
          style={{ borderColor: 'var(--rule)' }}
        >
          <div
            className="ar-zone-head"
            style={{ background: 'var(--slate)' }}
          >
            <span>Shopify Inventory Sync</span>
            <button
              onClick={() => setShowShopifySync(false)}
              className="font-mono uppercase text-ink-faint hover:text-ink transition-colors"
              style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <p className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
              Manage online allocation for all Shopify-linked items at once.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { action: "sync_from_shopify", label: "Sync from Shopify", desc: "Set allocations to match current Shopify quantities" },
                { action: "match_stock", label: "All Stock Online", desc: "Set allocation = full stock for every item" },
                { action: "zero_all", label: "Take All Offline", desc: "Set all allocations to 0" },
                { action: "push_all", label: "Push to Shopify", desc: "Push current allocations to Shopify" },
              ].map((btn) => (
                <button
                  key={btn.action}
                  onClick={async () => {
                    setSyncing(true);
                    setSyncResult(null);
                    try {
                      const res = await fetch("/api/inventory/shopify-sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: btn.action }),
                      });
                      const data = await res.json();
                      setSyncResult(res.ok ? `${btn.label}: ${data.updated ?? 0} items updated` : data.error);
                    } catch {
                      setSyncResult("Sync failed");
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  disabled={syncing}
                  title={btn.desc}
                  className={`inline-flex items-center font-mono uppercase transition-colors disabled:opacity-50 ${syncing ? "animate-pulse" : ""}`}
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                    padding: '0 0.9rem',
                    minHeight: 44,
                    color: 'var(--ink-soft)',
                    border: '1px solid var(--rule-hi)',
                    background: 'var(--panel)',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            {syncResult && (
              <p
                className="font-mono"
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-soft)',
                  background: 'var(--panel)',
                  border: '1px solid var(--rule-hi)',
                  padding: '0.55rem 0.75rem',
                }}
              >
                {syncResult}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, barcode, or SKU…"
          className="w-full font-body text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--rule-hi)',
            fontSize: '0.92rem',
            padding: '0.65rem 2.5rem 0.65rem 0.9rem',
            minHeight: 44,
          }}
        />
        <kbd
          className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center font-mono"
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
            border: '1px solid var(--rule-hi)',
            padding: '1px 5px',
          }}
        >
          Ctrl+K
        </kbd>
      </div>

      {scanMessage && (
        <div
          className="flex items-center gap-2"
          style={{
            background: 'var(--teal-mute)',
            border: '1px solid rgba(94,176,155,0.35)',
            padding: '0.55rem 0.85rem',
          }}
        >
          <span
            aria-hidden="true"
            className="font-mono"
            style={{ color: 'var(--teal)', fontWeight: 700 }}
          >
            ✓
          </span>
          <span className="font-mono text-ink" style={{ fontSize: '0.78rem', letterSpacing: '0.04em' }}>
            {scanMessage}
          </span>
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="ar-zone">
          <div className="ar-zone-head">
            <span>New Item</span>
            <button
              onClick={() => {
                setShowAddForm(false);
                setForm({ ...EMPTY_FORM });
                setError(null);
              }}
              className="font-mono uppercase text-ink-faint hover:text-ink transition-colors"
              style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {error && (
              <p
                className="font-mono"
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.06em',
                  color: 'var(--red)',
                  background: 'var(--red-mute)',
                  border: '1px solid rgba(214,90,90,0.35)',
                  padding: '0.55rem 0.75rem',
                }}
              >
                ! {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FieldLabel label="Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Item name"
                  style={inputStyle}
                />
              </FieldLabel>

              <FieldLabel label="Category">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as ItemCategory })
                  }
                  style={selectStyle}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Price ($)">
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </FieldLabel>

              <FieldLabel label="Cost ($)">
                <input
                  type="text"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </FieldLabel>

              <FieldLabel label="Quantity">
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: parseInt(e.target.value) || 0 })
                  }
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </FieldLabel>

              <FieldLabel label="Barcode">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Scan or type barcode"
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </FieldLabel>

              <FieldLabel label="Condition">
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  style={selectStyle}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Language">
                <input
                  type="text"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  placeholder="English"
                  style={inputStyle}
                />
              </FieldLabel>

              <FieldLabel label="Set Name">
                <input
                  type="text"
                  value={form.set_name}
                  onChange={(e) => setForm({ ...form, set_name: e.target.value })}
                  placeholder="Set or expansion name"
                  style={inputStyle}
                />
              </FieldLabel>

              <div className="flex items-end">
                <label
                  className="flex items-center gap-2 cursor-pointer font-mono uppercase"
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    color: form.foil ? 'var(--yellow)' : 'var(--ink-soft)',
                    padding: '0.55rem 0.85rem',
                    border: `1px solid ${form.foil ? 'rgba(251,219,101,0.4)' : 'var(--rule-hi)'}`,
                    background: form.foil ? 'var(--yellow-mute)' : 'var(--panel)',
                    minHeight: 44,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.foil}
                    onChange={(e) => setForm({ ...form, foil: e.target.checked })}
                    className="accent-yellow-500"
                  />
                  Foil / Holographic
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setForm({ ...EMPTY_FORM });
                  setError(null);
                }}
                className="inline-flex items-center font-mono uppercase transition-colors"
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  padding: '0 1rem',
                  minHeight: 48,
                  color: 'var(--ink-soft)',
                  border: '1px solid var(--rule-hi)',
                  background: 'transparent',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={{
                  fontSize: '0.85rem',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  padding: '0 1.15rem',
                  minHeight: 48,
                  color: 'var(--void)',
                  background: 'var(--orange)',
                  border: '1px solid var(--orange)',
                }}
              >
                {submitting ? "Creating…" : "Create Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            border: '1px solid rgba(214,90,90,0.35)',
            background: 'var(--red-mute)',
            padding: '0.75rem 1rem',
          }}
        >
          <p className="font-mono uppercase text-red-fu" style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}>
            ! {loadError}
          </p>
          <button
            onClick={() => { setLoadError(null); loadInventory(); }}
            className="font-mono uppercase text-red-fu hover:text-ink transition-colors"
            style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
          >
            Try again →
          </button>
        </div>
      )}

      {loading ? (
        <p
          className="font-mono uppercase text-ink-soft"
          style={{ fontSize: '0.7rem', letterSpacing: '0.18em', padding: '2rem 0', textAlign: 'center' }}
        >
          Loading inventory…
        </p>
      ) : items.length === 0 && !loadError ? (
        <div className="ar-zone">
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}
            >
              {searchQuery ? 'No matches' : 'No inventory yet'}
            </div>
            <p className="font-display text-ink" style={{ fontSize: '1.2rem', letterSpacing: '0.005em' }}>
              {searchQuery ? 'Try a different search term.' : 'Add your first item to start tracking.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 inline-flex items-center font-display uppercase"
                style={{
                  fontSize: '0.85rem',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  padding: '0.7rem 1.15rem',
                  minHeight: 48,
                  color: 'var(--void)',
                  background: 'var(--orange)',
                  border: '1px solid var(--orange)',
                }}
              >
                Add Your First Item
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile sort pills */}
          <div className="md:hidden flex gap-1.5 flex-wrap">
            {([
              { field: "name" as SortField, label: "Name" },
              { field: "price" as SortField, label: "Price" },
              { field: "quantity" as SortField, label: "Qty" },
              { field: "category" as SortField, label: "Category" },
            ]).map((s) => {
              const on = sortField === s.field;
              return (
                <button
                  key={s.field}
                  onClick={() => handleSort(s.field)}
                  className="inline-flex items-center font-mono uppercase transition-colors"
                  style={{
                    fontSize: '0.62rem',
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                    padding: '0 0.75rem',
                    minHeight: 36,
                    color: on ? 'var(--orange)' : 'var(--ink-soft)',
                    border: `1px solid ${on ? 'var(--orange)' : 'var(--rule-hi)'}`,
                    background: on ? 'var(--orange-mute)' : 'var(--panel)',
                  }}
                >
                  {s.label}{getSortArrow(s.field)}
                </button>
              );
            })}
          </div>

          {/* Mobile card view */}
          <div
            className="md:hidden flex flex-col"
            style={{ gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}
          >
            {sortedItems.map((item) => {
              const isFoil = Boolean((item.attributes as Record<string, unknown>)?.foil);
              return (
                <div
                  key={item.id}
                  className="ar-lstripe"
                  style={{
                    background: 'var(--panel-mute)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="font-display text-ink hover:text-orange transition-colors truncate min-w-0 flex-1"
                      style={{ fontSize: '1rem', fontWeight: 500, letterSpacing: '0.005em' }}
                    >
                      {item.name}
                    </Link>
                    <span
                      className="font-mono tabular-nums shrink-0"
                      style={{ fontSize: '0.84rem', color: 'var(--ink)', fontWeight: 600 }}
                    >
                      {formatCents(item.price_cents)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '0.62rem',
                        letterSpacing: '0.04em',
                        color: 'var(--ink-faint)',
                      }}
                    >
                      {getCategoryLabel(item.category)}
                    </span>
                    {isFoil && <ItemTag tone="yellow">Foil</ItemTag>}
                    {item.lendable && <ItemTag tone="teal">Lendable</ItemTag>}
                    {item.shared_to_catalog && <ItemTag tone="orange">Shared</ItemTag>}
                    {item.catalog_product_id && !item.shared_to_catalog && (
                      <ItemTag tone="ink">Linked</ItemTag>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: stockColor(item.quantity),
                      }}
                    >
                      Qty {item.quantity}
                    </span>
                    {can("inventory.adjust") && (
                      <div className="flex items-center gap-1">
                        {item.category === "board_game" && (
                          <RowBtn
                            on={item.lendable ?? false}
                            tone="teal"
                            onClick={() => handleToggleLendable(item)}
                          >
                            {item.lendable ? "Lendable" : "Lend"}
                          </RowBtn>
                        )}
                        <RowBtn
                          on={item.shared_to_catalog ?? false}
                          tone="orange"
                          onClick={() => handleToggleCatalogShare(item)}
                        >
                          {item.shared_to_catalog ? "Unshare" : "Share"}
                        </RowBtn>
                        <RowBtn
                          tone="orange"
                          onClick={() =>
                            setAdjust({
                              item,
                              type: "add",
                              amount: "",
                              reason: "",
                              notes: "",
                            })
                          }
                        >
                          Adjust
                        </RowBtn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop dense list — TCG-pro style rows */}
          <div className="hidden md:block ar-zone">
            <div className="ar-zone-head">
              <span>Stock</span>
              <span style={{ color: 'var(--ink-faint)' }}>
                {sortedItems.length.toLocaleString()} of {(totalItems > 0 ? totalItems : kpis.uniqueSkus).toLocaleString()}
              </span>
            </div>
            {/* Column headers */}
            <div
              className="grid items-center font-mono uppercase text-ink-faint"
              style={{
                gridTemplateColumns: '46px 1fr 140px 110px 90px 110px 220px',
                gap: '0.85rem',
                padding: '0.55rem 1rem',
                background: 'var(--panel-mute)',
                borderBottom: '1px solid var(--rule)',
                fontSize: '0.55rem',
                letterSpacing: '0.22em',
                fontWeight: 600,
              }}
            >
              <span>#</span>
              <button
                type="button"
                onClick={() => handleSort('name')}
                className="text-left hover:text-ink transition-colors"
              >
                Item{getSortArrow('name')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('category')}
                className="text-left hover:text-ink transition-colors"
              >
                Category{getSortArrow('category')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('price')}
                className="text-right hover:text-ink transition-colors"
              >
                Price{getSortArrow('price')}
              </button>
              <button
                type="button"
                onClick={() => handleSort('quantity')}
                className="text-right hover:text-ink transition-colors"
              >
                Qty{getSortArrow('quantity')}
              </button>
              <span className="text-left">Status</span>
              {can("inventory.adjust") ? (
                <span className="text-right">Actions</span>
              ) : (
                <span />
              )}
            </div>

            {/* Rows */}
            <div className="ar-stagger flex flex-col">
              {sortedItems.map((item, idx) => {
                const isFoil = Boolean((item.attributes as Record<string, unknown>)?.foil);
                const cond = String((item.attributes as Record<string, unknown>)?.condition ?? '');
                return (
                  <div
                    key={item.id}
                    className="ar-lstripe grid items-center hover:bg-panel transition-colors"
                    style={{
                      gridTemplateColumns: '46px 1fr 140px 110px 90px 110px 220px',
                      gap: '0.85rem',
                      padding: '0.7rem 1rem',
                      minHeight: 64,
                      background: 'var(--panel-mute)',
                      borderBottom: '1px solid var(--rule-faint)',
                    }}
                  >
                    {/* Index thumbnail */}
                    <div
                      className="font-mono tabular-nums"
                      style={{
                        width: 46,
                        height: 46,
                        background: 'var(--panel)',
                        border: '1px solid var(--rule-hi)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ink-faint)',
                        fontSize: '0.7rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {(((page - 1) * pageSize) + idx + 1).toString().padStart(3, '0')}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="font-display text-ink hover:text-orange transition-colors truncate"
                          style={{ fontSize: '0.98rem', fontWeight: 500, letterSpacing: '0.005em' }}
                        >
                          {item.name}
                        </Link>
                        {isFoil && <ItemTag tone="yellow">Foil</ItemTag>}
                        {item.lendable && <ItemTag tone="teal">Lendable</ItemTag>}
                        {item.shared_to_catalog && <ItemTag tone="orange">Shared</ItemTag>}
                        {item.catalog_product_id && !item.shared_to_catalog && (
                          <ItemTag tone="ink">Linked</ItemTag>
                        )}
                      </div>
                      {(item.barcode || cond) && (
                        <div
                          className="font-mono mt-1 flex items-center gap-2 flex-wrap"
                          style={{
                            fontSize: '0.62rem',
                            letterSpacing: '0.04em',
                            color: 'var(--ink-faint)',
                          }}
                        >
                          {item.barcode && <span>{item.barcode}</span>}
                          {cond && (
                            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>· {cond}</span>
                          )}
                          <span style={{ color: 'var(--ink-soft)' }}>
                            · cost {formatCents(item.cost_cents)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <span
                      className="font-mono uppercase truncate"
                      style={{
                        fontSize: '0.66rem',
                        letterSpacing: '0.12em',
                        color: 'var(--ink-soft)',
                        fontWeight: 600,
                      }}
                    >
                      {getCategoryLabel(item.category)}
                    </span>

                    {/* Price */}
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{ fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 600 }}
                    >
                      {formatCents(item.price_cents)}
                    </span>

                    {/* Qty */}
                    <div className="text-right">
                      <span
                        className="font-mono tabular-nums"
                        style={{
                          fontSize: '0.95rem',
                          color: stockColor(item.quantity),
                          fontWeight: 700,
                        }}
                      >
                        {item.quantity}
                      </span>
                      {locations.length > 0 && (
                        <button
                          onClick={async () => {
                            if (showLocationBreakdown === item.id) {
                              setShowLocationBreakdown(null);
                              return;
                            }
                            setShowLocationBreakdown(item.id);
                            try {
                              const res = await fetch(`/api/inventory/levels?item_id=${item.id}`);
                              if (res.ok) {
                                const data = await res.json();
                                setLocationLevels(data);
                              }
                            } catch {
                              setLocationLevels([]);
                            }
                          }}
                          className="block ml-auto font-mono uppercase text-ink-faint hover:text-orange transition-colors"
                          style={{
                            fontSize: '0.55rem',
                            letterSpacing: '0.18em',
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          {showLocationBreakdown === item.id ? "hide" : "by loc"}
                        </button>
                      )}
                      {showLocationBreakdown === item.id && locationLevels.length > 0 && (
                        <div
                          className="mt-1 font-mono"
                          style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}
                        >
                          {locationLevels.map((ll) => (
                            <div key={ll.location_id} className="tabular-nums">
                              {ll.location_name}:{' '}
                              <span style={{ color: 'var(--ink)' }}>{ll.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {showLocationBreakdown === item.id && locationLevels.length === 0 && (
                        <div
                          className="mt-1 font-mono"
                          style={{ fontSize: '0.6rem', color: 'var(--ink-ghost)' }}
                        >
                          No location data
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <span>
                      {item.active ? (
                        <ItemTag tone="teal">Active</ItemTag>
                      ) : (
                        <ItemTag tone="ink">Inactive</ItemTag>
                      )}
                    </span>

                    {/* Actions */}
                    {can("inventory.adjust") ? (
                      <div className="flex items-center justify-end gap-1">
                        {item.category === "board_game" && (
                          <RowBtn
                            on={item.lendable ?? false}
                            tone="teal"
                            onClick={() => handleToggleLendable(item)}
                          >
                            {item.lendable ? "Lendable" : "Lend"}
                          </RowBtn>
                        )}
                        <RowBtn
                          on={item.shared_to_catalog ?? false}
                          tone="orange"
                          onClick={() => handleToggleCatalogShare(item)}
                        >
                          {item.shared_to_catalog ? "Unshare" : "Share"}
                        </RowBtn>
                        <RowBtn
                          tone="orange"
                          primary
                          onClick={() =>
                            setAdjust({
                              item,
                              type: "add",
                              amount: "",
                              reason: "",
                              notes: "",
                            })
                          }
                        >
                          Adjust
                        </RowBtn>
                      </div>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        </>
      )}

      {/* Stock Adjustment Modal */}
      {adjust && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'var(--overlay-bg)' }}
          onClick={() => {
            setAdjust(null);
            setAdjustError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setAdjust(null);
              setAdjustError(null);
            }
          }}
        >
          <div
            ref={(el: HTMLDivElement | null) => {
              if (!el) return;
              const handler = (e: FocusEvent) => {
                const target = e.target as HTMLElement;
                if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
                  setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
                }
              };
              el.addEventListener("focusin", handler);
              return () => el.removeEventListener("focusin", handler);
            }}
            className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto scroll-visible"
            style={{
              background: 'var(--panel-mute)',
              border: '1px solid var(--rule)',
              boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '0.85rem 1.1rem',
                background: 'var(--slate)',
                borderBottom: '1px solid var(--rule)',
              }}
            >
              <div>
                <p
                  className="font-mono uppercase text-ink-faint"
                  style={{ fontSize: '0.55rem', letterSpacing: '0.28em', fontWeight: 600 }}
                >
                  Adjust Stock
                </p>
                <h2
                  className="font-display text-ink mt-1 truncate"
                  style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.005em' }}
                >
                  {adjust.item.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  setAdjust(null);
                  setAdjustError(null);
                }}
                aria-label="Close"
                className="font-mono text-ink-faint hover:text-ink transition-colors shrink-0"
                style={{
                  fontSize: '1.4rem',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {/* Current quantity */}
              <div
                className="flex items-center justify-between"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--rule-hi)',
                  padding: '0.85rem 1rem',
                }}
              >
                <span
                  className="font-mono uppercase text-ink-faint"
                  style={{ fontSize: '0.6rem', letterSpacing: '0.22em', fontWeight: 600 }}
                >
                  Current Quantity
                </span>
                <span
                  className="font-display tabular-nums text-ink"
                  style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.01em' }}
                >
                  {adjust.item.quantity}
                </span>
              </div>

              {adjustError && (
                <p
                  className="font-mono"
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '0.06em',
                    color: 'var(--red)',
                    background: 'var(--red-mute)',
                    border: '1px solid rgba(214,90,90,0.35)',
                    padding: '0.55rem 0.75rem',
                  }}
                >
                  ! {adjustError}
                </p>
              )}

              {/* Add / Remove segment */}
              <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--rule-hi)' }}>
                {(['add', 'remove'] as const).map((t) => {
                  const on = adjust.type === t;
                  const tone = t === 'add' ? 'var(--teal)' : 'var(--red)';
                  const tint = t === 'add' ? 'var(--teal-mute)' : 'var(--red-mute)';
                  return (
                    <button
                      key={t}
                      onClick={() => setAdjust({ ...adjust, type: t })}
                      className="font-mono uppercase transition-colors"
                      style={{
                        fontSize: '0.7rem',
                        letterSpacing: '0.18em',
                        fontWeight: 700,
                        padding: '0 1rem',
                        minHeight: 48,
                        color: on ? tone : 'var(--ink-soft)',
                        background: on ? tint : 'var(--panel-mute)',
                      }}
                    >
                      {t === 'add' ? '+ Add' : '− Remove'}
                    </button>
                  );
                })}
              </div>

              {/* Amount */}
              <FieldLabel label="Amount" required>
                <input
                  type="number"
                  min={1}
                  value={adjust.amount}
                  onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })}
                  placeholder="Enter quantity"
                  autoFocus
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
              </FieldLabel>

              {/* Reason */}
              <FieldLabel label="Reason" required>
                <select
                  value={adjust.reason}
                  onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">Select a reason…</option>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              {/* Notes */}
              <FieldLabel label="Notes (optional)">
                <textarea
                  value={adjust.notes}
                  onChange={(e) => setAdjust({ ...adjust, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional details…"
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </FieldLabel>

              {/* Preview */}
              {adjust.amount && parseInt(adjust.amount, 10) > 0 && (
                <div
                  className="flex items-center justify-between"
                  style={{
                    background: 'var(--orange-mute)',
                    border: '1px solid rgba(255,122,0,0.25)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: '0.6rem',
                      letterSpacing: '0.22em',
                      fontWeight: 600,
                      color: 'var(--orange)',
                    }}
                  >
                    New Quantity
                  </span>
                  <span
                    className="font-display tabular-nums text-ink"
                    style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.01em' }}
                  >
                    {adjust.type === "add"
                      ? adjust.item.quantity + parseInt(adjust.amount, 10)
                      : Math.max(0, adjust.item.quantity - parseInt(adjust.amount, 10))}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setAdjust(null);
                    setAdjustError(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center font-mono uppercase transition-colors"
                  style={{
                    fontSize: '0.7rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    minHeight: 48,
                    color: 'var(--ink-soft)',
                    border: '1px solid var(--rule-hi)',
                    background: 'transparent',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustSubmit}
                  disabled={adjustSubmitting}
                  className="flex-1 inline-flex items-center justify-center font-display uppercase transition-colors disabled:opacity-50"
                  style={{
                    fontSize: '0.85rem',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    minHeight: 48,
                    color: 'var(--void)',
                    background: 'var(--orange)',
                    border: '1px solid var(--orange)',
                  }}
                >
                  {adjustSubmitting ? "Adjusting…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => handleInventoryScan(code)}
          onClose={() => setShowScanner(false)}
          title="Scan to Add"
        />
      )}

      {/* Print Labels Modal */}
      {showLabels && (
        <PrintLabelsModal onClose={() => setShowLabels(false)} />
      )}

      {/* Learn Barcode Modal */}
      {learnBarcode && (
        <BarcodeLearnModal
          barcode={learnBarcode}
          onClose={() => setLearnBarcode(null)}
          onItemCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setScanMessage(`Added: ${item.name}`);
            setTimeout(() => setScanMessage(null), 4000);
          }}
          onBarcodeAssigned={(item) => {
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? item : i))
            );
            setScanMessage(`Barcode assigned to ${item.name}`);
            setTimeout(() => setScanMessage(null), 4000);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function KpiCell({
  k,
  v,
  sub,
  primary,
  tone,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
  tone?: 'warn' | 'err' | 'ok';
}) {
  const toneColor =
    tone === 'warn' ? 'var(--yellow)' : tone === 'err' ? 'var(--red)' : tone === 'ok' ? 'var(--teal)' : undefined;
  return (
    <div
      className="bg-panel-mute flex flex-col justify-between"
      style={{ padding: '0.85rem 1.1rem', minHeight: 92 }}
    >
      <div
        className="font-mono uppercase text-ink-faint"
        style={{ fontSize: '0.55rem', letterSpacing: '0.24em', fontWeight: 600 }}
      >
        {k}
      </div>
      <div
        className="font-display leading-none mt-2 truncate"
        style={{
          fontWeight: 700,
          fontSize: 'clamp(1.25rem, 2.5vw, 1.85rem)',
          letterSpacing: '-0.01em',
          color: toneColor ?? (primary ? 'var(--orange)' : 'var(--ink)'),
        }}
      >
        {v}
      </div>
      {sub && (
        <div
          className="font-mono mt-2 truncate"
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.04em',
            color: toneColor ?? 'var(--ink-soft)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="font-mono uppercase text-ink-soft"
        style={{ fontSize: '0.6rem', letterSpacing: '0.22em', fontWeight: 600 }}
      >
        {label}
        {required ? <span className="text-orange ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}

/**
 * Inline status tag — color is paired with text label so it's never alone.
 */
function ItemTag({
  tone,
  children,
}: {
  tone: 'orange' | 'yellow' | 'teal' | 'red' | 'ink';
  children: React.ReactNode;
}) {
  const map = {
    orange: { color: 'var(--orange)', bg: 'var(--orange-mute)', border: 'rgba(255,122,0,0.35)' },
    yellow: { color: 'var(--yellow)', bg: 'var(--yellow-mute)', border: 'rgba(251,219,101,0.35)' },
    teal: { color: 'var(--teal)', bg: 'var(--teal-mute)', border: 'rgba(94,176,155,0.30)' },
    red: { color: 'var(--red)', bg: 'var(--red-mute)', border: 'rgba(214,90,90,0.35)' },
    ink: { color: 'var(--ink-soft)', bg: 'var(--panel)', border: 'var(--rule-hi)' },
  } as const;
  const cfg = map[tone];
  return (
    <span
      className="inline-flex items-center font-mono uppercase"
      style={{
        fontSize: '0.55rem',
        letterSpacing: '0.14em',
        fontWeight: 700,
        padding: '1px 5px',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Compact in-row action button. `on` = active toggle state. `primary` = solid orange.
 */
function RowBtn({
  on,
  tone,
  primary,
  children,
  onClick,
}: {
  on?: boolean;
  tone: 'orange' | 'teal';
  primary?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const tones = {
    orange: {
      onColor: 'var(--orange)',
      onBg: 'var(--orange-mute)',
      onBorder: 'var(--orange)',
    },
    teal: {
      onColor: 'var(--teal)',
      onBg: 'var(--teal-mute)',
      onBorder: 'rgba(94,176,155,0.5)',
    },
  } as const;
  const cfg = tones[tone];
  const isPrimary = primary;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center font-mono uppercase transition-colors"
      style={{
        fontSize: '0.62rem',
        letterSpacing: '0.14em',
        fontWeight: 700,
        padding: '0 0.6rem',
        minHeight: 36,
        color: isPrimary ? 'var(--void)' : on ? cfg.onColor : 'var(--ink-soft)',
        background: isPrimary ? cfg.onColor : on ? cfg.onBg : 'var(--panel)',
        border: `1px solid ${isPrimary ? cfg.onColor : on ? cfg.onBorder : 'var(--rule-hi)'}`,
      }}
    >
      {children}
    </button>
  );
}
