"use client";

/**
 * /dashboard/cafe/menu — Menu management for the cafe.
 *
 * Manages PosMenuItem rows + per-item PosMenuRecipe links. Items added here
 * (vs the hardcoded quick-adds on /dashboard/cafe) carry the menu_item_id
 * onto tab items, which triggers recipe-based ingredient decrement on tab
 * close. See docs/INVENTORY_AUDIT_2026_04_28.md cafe section.
 *
 * Capabilities:
 *   - Create / edit / delete menu items (price, category, age-restricted, prep time)
 *   - "86" toggle (sold_out_at = now / null) — daily availability flip
 *   - Recipe management: link inventory items with quantity per sale
 *   - Add menu item directly to an open tab (sales path that triggers decrement)
 */

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { formatCents, parseDollars } from "@/lib/types";

interface DietaryInfo {
  allergens?: string[];
  is_vegan?: boolean;
  is_vegetarian?: boolean;
  is_gluten_free?: boolean;
  is_dairy_free?: boolean;
  calories?: number;
  notes?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  description: string | null;
  available: boolean;
  sold_out_at: string | null;
  age_restricted: boolean;
  prep_seconds: number | null;
  sort_order: number;
  dietary_info: DietaryInfo | null;
  recipes: Array<{
    id: string;
    inventory_item_id: string;
    quantity_used: string | number;
    notes: string | null;
    inventory_item: { id: string; name: string; quantity: number };
  }>;
}

interface InventorySearchResult {
  id: string;
  name: string;
  quantity: number;
  sku: string | null;
}

const CATEGORIES = [
  { value: "drink", label: "Drink" },
  { value: "food", label: "Food" },
  { value: "snack", label: "Snack" },
  { value: "alcohol", label: "Alcohol" },
  { value: "other", label: "Other" },
];

/** Common allergen flags. Keys match the dietary_info.allergens string list. */
const COMMON_ALLERGENS = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "tree_nuts",
  "peanuts",
  "wheat",
  "soy",
  "sesame",
];

/** Display label for an allergen tag. */
function allergenLabel(tag: string): string {
  return tag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Returns true if the dietary_info has any meaningful content. */
function hasDietaryInfo(d: DietaryInfo | null | undefined): boolean {
  if (!d) return false;
  return Boolean(
    d.is_vegan ||
      d.is_vegetarian ||
      d.is_gluten_free ||
      d.is_dairy_free ||
      (d.allergens && d.allergens.length > 0) ||
      d.calories != null ||
      d.notes,
  );
}

export default function CafeMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cafe/menu-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.menuItems ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const eightySixed = items.filter((i) => i.sold_out_at);

  async function resetAll86() {
    if (eightySixed.length === 0) return;
    if (!confirm(`Clear today's 86 list? ${eightySixed.length} item${eightySixed.length === 1 ? "" : "s"} will be back on the menu.`)) return;
    setResetting(true);
    try {
      // Patch each item back. Sequential keeps the request count bounded
      // and matches the dashboard's "test all" pattern.
      for (const it of eightySixed) {
        await fetch(`/api/cafe/menu-items/${it.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sold_out_at: null }),
        });
      }
      await load();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageHeader
        title="Cafe menu"
        crumb="Console · Cafe"
        desc="Manage menu items, recipes, and the daily 86 list. Items added here trigger recipe-based ingredient decrement on tab close."
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center font-display uppercase"
            style={{
              fontSize: "0.85rem",
              letterSpacing: "0.06em",
              fontWeight: 700,
              padding: "0 1rem",
              minHeight: 48,
              color: "var(--void)",
              background: "var(--orange)",
              border: "1px solid var(--orange)",
            }}
          >
            New menu item
          </button>
        }
      />

      {/* 86-list summary band — surfaces today's sold-out items for the
          opening-shift sweep. Bulk reset wipes the list back to clean. */}
      {eightySixed.length > 0 && (
        <div
          className="flex items-start justify-between gap-3 flex-wrap"
          style={{
            background: "var(--red-mute)",
            border: "1px solid rgba(214,90,90,0.35)",
            padding: "0.75rem 1rem",
          }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="font-mono uppercase"
              style={{ fontSize: "0.62rem", letterSpacing: "0.22em", fontWeight: 600, color: "var(--red)" }}
            >
              86 list · today
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {eightySixed.map((it) => (
                <span
                  key={it.id}
                  className="font-mono"
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--ink)",
                    padding: "2px 8px",
                    background: "var(--panel)",
                    border: "1px solid var(--rule-hi)",
                  }}
                >
                  {it.name}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={resetAll86}
            disabled={resetting}
            className="font-mono uppercase border px-3 disabled:opacity-30"
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.18em",
              fontWeight: 600,
              minHeight: 36,
              color: "var(--ink-soft)",
              borderColor: "var(--rule-hi)",
              background: "var(--panel)",
            }}
          >
            {resetting ? "Resetting…" : "Reset all 86"}
          </button>
        </div>
      )}

      <div className="ar-zone">
        <div className="ar-zone-head">
          <span>Items</span>
          <span>{loading ? "Loading…" : `${items.length} total`}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-ink-soft text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-ink-soft text-sm mb-4">
              No menu items yet. Create your first to start tracking recipes.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center font-display uppercase"
              style={{
                fontSize: "0.85rem",
                letterSpacing: "0.06em",
                fontWeight: 700,
                padding: "0 1rem",
                minHeight: 48,
                color: "var(--void)",
                background: "var(--orange)",
                border: "1px solid var(--orange)",
              }}
            >
              New menu item
            </button>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {items.map((mi) => (
              <MenuItemRow key={mi.id} item={mi} onChange={load} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateMenuItemModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single menu item row + inline edit + recipe management             */
/* ------------------------------------------------------------------ */

function MenuItemRow({ item, onChange }: { item: MenuItem; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [priceText, setPriceText] = useState((item.price_cents / 100).toFixed(2));
  const [available, setAvailable] = useState(item.available);
  const [ageRestricted, setAgeRestricted] = useState(item.age_restricted);
  const [prepSeconds, setPrepSeconds] = useState(item.prep_seconds?.toString() ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showDietary, setShowDietary] = useState(false);

  const isSoldOut = !!item.sold_out_at;

  async function patch(updates: Record<string, unknown>) {
    const res = await fetch(`/api/cafe/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) onChange();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Update failed");
    }
  }

  async function toggleSoldOut() {
    await patch({ sold_out_at: isSoldOut ? null : true });
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      const cents = parseDollars(priceText);
      await patch({
        name: name.trim(),
        category,
        price_cents: cents,
        available,
        age_restricted: ageRestricted,
        prep_seconds: prepSeconds ? parseInt(prepSeconds) : null,
      });
      setEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function destroy() {
    if (!confirm(`Disable "${item.name}"? It will be hidden from new tabs but historical data is preserved.`)) return;
    const res = await fetch(`/api/cafe/menu-items/${item.id}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="0.00"
                className="w-20 rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground font-mono"
              />
              <input
                type="number"
                min={0}
                value={prepSeconds}
                onChange={(e) => setPrepSeconds(e.target.value)}
                placeholder="prep s"
                className="w-20 rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground font-mono"
              />
              <label className="flex items-center gap-1 text-xs text-ink-soft">
                <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
                Available
              </label>
              <label className="flex items-center gap-1 text-xs text-ink-soft">
                <input type="checkbox" checked={ageRestricted} onChange={(e) => setAgeRestricted(e.target.checked)} />
                21+
              </label>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground font-medium">{item.name}</span>
                <span className="font-mono text-cream">{formatCents(item.price_cents)}</span>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint">{item.category}</span>
                {isSoldOut && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/40">
                    86'd
                  </span>
                )}
                {!item.available && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                    Off menu
                  </span>
                )}
                {item.age_restricted && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40">
                    21+
                  </span>
                )}
                {item.prep_seconds != null && (
                  <span className="text-[10px] text-ink-faint">{item.prep_seconds}s prep</span>
                )}
                {/* Dietary flag badges. Color intent: green = wins (vegan/GF),
                    amber = warnings (allergens). Showing only the trues. */}
                {item.dietary_info?.is_vegan && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      fontWeight: 600,
                      color: "var(--teal)",
                      border: "1px solid rgba(94,176,155,0.35)",
                      background: "var(--teal-mute)",
                      padding: "1px 5px",
                    }}
                  >
                    Vegan
                  </span>
                )}
                {item.dietary_info?.is_vegetarian && !item.dietary_info?.is_vegan && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      fontWeight: 600,
                      color: "var(--teal)",
                      border: "1px solid rgba(94,176,155,0.30)",
                      padding: "1px 5px",
                    }}
                  >
                    Veg
                  </span>
                )}
                {item.dietary_info?.is_gluten_free && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      fontWeight: 600,
                      color: "var(--teal)",
                      border: "1px solid rgba(94,176,155,0.30)",
                      padding: "1px 5px",
                    }}
                  >
                    GF
                  </span>
                )}
                {item.dietary_info?.is_dairy_free && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.16em",
                      fontWeight: 600,
                      color: "var(--teal)",
                      border: "1px solid rgba(94,176,155,0.30)",
                      padding: "1px 5px",
                    }}
                  >
                    DF
                  </span>
                )}
                {item.dietary_info?.allergens && item.dietary_info.allergens.length > 0 && (
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "0.55rem",
                      letterSpacing: "0.14em",
                      fontWeight: 600,
                      color: "var(--yellow)",
                      border: "1px solid rgba(251,219,101,0.35)",
                      background: "var(--yellow-mute)",
                      padding: "1px 5px",
                    }}
                    title={`Contains: ${item.dietary_info.allergens.map(allergenLabel).join(", ")}`}
                  >
                    Contains {item.dietary_info.allergens.length}
                  </span>
                )}
                {item.dietary_info?.calories != null && (
                  <span className="text-[10px] text-ink-faint">{item.dietary_info.calories} cal</span>
                )}
              </div>
              {item.description && (
                <div
                  className="text-ink-soft mt-1 max-w-[60ch]"
                  style={{ fontSize: "0.78rem", lineHeight: 1.5 }}
                >
                  {item.description}
                </div>
              )}
              <div className="text-[11px] text-ink-faint mt-0.5">
                {item.recipes.length === 0
                  ? "No recipe — sale won't decrement inventory"
                  : `${item.recipes.length} ingredient${item.recipes.length === 1 ? "" : "s"} linked`}
                {item.dietary_info?.allergens && item.dietary_info.allergens.length > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: "var(--yellow)" }}>
                      Contains: {item.dietary_info.allergens.map(allergenLabel).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="font-mono uppercase text-[10px] px-2 py-1 disabled:opacity-30"
                style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setName(item.name);
                  setCategory(item.category);
                  setPriceText((item.price_cents / 100).toFixed(2));
                  setAvailable(item.available);
                  setAgeRestricted(item.age_restricted);
                  setPrepSeconds(item.prep_seconds?.toString() ?? "");
                }}
                className="font-mono uppercase text-[10px] px-2 py-1 text-ink-soft border border-rule"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleSoldOut}
                className="font-mono uppercase text-[10px] px-2 py-1 border"
                style={{
                  borderColor: isSoldOut ? "var(--teal)" : "var(--rule)",
                  color: isSoldOut ? "var(--teal)" : "var(--ink-soft)",
                }}
              >
                {isSoldOut ? "Un-86" : "86 it"}
              </button>
              <button
                onClick={() => setShowRecipes(!showRecipes)}
                className="font-mono uppercase text-[10px] px-2 py-1 border border-rule text-ink-soft hover:text-ink"
              >
                {showRecipes ? "Hide recipe" : "Recipe"}
              </button>
              <button
                onClick={() => setShowDietary(true)}
                className="font-mono uppercase text-[10px] px-2 py-1 border border-rule text-ink-soft hover:text-ink"
                title={
                  hasDietaryInfo(item.dietary_info)
                    ? `Edit dietary info${
                        item.dietary_info?.allergens && item.dietary_info.allergens.length > 0
                          ? ` (${item.dietary_info.allergens.length} allergen${
                              item.dietary_info.allergens.length === 1 ? "" : "s"
                            })`
                          : ""
                      }`
                    : "Add dietary info"
                }
              >
                Dietary{hasDietaryInfo(item.dietary_info) ? " ✓" : ""}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="font-mono uppercase text-[10px] px-2 py-1 border border-rule text-ink-soft hover:text-ink"
              >
                Edit
              </button>
              <button
                onClick={destroy}
                className="font-mono uppercase text-[10px] px-2 py-1 text-red-400 hover:text-red-300"
              >
                Disable
              </button>
            </>
          )}
        </div>
      </div>

      {showRecipes && <RecipePanel item={item} onChange={onChange} />}

      {showDietary && (
        <DietaryEditModal
          item={item}
          onClose={() => setShowDietary(false)}
          onSaved={() => {
            setShowDietary(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recipe panel — list of ingredient links + add/remove                */
/* ------------------------------------------------------------------ */

function RecipePanel({ item, onChange }: { item: MenuItem; onChange: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<InventorySearchResult[]>([]);
  const [picked, setPicked] = useState<InventorySearchResult | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!search.trim() || picked) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const items = (data.items ?? data ?? []) as InventorySearchResult[];
        setResults(items.slice(0, 6));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, picked]);

  async function addRecipe() {
    if (!picked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cafe/menu-items/${item.id}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: picked.id,
          quantity_used: parseFloat(quantity) || 1,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setPicked(null);
        setSearch("");
        setQuantity("1");
        setNotes("");
        onChange();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Add failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRecipe(recipeId: string) {
    if (!confirm("Remove this ingredient from the recipe?")) return;
    const res = await fetch(`/api/cafe/recipes/${recipeId}`, { method: "DELETE" });
    if (res.ok) onChange();
  }

  return (
    <div className="mt-3 pt-3 border-t border-rule">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-2">Recipe ingredients</div>

      {item.recipes.length === 0 ? (
        <p className="text-xs text-ink-faint mb-2">No ingredients linked.</p>
      ) : (
        <div className="flex flex-col gap-1 mb-2">
          {item.recipes.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 text-xs px-2 py-1 rounded"
              style={{ background: "var(--panel-mute)" }}
            >
              <span className="font-mono text-cream">{r.quantity_used}×</span>
              <span className="text-ink flex-1 truncate">{r.inventory_item.name}</span>
              <span className="text-[10px] text-ink-faint">qty {r.inventory_item.quantity}</span>
              {r.notes && <span className="text-[10px] text-ink-faint italic">· {r.notes}</span>}
              <button
                onClick={() => removeRecipe(r.id)}
                className="text-[10px] text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[12rem]">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-0.5">Add ingredient</div>
          {picked ? (
            <div className="flex items-center justify-between rounded border border-card-border bg-card px-2 py-1">
              <span className="text-sm text-foreground">{picked.name}</span>
              <button onClick={() => setPicked(null)} className="text-xs text-ink-soft">×</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory…"
                className="w-full rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground"
              />
              {results.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-h-32 overflow-y-auto rounded border border-card-border bg-card">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setPicked(r)}
                      className="text-left px-2 py-1 text-xs hover:bg-card-hover"
                    >
                      {r.name}{" "}
                      <span className="text-ink-faint">qty {r.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-0.5">Qty per sale</div>
          <input
            type="number"
            min="0"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20 rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground font-mono"
          />
        </div>
        <div className="flex-1 min-w-[8rem]">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-0.5">Notes (optional)</div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "1 shot espresso"'
            className="w-full rounded border border-input-border bg-input-bg px-2 py-1 text-sm text-foreground"
          />
        </div>
        <button
          onClick={addRecipe}
          disabled={!picked || submitting}
          className="font-mono uppercase text-[10px] px-2.5 py-1.5 disabled:opacity-30"
          style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
        >
          {submitting ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create-menu-item modal                                              */
/* ------------------------------------------------------------------ */

function CreateMenuItemModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("drink");
  const [priceText, setPriceText] = useState("");
  const [description, setDescription] = useState("");
  const [prepSeconds, setPrepSeconds] = useState("");
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [dietary, setDietary] = useState<DietaryInfo>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cafe/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          price_cents: parseDollars(priceText),
          description: description.trim() || undefined,
          prep_seconds: prepSeconds ? parseInt(prepSeconds, 10) : null,
          age_restricted: ageRestricted,
          dietary_info: hasDietaryInfo(dietary) ? dietary : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="New menu item" onClose={onClose}>
      <div className="p-4 space-y-3">
        <Field label="Name" required>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Latte, Drip Coffee, Pizza Slice…"
            className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price">
            <input
              type="text"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              placeholder="3.50"
              className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground font-mono"
            />
          </Field>
          <Field label="Prep (sec)">
            <input
              type="number"
              min={0}
              value={prepSeconds}
              onChange={(e) => setPrepSeconds(e.target.value)}
              placeholder="60"
              className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground font-mono"
            />
          </Field>
        </div>
        <Field label="Description (shown on tableside menu)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Single-origin pour-over, oat milk available."
            className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={ageRestricted} onChange={(e) => setAgeRestricted(e.target.checked)} />
          Age-restricted (21+)
        </label>

        <DietaryEditor value={dietary} onChange={setDietary} />

        {error && <div className="text-xs" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-rule" style={{ background: "var(--panel-hi)" }}>
        <button onClick={onClose} className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
          style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Dietary editor — used by both create modal + per-row dietary edit  */
/* ------------------------------------------------------------------ */

function DietaryEditor({ value, onChange }: { value: DietaryInfo; onChange: (v: DietaryInfo) => void }) {
  const allergens = value.allergens ?? [];

  function toggleAllergen(tag: string) {
    const next = allergens.includes(tag)
      ? allergens.filter((a) => a !== tag)
      : [...allergens, tag];
    onChange({ ...value, allergens: next.length > 0 ? next : undefined });
  }

  return (
    <div
      style={{
        background: "var(--panel-mute)",
        border: "1px solid var(--rule)",
        padding: "0.75rem",
      }}
    >
      <div
        className="font-mono uppercase text-ink-soft mb-2"
        style={{ fontSize: "0.6rem", letterSpacing: "0.22em", fontWeight: 600 }}
      >
        Dietary
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        <DietaryToggle
          label="Vegan"
          checked={!!value.is_vegan}
          onChange={(v) => onChange({ ...value, is_vegan: v || undefined, ...(v ? { is_vegetarian: true } : {}) })}
        />
        <DietaryToggle
          label="Vegetarian"
          checked={!!value.is_vegetarian}
          onChange={(v) => onChange({ ...value, is_vegetarian: v || undefined })}
        />
        <DietaryToggle
          label="Gluten-free"
          checked={!!value.is_gluten_free}
          onChange={(v) => onChange({ ...value, is_gluten_free: v || undefined })}
        />
        <DietaryToggle
          label="Dairy-free"
          checked={!!value.is_dairy_free}
          onChange={(v) => onChange({ ...value, is_dairy_free: v || undefined })}
        />
      </div>
      <div className="mb-3">
        <div
          className="font-mono uppercase text-ink-faint mb-1.5"
          style={{ fontSize: "0.55rem", letterSpacing: "0.22em", fontWeight: 600 }}
        >
          Allergens (FDA top 9)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_ALLERGENS.map((tag) => {
            const on = allergens.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleAllergen(tag)}
                className="font-mono uppercase border"
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                  padding: "0.3rem 0.55rem",
                  color: on ? "var(--yellow)" : "var(--ink-soft)",
                  borderColor: on ? "rgba(251,219,101,0.5)" : "var(--rule)",
                  background: on ? "var(--yellow-mute)" : "transparent",
                }}
              >
                {allergenLabel(tag)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Calories (per serving)">
          <input
            type="number"
            min={0}
            value={value.calories ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...value, calories: v ? parseInt(v, 10) : undefined });
            }}
            className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground font-mono"
          />
        </Field>
        <Field label="Notes">
          <input
            type="text"
            value={value.notes ?? ""}
            onChange={(e) => onChange({ ...value, notes: e.target.value || undefined })}
            placeholder="Made on shared equipment with peanuts"
            className="w-full rounded border border-input-border bg-input-bg px-2 py-1.5 text-sm text-foreground"
          />
        </Field>
      </div>
    </div>
  );
}

function DietaryToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block font-mono uppercase text-ink-faint mb-1"
        style={{ fontSize: "0.55rem", letterSpacing: "0.22em", fontWeight: 600 }}
      >
        {label}
        {required ? <span className="ml-1" style={{ color: "var(--orange)" }}>*</span> : null}
      </span>
      {children}
    </label>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule shrink-0">
          <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 800, color: "var(--cream)" }}>
            {title}
          </h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-xl">×</button>
        </div>
        <div className="overflow-y-auto flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-row dietary editor modal — opened from the "Dietary" button.   */
/* ------------------------------------------------------------------ */

function DietaryEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: MenuItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dietary, setDietary] = useState<DietaryInfo>(item.dietary_info ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cafe/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietary_info: dietary }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Dietary · ${item.name}`} onClose={onClose}>
      <div className="p-4">
        <DietaryEditor value={dietary} onChange={setDietary} />
        {error && <div className="text-xs mt-2" style={{ color: "var(--red)" }}>{error}</div>}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-rule" style={{ background: "var(--panel-hi)" }}>
        <button onClick={onClose} className="font-mono uppercase text-xs px-3 py-1.5 border border-rule text-ink-soft">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="font-mono uppercase text-xs px-3 py-1.5 disabled:opacity-30"
          style={{ background: "var(--orange)", color: "var(--void)", border: "1px solid var(--orange)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </ModalShell>
  );
}
