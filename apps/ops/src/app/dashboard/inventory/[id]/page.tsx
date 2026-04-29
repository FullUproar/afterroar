"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useStore } from "@/lib/store-context";
import {
  InventoryItem,
  ItemCategory,
  formatCents,
  parseDollars,
} from "@/lib/types";
import { StatusBadge } from "@/components/mobile-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/shared/ui";
import { ItemAdvancedPanels } from "@/components/inventory/item-advanced-panels";
import { BreakNowModal } from "@/components/inventory/break-now-modal";
import { CategoryAttributeFields, CategoryAttributeBadges } from "@/components/inventory/category-attribute-fields";
import { VariantMatrixModal } from "@/components/inventory/variant-matrix-modal";
import { CatalogLookup } from "@/components/inventory/catalog-lookup";
import { useEnabledModules } from "@/hooks/use-enabled-modules";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "tcg_single", label: "TCG Single" },
  { value: "sealed", label: "Sealed" },
  { value: "board_game", label: "Board Game" },
  { value: "rpg", label: "RPG Book" },
  { value: "miniature", label: "Miniature" },
  { value: "comic", label: "Comic" },
  { value: "accessory", label: "Accessory" },
  { value: "collectible", label: "Collectible" },
  { value: "food_drink", label: "Food & Drink" },
  { value: "other", label: "Other" },
];

const ADJUSTMENT_REASONS = [
  "Received shipment",
  "Damaged/defective",
  "Physical count correction",
  "Theft/shrinkage",
  "Returned to supplier",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SaleEntry {
  id: string;
  type: string;
  amount_cents: number;
  description: string | null;
  customer_name: string | null;
  staff_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface EditForm {
  name: string;
  category: ItemCategory;
  price: string;
  cost: string;
  barcode: string;
  /** Category-specific fields, rendered dynamically from CATEGORY_SCHEMAS.
   *  See lib/category-attributes.ts. Keys map to PosInventoryItem.attributes. */
  attributes: Record<string, unknown>;
}

interface AdjustState {
  type: "add" | "remove";
  amount: string;
  reason: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getCategoryLabel = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

const getStockColor = (qty: number) => {
  if (qty === 0) return "text-red-500";
  if (qty <= 3) return "text-orange-400";
  return "text-green-500";
};

const getStockBg = (qty: number) => {
  if (qty === 0) return "bg-red-500/10 border-red-500/30";
  if (qty <= 3) return "bg-orange-500/10 border-orange-500/30";
  return "bg-green-500/10 border-green-500/30";
};

function formatMargin(priceCents: number, costCents: number): string {
  if (priceCents === 0) return "--";
  const margin = ((priceCents - costCents) / priceCents) * 100;
  return `${margin.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useStore();
  const { filterCategories, isCategoryEnabled } = useEnabledModules();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    category: "other",
    price: "",
    cost: "",
    barcode: "",
    attributes: {},
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Adjust stock state
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjust, setAdjust] = useState<AdjustState>({
    type: "add",
    amount: "",
    reason: "",
    notes: "",
  });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Lendable toggle
  const [togglingLendable, setTogglingLendable] = useState(false);

  // Variant matrix modal
  const [showVariantMatrix, setShowVariantMatrix] = useState(false);

  /* ---- Load item ---- */
  const loadItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Item not found" }));
        setError(body.error || "Failed to load item");
        return;
      }
      const data = await res.json();
      setItem(data.item);
      setSales(data.sales ?? []);
      // Pre-fill edit form
      setEditForm({
        name: data.item.name || "",
        category: data.item.category || "other",
        price: (data.item.price_cents / 100).toFixed(2),
        cost: (data.item.cost_cents / 100).toFixed(2),
        barcode: data.item.barcode || "",
        attributes: (data.item.attributes ?? {}) as Record<string, unknown>,
      });
    } catch {
      setError("Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  /* ---- Edit handlers ---- */
  async function handleSaveEdit() {
    if (!item) return;
    if (!editForm.name.trim()) {
      setSaveError("Name is required");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name: editForm.name.trim(),
          category: editForm.category,
          price_cents: parseDollars(editForm.price),
          cost_cents: parseDollars(editForm.cost),
          barcode: editForm.barcode.trim() || null,
          attributes: editForm.attributes,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to save" }));
        throw new Error(body.error || "Failed to save");
      }

      const updated = await res.json();
      setItem(updated);
      setEditing(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /* ---- Stock adjustment ---- */
  async function handleAdjustSubmit() {
    if (!item) return;

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
          item_id: item.id,
          adjustment,
          reason: adjust.reason,
          notes: adjust.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to adjust" }));
        throw new Error(body.error || "Failed to adjust stock");
      }

      const updated = await res.json();
      setItem(updated);
      setShowAdjust(false);
      setAdjust({ type: "add", amount: "", reason: "", notes: "" });
    } catch (err: unknown) {
      setAdjustError(err instanceof Error ? err.message : "Failed to adjust");
    } finally {
      setAdjustSubmitting(false);
    }
  }

  /* ---- Lendable toggle ---- */
  async function handleToggleLendable() {
    if (!item) return;
    setTogglingLendable(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, lendable: !item.lendable }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItem(updated);
      }
    } catch {
      // Silently fail
    } finally {
      setTogglingLendable(false);
    }
  }

  /* ---- Delete item ---- */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        window.location.href = "/dashboard/inventory";
      }
    } finally {
      setDeleting(false);
    }
  }

  /* ---- Render ---- */
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Item Details" backHref="/dashboard/inventory" />
        <div className="text-center text-muted py-12">Loading item...</div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <PageHeader title="Item Details" backHref="/dashboard/inventory" />
        <EmptyState
          icon="&#x26A0;"
          title={error || "Item not found"}
          description="This item may have been deleted or you don't have access."
          action={{ label: "Back to Inventory", href: "/dashboard/inventory" }}
        />
      </div>
    );
  }

  const attrs = (item.attributes ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title={item.name}
        backHref="/dashboard/inventory"
        action={
          can("inventory.adjust") && !editing ? (
            <div className="flex items-center gap-2">
              {item.quantity > 0 && (
                <button
                  onClick={() => setShowBreak(true)}
                  className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-muted hover:bg-card-hover transition-colors"
                  title="Break a sealed case or box into smaller units"
                >
                  Break…
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-muted hover:bg-card-hover transition-colors"
              >
                Edit Item
              </button>
            </div>
          ) : undefined
        }
      />

      {showBreak && (
        <BreakNowModal
          parent={{
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            cost_cents: item.cost_cents,
          }}
          open={showBreak}
          onClose={() => setShowBreak(false)}
          onBroken={() => {
            // Re-fetch item to reflect the decremented quantity
            fetch(`/api/inventory/${item.id}`).then(async (r) => {
              if (r.ok) setItem(await r.json());
            });
          }}
        />
      )}

      {/* ============================================================ */}
      {/*  Section 1: Item Header                                       */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-card-border bg-card p-6 shadow-sm dark:shadow-none">
        {editing ? (
          /* ---- Edit Form ---- */
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Edit Item</h2>

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Category
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      category: e.target.value as ItemCategory,
                    })
                  }
                  className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none"
                >
                  {/* Filter by enabled modules but always include the
                      currently-selected value so an item that was created
                      in a now-disabled vertical doesn't show a blank
                      dropdown. The operator can still change it. */}
                  {(() => {
                    const visible = filterCategories(CATEGORIES);
                    const current = editForm.category;
                    const includesCurrent = visible.some((c) => c.value === current);
                    if (includesCurrent || isCategoryEnabled(current)) {
                      return visible.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ));
                    }
                    const orphan = CATEGORIES.find((c) => c.value === current);
                    return [
                      ...(orphan
                        ? [
                            <option key={orphan.value} value={orphan.value}>
                              {orphan.label} (disabled vertical)
                            </option>,
                          ]
                        : []),
                      ...visible.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      )),
                    ];
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Price ($)
                </label>
                <input
                  type="text"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm({ ...editForm, price: e.target.value })
                  }
                  className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Cost ($)
                </label>
                <input
                  type="text"
                  value={editForm.cost}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cost: e.target.value })
                  }
                  className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Barcode
                </label>
                <input
                  type="text"
                  value={editForm.barcode}
                  onChange={(e) =>
                    setEditForm({ ...editForm, barcode: e.target.value })
                  }
                  className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="Scan or type barcode"
                />
              </div>
            </div>

            {/* Category-aware catalog lookup. Surfaces source-specific
                "Lookup from Scryfall / BGG / ComicVine / …" buttons based on
                what the registry says is available + active for this category.
                Picking a result prefills name, image, and category attributes. */}
            <CatalogLookup
              category={editForm.category}
              onApply={(record) => {
                setEditForm((prev) => ({
                  ...prev,
                  name: record.name || prev.name,
                  attributes: { ...prev.attributes, ...record.attributes },
                }));
              }}
            />

            {/* Category-specific fields driven by lib/category-attributes.ts.
                Rendering is generic; the schema declares everything. */}
            <CategoryAttributeFields
              category={editForm.category}
              values={editForm.attributes}
              onChange={(next) => setEditForm({ ...editForm, attributes: next })}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                  // Reset form to current item values
                  setEditForm({
                    name: item.name,
                    category: item.category,
                    price: (item.price_cents / 100).toFixed(2),
                    cost: (item.cost_cents / 100).toFixed(2),
                    barcode: item.barcode || "",
                    attributes: (item.attributes ?? {}) as Record<string, unknown>,
                  });
                }}
                className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          /* ---- Display Header ---- */
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Image placeholder */}
            <div className="shrink-0">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  width={128}
                  height={128}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl object-cover border border-card-border"
                  unoptimized
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-zinc-800 border border-card-border flex items-center justify-center">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-zinc-500"
                  >
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              )}
            </div>

            {/* Item info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {item.name}
                </h2>
                <StatusBadge
                  variant={item.active ? "success" : "info"}
                >
                  {item.active ? "Active" : "Inactive"}
                </StatusBadge>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-muted">
                  {getCategoryLabel(item.category)}
                </span>
                {item.lendable && (
                  <StatusBadge variant="success">Lendable</StatusBadge>
                )}
                {item.shared_to_catalog && (
                  <StatusBadge variant="info">Shared to Catalog</StatusBadge>
                )}
              </div>
              <CategoryAttributeBadges
                category={item.category}
                attributes={attrs}
                className="mt-2"
              />

              {item.barcode && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium text-foreground/70">Barcode:</span>{" "}
                  <span className="font-mono">{item.barcode}</span>
                </p>
              )}

              {item.sku && (
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium text-foreground/70">SKU:</span>{" "}
                  <span className="font-mono">{item.sku}</span>
                </p>
              )}

              <p className="mt-1 text-xs text-muted">
                Added {formatDate(item.created_at)}
                {item.updated_at !== item.created_at &&
                  ` · Updated ${formatDate(item.updated_at)}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Section 2: Stock & Pricing                                   */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quantity card */}
        <div
          className={`rounded-xl border p-5 text-center shadow-sm dark:shadow-none ${getStockBg(
            item.quantity
          )}`}
        >
          <p className="text-sm font-medium text-muted mb-1">In Stock</p>
          <p className={`text-4xl font-bold tabular-nums ${getStockColor(item.quantity)}`}>
            {item.quantity}
          </p>
          {item.low_stock_threshold > 0 && (
            <p className="text-xs text-muted mt-1">
              Low stock alert at {item.low_stock_threshold}
            </p>
          )}
          {can("inventory.adjust") && (
            <button
              onClick={() => setShowAdjust(true)}
              className="mt-3 rounded-xl bg-accent/20 border border-accent/40 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              Adjust Stock
            </button>
          )}
        </div>

        {/* Price card */}
        <div className="rounded-xl border border-card-border bg-card p-5 shadow-sm dark:shadow-none">
          <p className="text-sm font-medium text-muted mb-1">Price</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatCents(item.price_cents)}
          </p>
        </div>

        {/* Cost + Margin card */}
        <div className="rounded-xl border border-card-border bg-card p-5 shadow-sm dark:shadow-none">
          <p className="text-sm font-medium text-muted mb-1">Cost / Margin</p>
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatCents(item.cost_cents)}
            </p>
            <span
              className={`text-sm font-semibold ${
                item.price_cents > item.cost_cents
                  ? "text-green-400"
                  : item.price_cents === item.cost_cents
                  ? "text-muted"
                  : "text-red-400"
              }`}
            >
              {formatMargin(item.price_cents, item.cost_cents)} margin
            </span>
          </div>
        </div>
      </div>

      {/* Lendable toggle for board games */}
      {item.category === "board_game" && can("inventory.adjust") && (
        <div className="rounded-xl border border-card-border bg-card p-4 shadow-sm dark:shadow-none flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Game Library Lending
            </p>
            <p className="text-xs text-muted mt-0.5">
              Allow this game to be checked out by customers for in-store play
            </p>
          </div>
          <button
            onClick={handleToggleLendable}
            disabled={togglingLendable}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              item.lendable ? "bg-green-600" : "bg-zinc-600"
            } ${togglingLendable ? "opacity-50" : "cursor-pointer"}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${
                item.lendable ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Section 3: Sales History                                     */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-card-border bg-card shadow-sm dark:shadow-none">
        <div className="px-6 py-4 border-b border-card-border">
          <h3 className="text-base font-semibold text-foreground">
            Recent Sales
          </h3>
        </div>

        {sales.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-muted text-sm">No sales recorded yet</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-card-border">
              {sales.map((sale) => (
                <div key={sale.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-medium">
                      {formatCents(Math.abs(sale.amount_cents))}
                    </span>
                    <StatusBadge
                      variant={sale.type === "sale" ? "success" : "pending"}
                    >
                      {sale.type}
                    </StatusBadge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{sale.customer_name || "Walk-in"}</span>
                    <span>{formatDateTime(sale.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto scroll-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-muted">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium text-right">Amount</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="bg-background hover:bg-card/50 transition-colors"
                    >
                      <td className="px-6 py-3 text-muted whitespace-nowrap">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge
                          variant={sale.type === "sale" ? "success" : "pending"}
                        >
                          {sale.type}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-3 text-right text-foreground font-medium tabular-nums">
                        {formatCents(Math.abs(sale.amount_cents))}
                      </td>
                      <td className="px-6 py-3 text-muted">
                        {sale.customer_name || "Walk-in"}
                      </td>
                      <td className="px-6 py-3 text-muted">
                        {sale.staff_name || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Section 4: Item Attributes                                   */}
      {/* ============================================================ */}
      {Object.keys(attrs).length > 0 && (
        <div className="rounded-xl border border-card-border bg-card shadow-sm dark:shadow-none">
          <div className="px-6 py-4 border-b border-card-border">
            <h3 className="text-base font-semibold text-foreground">
              Attributes
            </h3>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              {Object.entries(attrs).map(([key, value]) => {
                // Skip null/undefined values
                if (value === null || value === undefined) return null;

                const displayKey = key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());

                let displayValue: string;
                if (typeof value === "boolean") {
                  displayValue = value ? "Yes" : "No";
                } else if (typeof value === "object") {
                  displayValue = JSON.stringify(value);
                } else {
                  displayValue = String(value);
                }

                return (
                  <div key={key}>
                    <dt className="text-xs font-medium text-muted">
                      {displayKey}
                    </dt>
                    <dd className="text-sm text-foreground mt-0.5">
                      {displayValue}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Stock Adjustment Modal                                       */}
      {/* ============================================================ */}
      {showAdjust && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-bg"
          onClick={() => {
            setShowAdjust(false);
            setAdjustError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowAdjust(false);
              setAdjustError(null);
            }
          }}
        >
          <div
            ref={(el: HTMLDivElement | null) => {
              if (!el) return;
              const handler = (e: FocusEvent) => {
                const target = e.target as HTMLElement;
                if (
                  target.tagName === "INPUT" ||
                  target.tagName === "TEXTAREA" ||
                  target.tagName === "SELECT"
                ) {
                  setTimeout(
                    () =>
                      target.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      }),
                    300
                  );
                }
              };
              el.addEventListener("focusin", handler);
              return () => el.removeEventListener("focusin", handler);
            }}
            className="w-full max-w-md rounded-xl border border-card-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto scroll-visible"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                Adjust Stock
              </h2>
              <button
                onClick={() => {
                  setShowAdjust(false);
                  setAdjustError(null);
                }}
                className="flex items-center justify-center h-8 w-8 rounded-full text-muted hover:text-foreground active:bg-card-hover transition-colors text-lg"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-muted mb-4">{item.name}</p>

            {/* Current quantity */}
            <div className="mb-4 rounded-md bg-background border border-card-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted">Current Quantity</span>
              <span className="text-lg font-bold text-foreground">
                {item.quantity}
              </span>
            </div>

            {adjustError && (
              <p className="mb-3 text-sm text-red-400">{adjustError}</p>
            )}

            {/* Add / Remove toggle */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdjust({ ...adjust, type: "add" })}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  adjust.type === "add"
                    ? "bg-emerald-600 text-foreground"
                    : "bg-zinc-800 text-muted hover:bg-zinc-700"
                }`}
              >
                Add
              </button>
              <button
                onClick={() => setAdjust({ ...adjust, type: "remove" })}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  adjust.type === "remove"
                    ? "bg-red-600 text-foreground"
                    : "bg-zinc-800 text-muted hover:bg-zinc-700"
                }`}
              >
                Remove
              </button>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-1">
                Amount
              </label>
              <input
                type="number"
                min={1}
                value={adjust.amount}
                onChange={(e) =>
                  setAdjust({ ...adjust, amount: e.target.value })
                }
                className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                placeholder="Enter quantity"
                autoFocus
              />
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-1">
                Reason *
              </label>
              <select
                value={adjust.reason}
                onChange={(e) =>
                  setAdjust({ ...adjust, reason: e.target.value })
                }
                className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select a reason...</option>
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-muted mb-1">
                Notes (optional)
              </label>
              <textarea
                value={adjust.notes}
                onChange={(e) =>
                  setAdjust({ ...adjust, notes: e.target.value })
                }
                rows={2}
                className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-none"
                placeholder="Additional details..."
              />
            </div>

            {/* Preview */}
            {adjust.amount && parseInt(adjust.amount, 10) > 0 && (
              <div className="mb-4 rounded-md bg-background border border-card-border px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted">New Quantity</span>
                <span className="text-lg font-bold text-foreground">
                  {adjust.type === "add"
                    ? item.quantity + parseInt(adjust.amount, 10)
                    : Math.max(0, item.quantity - parseInt(adjust.amount, 10))}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdjust(false);
                  setAdjustError(null);
                }}
                className="flex-1 rounded-xl border border-card-border px-4 py-2 text-sm text-muted hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={adjustSubmitting}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors ${
                  adjust.type === "add"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                } disabled:opacity-50`}
              >
                {adjustSubmitting ? "Adjusting..." : "Confirm Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Allocation (Shopify Sync) */}
      {can("inventory.adjust") && item.shopify_variant_id && (
        <OnlineAllocationSection item={item} onUpdate={(updated) => setItem(updated)} />
      )}

      {/* Holds */}
      {can("inventory.adjust") && (
        <HoldsSection itemId={item.id} itemName={item.name} />
      )}

      {/* Game library reservation queue — only surfaces for lendable items */}
      {item.lendable && (
        <ReservationQueueSection itemId={item.id} itemName={item.name} canManage={can("inventory.adjust")} />
      )}

      {/* Variant matrix — top-level items only (no parent_id). Lets staff
          fan out a parent into N children by 1 or 2 axes. Apparel/TCG/etc. */}
      {can("inventory.create") &&
        !((item as unknown as { parent_id: string | null }).parent_id) && (
          <div className="rounded-xl border border-card-border bg-card p-5 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Variants
                </h3>
                <p className="text-[10px] text-muted mt-0.5">
                  Generate child items by axis (size × color, foil × condition, etc.)
                </p>
              </div>
              <button
                onClick={() => setShowVariantMatrix(true)}
                className="font-mono uppercase border border-rule px-3 py-1.5 hover:border-ink-soft text-ink-soft hover:text-ink transition-colors"
                style={{ fontSize: "0.7rem", letterSpacing: "0.08em" }}
              >
                Generate variants
              </button>
            </div>
          </div>
        )}

      {showVariantMatrix && (
        <VariantMatrixModal
          itemId={item.id}
          itemName={item.name}
          category={item.category}
          onClose={() => setShowVariantMatrix(false)}
          onSuccess={(count) => {
            setShowVariantMatrix(false);
            alert(`Created ${count} variant${count === 1 ? "" : "s"}.`);
            void loadItem();
          }}
        />
      )}

      {/* Phase 2: Distributors / Variants / Multi-Barcode / Cost History */}
      {can("inventory.adjust") && (
        <ItemAdvancedPanels
          item={{
            id: item.id,
            name: item.name,
            cost_cents: item.cost_cents,
            first_cost_cents: (item as unknown as { first_cost_cents: number | null }).first_cost_cents ?? null,
            last_cost_cents: (item as unknown as { last_cost_cents: number | null }).last_cost_cents ?? null,
            barcode: item.barcode,
            barcodes: ((item as unknown as { barcodes?: string[] }).barcodes) ?? [],
            parent_id: ((item as unknown as { parent_id: string | null }).parent_id) ?? null,
            variant_label: ((item as unknown as { variant_label: string | null }).variant_label) ?? null,
          }}
          onItemUpdated={() => {
            // Re-fetch the item so barcode/parent state stays consistent
            fetch(`/api/inventory/${item.id}`).then(async (r) => {
              if (r.ok) setItem(await r.json());
            });
          }}
        />
      )}

      {/* Delete Item */}
      {can("inventory.adjust") && (
        <div className="rounded-xl border border-red-500/10 bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Delete Item</h3>
              <p className="text-xs text-muted mt-0.5">Permanently remove this item. For mistakes only.</p>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Online Allocation Section                                          */
/* ------------------------------------------------------------------ */

function OnlineAllocationSection({ item, onUpdate }: { item: InventoryItem; onUpdate: (i: InventoryItem) => void }) {
  const [allocation, setAllocation] = useState(item.online_allocation ?? 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, online_allocation: allocation }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-950/5 p-5 shadow-sm dark:shadow-none">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">Online Allocation (Shopify)</h3>
      <p className="text-xs text-muted mb-3">
        How many of your {item.quantity} in stock should be available for online sale? The rest stays in-store only.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={item.quantity}
          value={allocation}
          onChange={(e) => setAllocation(Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)))}
          className="w-24 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground tabular-nums focus:border-blue-500 focus:outline-none"
        />
        <span className="text-sm text-muted">of {item.quantity} available online</span>
        <button
          onClick={save}
          disabled={saving || allocation === (item.online_allocation ?? 0)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Update"}
        </button>
      </div>
      {item.quantity > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          In-store only: {item.quantity - allocation} · Online: {allocation}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Holds Section                                                      */
/* ------------------------------------------------------------------ */

interface Hold {
  id: string;
  quantity: number;
  reason: string | null;
  status: string;
  held_at: string;
  expires_at: string;
  customer?: { name: string } | null;
  staff?: { name: string } | null;
}

function HoldsSection({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("24");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/inventory/holds?item_id=${itemId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setHolds(Array.isArray(data) ? data : []))
      .catch(() => setHolds([]))
      .finally(() => setLoading(false));
  }, [itemId]);

  async function createHold() {
    setCreating(true);
    try {
      const res = await fetch("/api/inventory/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity: parseInt(qty), reason: reason || null, expires_hours: parseInt(hours) }),
      });
      if (res.ok) {
        const hold = await res.json();
        setHolds(prev => [hold, ...prev]);
        setShowCreate(false);
        setQty("1"); setReason(""); setHours("24");
      }
    } finally {
      setCreating(false);
    }
  }

  async function releaseHold(holdId: string) {
    const res = await fetch("/api/inventory/holds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hold_id: holdId }),
    });
    if (res.ok) {
      setHolds(prev => prev.map(h => h.id === holdId ? { ...h, status: "released" } : h));
    }
  }

  const activeHolds = holds.filter(h => h.status === "active");

  return (
    <div className="rounded-xl border border-card-border bg-card p-5 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Holds</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs text-accent hover:underline"
        >
          {showCreate ? "Cancel" : "+ Hold for Customer"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-3 rounded-lg border border-card-border bg-card-hover space-y-2">
          <div className="flex gap-2">
            <div>
              <label className="block text-[10px] text-muted mb-0.5">Qty</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="w-16 rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-muted mb-0.5">Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Customer request, phone order..." className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-0.5">Hours</label>
              <input type="number" min="1" max="168" value={hours} onChange={e => setHours(e.target.value)} className="w-16 rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none" />
            </div>
          </div>
          <button onClick={createHold} disabled={creating} className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium disabled:opacity-50">
            {creating ? "Holding..." : `Hold ${qty} ${itemName}`}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted">Loading holds...</p>
      ) : activeHolds.length === 0 ? (
        <p className="text-xs text-muted">No active holds</p>
      ) : (
        <div className="space-y-2">
          {activeHolds.map(h => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-card-border/50 last:border-b-0">
              <div>
                <span className="text-sm text-foreground">{h.quantity}x held</span>
                {h.reason && <span className="text-xs text-muted ml-2">— {h.reason}</span>}
                <p className="text-[10px] text-muted">
                  Expires {new Date(h.expires_at).toLocaleString()}
                  {h.staff && ` · by ${h.staff.name}`}
                </p>
              </div>
              <button onClick={() => releaseHold(h.id)} className="text-xs text-red-400 hover:text-red-300">Release</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reservation queue (game library)                                   */
/*                                                                      */
/*  Mounts only when item.lendable. Lets staff queue customers waiting  */
/*  for a checked-out copy. See pos_game_reservations + the api at     */
/*  /api/inventory/[id]/reservations.                                   */
/* ------------------------------------------------------------------ */

interface Reservation {
  id: string;
  position: number;
  status: "active" | "notified" | "claimed" | "released" | "expired";
  notes: string | null;
  notified_at: string | null;
  notification_expires_at: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  staff: { id: string; name: string } | null;
  created_at: string;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function ReservationQueueSection({
  itemId,
  itemName,
  canManage,
}: {
  itemId: string;
  itemName: string;
  canManage: boolean;
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/inventory/${itemId}/reservations`)
      .then((r) => (r.ok ? r.json() : { reservations: [] }))
      .then((data) => setReservations(data.reservations ?? []))
      .catch(() => setReservations([]))
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced customer search when adding
  useEffect(() => {
    if (!showAdd || !search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, showAdd]);

  async function addReservation(customerId: string) {
    setAdding(customerId);
    try {
      const res = await fetch(`/api/inventory/${itemId}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, notes: notes.trim() || null }),
      });
      if (res.ok) {
        load();
        setShowAdd(false);
        setSearch("");
        setNotes("");
        setResults([]);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not add reservation");
      }
    } finally {
      setAdding(null);
    }
  }

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Status change failed");
    }
  }

  async function release(id: string) {
    if (!confirm("Release this reservation? The customer will be removed from the queue.")) return;
    const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="rounded-xl border border-card-border bg-card p-5 shadow-sm dark:shadow-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Reservation queue
          </h3>
          <p className="text-[10px] text-muted mt-0.5">
            Customers waiting for {itemName}. Position by signup order.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-accent hover:underline"
          >
            {showAdd ? "Cancel" : "+ Reserve for customer"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 p-3 rounded-lg border border-card-border bg-card-hover space-y-2">
          <div>
            <label className="block text-[10px] text-muted mb-0.5">Find customer</label>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or phone…"
              className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          {searching ? (
            <div className="text-xs text-muted">Searching…</div>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={adding === c.id}
                  onClick={() => addReservation(c.id)}
                  className="text-left px-2 py-1.5 rounded border border-card-border hover:border-accent hover:bg-card transition-colors disabled:opacity-40"
                >
                  <div className="text-sm text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "no contact info"}
                  </div>
                </button>
              ))}
            </div>
          ) : search.trim() ? (
            <div className="text-xs text-muted">No matches.</div>
          ) : null}
          <div>
            <label className="block text-[10px] text-muted mb-0.5">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="wants for Saturday, first-time customer, etc."
              className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : reservations.length === 0 ? (
        <p className="text-xs text-muted">No active reservations.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {reservations.map((r) => {
            const isNotified = r.status === "notified";
            const expiresIn = r.notification_expires_at
              ? new Date(r.notification_expires_at).getTime() - Date.now()
              : null;
            const expiresInHours = expiresIn != null ? Math.max(0, Math.floor(expiresIn / 3600_000)) : null;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 py-2 border-b border-card-border/50 last:border-b-0"
              >
                <span className="font-mono text-sm font-bold text-cream w-6 text-center">
                  {r.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-foreground truncate">{r.customer.name}</span>
                    {isNotified && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40">
                        Notified
                        {expiresInHours != null ? ` · ${expiresInHours}h left` : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {[r.customer.email, r.customer.phone].filter(Boolean).join(" · ") || "no contact"}
                    {r.notes && ` · ${r.notes}`}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status === "active" && (
                      <button
                        onClick={() => changeStatus(r.id, "notified")}
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        Notify
                      </button>
                    )}
                    {r.status === "notified" && (
                      <button
                        onClick={() => changeStatus(r.id, "claimed")}
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-teal/60 text-teal hover:bg-teal/10 transition-colors"
                      >
                        Claimed
                      </button>
                    )}
                    <button
                      onClick={() => release(r.id)}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Release
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
