"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Break Now Modal                                                    */
/*  Crack a sealed case / box. Pick the child item(s), set the qty per */
/*  parent, submit. Parent quantity decrements; children quantity      */
/*  increments; cost is split proportionally; a break event row is     */
/*  written for audit; cost history rows are written per child.        */
/* ------------------------------------------------------------------ */

interface ParentItem {
  id: string;
  name: string;
  quantity: number;
  cost_cents: number;
}

interface ChildHit {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price_cents: number;
}

interface ChildLine {
  inventory_id: string;
  name: string;
  qty: number;
}

interface BreakRecipe {
  id: string;
  child_qty_per_parent: number;
  name: string | null;
  child: { id: string; name: string; quantity: number };
}

interface BreakNowModalProps {
  parent: ParentItem;
  open: boolean;
  onClose: () => void;
  onBroken?: () => void;
}

export function BreakNowModal({ parent, open, onClose, onBroken }: BreakNowModalProps) {
  const [parentQty, setParentQty] = useState(1);
  const [children, setChildren] = useState<ChildLine[]>([]);
  const [recipes, setRecipes] = useState<BreakRecipe[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ChildHit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);

  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch(`/api/break-recipes?parent_id=${parent.id}`);
      if (res.ok) setRecipes(await res.json());
    } catch {}
  }, [parent.id]);

  useEffect(() => {
    if (open) {
      setParentQty(1);
      setChildren([]);
      setSearch("");
      setSearchResults([]);
      setError(null);
      setSaveAsRecipe(false);
      loadRecipes();
    }
  }, [open, loadRecipes]);

  // Search child items (only on demand)
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            (data || [])
              .filter((d: ChildHit) => d.id !== parent.id)
              .filter((d: ChildHit) => !children.some((c) => c.inventory_id === d.id))
              .slice(0, 10),
          );
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [search, open, parent.id, children]);

  function applyRecipe(r: BreakRecipe) {
    setChildren([
      {
        inventory_id: r.child.id,
        name: r.child.name,
        qty: r.child_qty_per_parent * parentQty,
      },
    ]);
  }

  function addChild(hit: ChildHit) {
    setChildren((prev) => [
      ...prev,
      { inventory_id: hit.id, name: hit.name, qty: 1 * parentQty },
    ]);
    setSearch("");
    setSearchResults([]);
  }

  function updateChildQty(id: string, qty: number) {
    setChildren((prev) =>
      prev.map((c) => (c.inventory_id === id ? { ...c, qty: Math.max(1, qty) } : c)),
    );
  }

  function removeChild(id: string) {
    setChildren((prev) => prev.filter((c) => c.inventory_id !== id));
  }

  async function submit() {
    if (children.length === 0) {
      setError("Add at least one child item");
      return;
    }
    if (parentQty < 1 || parentQty > parent.quantity) {
      setError(`Parent qty must be 1–${parent.quantity}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_inventory_id: parent.id,
          parent_qty_consumed: parentQty,
          children: children.map((c) => ({
            inventory_id: c.inventory_id,
            qty: c.qty,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Break failed");
        setSubmitting(false);
        return;
      }

      // Optionally save as a recipe (only if exactly 1 child — recipes are 1:N)
      if (saveAsRecipe && children.length === 1 && parentQty === 1) {
        await fetch("/api/break-recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_inventory_id: parent.id,
            child_inventory_id: children[0].inventory_id,
            child_qty_per_parent: children[0].qty,
            name: `${parent.name} → ${children[0].name}`,
          }),
        });
      }

      onBroken?.();
      onClose();
    } catch {
      setError("Connection error");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const totalChildUnits = children.reduce((s, c) => s + c.qty, 0);
  const costPerUnit =
    totalChildUnits > 0 ? Math.floor((parent.cost_cents * parentQty) / totalChildUnits) : 0;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-start justify-center pt-12"
      style={{ background: "rgba(7,8,12,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--rule-hi)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid var(--rule)",
            background: "var(--panel-mute)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--orange)" }}>
              Break Inventory
            </div>
            <div className="text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.05rem", marginTop: "0.1rem" }}>
              {parent.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Esc
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1rem", overflowY: "auto", flex: 1 }}>
          {/* Parent qty + summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Break this many
              </label>
              <input
                type="number"
                min={1}
                max={parent.quantity}
                value={parentQty}
                onChange={(e) => setParentQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-full border border-rule-hi bg-panel-mute text-ink px-3 mt-1 tabular-nums"
                style={{ height: 38, fontSize: "1rem", fontFamily: "var(--font-mono)" }}
              />
              <div className="text-ink-faint mt-1" style={{ fontSize: "0.75rem" }}>
                {parent.quantity} on hand · cost {formatCents(parent.cost_cents)} each
              </div>
            </div>
            <div>
              <div className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Cost basis
              </div>
              <div className="text-orange tabular-nums mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700 }}>
                {formatCents(parent.cost_cents * parentQty)}
              </div>
              {totalChildUnits > 0 && (
                <div className="text-ink-faint" style={{ fontSize: "0.75rem" }}>
                  → {formatCents(costPerUnit)} per child unit ({totalChildUnits} units)
                </div>
              )}
            </div>
          </div>

          {/* Recipes */}
          {recipes.length > 0 && children.length === 0 && (
            <div className="mb-4">
              <div className="text-ink-faint mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Quick Recipe
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => applyRecipe(r)}
                    className="border border-rule-hi text-left px-3 py-2 hover:bg-orange-mute"
                    style={{ background: "var(--panel-mute)" }}
                  >
                    <div className="text-ink" style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                      {r.name || `→ ${r.child.name}`}
                    </div>
                    <div className="text-ink-faint" style={{ fontSize: "0.75rem" }}>
                      {r.child_qty_per_parent}× {r.child.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Children list */}
          <div className="text-ink-faint mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            Produces
          </div>
          {children.length === 0 ? (
            <div className="border border-dashed border-rule px-3 py-4 text-center text-ink-faint mb-3" style={{ fontSize: "0.85rem" }}>
              Pick child items below
            </div>
          ) : (
            <div className="border border-rule mb-3">
              {children.map((c, idx) => (
                <div
                  key={c.inventory_id}
                  className="px-3 py-2 grid items-center gap-2"
                  style={{
                    gridTemplateColumns: "1fr 80px auto",
                    borderBottom: idx < children.length - 1 ? "1px solid var(--rule-faint)" : "none",
                  }}
                >
                  <div className="text-ink truncate" style={{ fontWeight: 500 }}>
                    {c.name}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={c.qty}
                    onChange={(e) => updateChildQty(c.inventory_id, parseInt(e.target.value || "1", 10))}
                    className="border border-rule-hi bg-panel-mute text-ink px-2 tabular-nums"
                    style={{ height: 32, fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}
                  />
                  <button
                    onClick={() => removeChild(c.inventory_id)}
                    className="text-red hover:opacity-80"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search to add */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory to add child item…"
            className="w-full border border-rule-hi bg-panel-mute text-ink px-3"
            style={{ height: 38, fontSize: "0.9rem" }}
          />
          {searchResults.length > 0 && (
            <div className="border border-rule mt-2">
              {searchResults.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => addChild(r)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-mute flex items-center justify-between"
                  style={{ borderBottom: idx < searchResults.length - 1 ? "1px solid var(--rule-faint)" : "none" }}
                >
                  <div>
                    <div className="text-ink">{r.name}</div>
                    <div className="text-ink-faint" style={{ fontSize: "0.75rem" }}>
                      {r.category} · {r.quantity} on hand
                    </div>
                  </div>
                  <span className="text-orange-mute">+</span>
                </button>
              ))}
            </div>
          )}

          {children.length === 1 && parentQty === 1 && (
            <label className="flex items-center gap-2 mt-4 text-ink-soft" style={{ fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={saveAsRecipe}
                onChange={(e) => setSaveAsRecipe(e.target.checked)}
              />
              Save as recipe for next time
            </label>
          )}

          {error && (
            <div className="mt-3 text-red bg-red-mute border border-red px-3 py-2" style={{ fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--rule)", display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            disabled={submitting}
            className="border border-rule-hi text-ink-soft hover:text-ink flex-1"
            style={{ height: 44, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || children.length === 0}
            className="bg-orange text-void disabled:opacity-30 flex-1"
            style={{ height: 44, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {submitting ? "Breaking…" : "Confirm Break"}
          </button>
        </div>
      </div>
    </div>
  );
}
