"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents, parseDollars } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Item Advanced Panels                                               */
/*  Aggregates Phase 2 capabilities into one collapsible section that  */
/*  drops into the existing inventory item detail page without forcing*/
/*  a full layout refactor:                                            */
/*    - Multi-barcode editor                                           */
/*    - Vendor links (preferred distributor + per-vendor SKU/cost)     */
/*    - Variants (parent or sibling family + add-variant flow)         */
/*    - Cost history (timeline of every cost change)                   */
/* ------------------------------------------------------------------ */

interface ItemSummary {
  id: string;
  name: string;
  cost_cents: number;
  first_cost_cents: number | null;
  last_cost_cents: number | null;
  barcode: string | null;
  barcodes: string[];
  parent_id: string | null;
  variant_label: string | null;
}

interface SupplierBrief {
  id: string;
  name: string;
  account_number?: string | null;
}

interface VendorLink {
  id: string;
  supplier_id: string;
  vendor_sku: string | null;
  case_pack: number | null;
  last_cost_cents: number | null;
  preferred: boolean;
  notes: string | null;
  supplier: SupplierBrief;
}

interface CostHistoryRow {
  id: string;
  cost_cents: number;
  source: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  quantity: number | null;
  note: string | null;
  created_at: string;
}

interface VariantSibling {
  id: string;
  name: string;
  variant_label: string | null;
  quantity: number;
  price_cents: number;
}

interface ItemAdvancedPanelsProps {
  item: ItemSummary;
  /** Bumped when the parent page wants the panels to refetch. */
  refreshKey?: number;
  /** Called when an action mutates the parent item (rename, barcode change). */
  onItemUpdated?: () => void;
}

function SectionHeader({
  label,
  expanded,
  onToggle,
  badge,
  action,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-3 cursor-pointer"
      onClick={onToggle}
      style={{
        padding: "0.75rem 1rem",
        background: "var(--panel-mute)",
        borderBottom: expanded ? "1px solid var(--rule)" : "none",
        userSelect: "none",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            color: "var(--orange)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            fontWeight: 700,
            width: 14,
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "0.95rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--orange)",
              padding: "2px 6px",
              border: "1px solid var(--orange)",
              background: "var(--orange-mute)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {action && (
        <div onClick={(e) => e.stopPropagation()}>{action}</div>
      )}
    </header>
  );
}

// ─────────────────────────── Multi-barcode ───────────────────────────

function BarcodesPanel({ item, onItemUpdated }: { item: ItemSummary; onItemUpdated?: () => void }) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const all = [
    ...(item.barcode ? [{ value: item.barcode, primary: true }] : []),
    ...item.barcodes.filter((b) => b !== item.barcode).map((b) => ({ value: b, primary: false })),
  ];

  async function save(barcodes: string[], primary?: string) {
    setPending(true);
    try {
      await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          ...(primary !== undefined ? { barcode: primary } : {}),
          barcodes,
        }),
      });
      onItemUpdated?.();
    } finally {
      setPending(false);
    }
  }

  function addBarcode() {
    const val = draft.trim();
    if (!val) return;
    if (all.some((b) => b.value === val)) {
      setDraft("");
      return;
    }
    // Add as alternate; primary stays as is
    const nextAlts = Array.from(new Set([...item.barcodes, val]));
    save(nextAlts);
    setDraft("");
  }

  function removeBarcode(value: string) {
    if (value === item.barcode) {
      // Demote the primary — promote the first alt to primary if any
      const remaining = item.barcodes.filter((b) => b !== value);
      const newPrimary = remaining[0] ?? "";
      const newAlts = remaining.slice(1);
      save(newAlts, newPrimary);
    } else {
      save(item.barcodes.filter((b) => b !== value));
    }
  }

  function makePrimary(value: string) {
    if (value === item.barcode) return;
    const nextAlts = [
      ...(item.barcode ? [item.barcode] : []),
      ...item.barcodes.filter((b) => b !== value && b !== item.barcode),
    ];
    save(nextAlts, value);
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-ink-soft" style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
        One item can scan as multiple barcodes — useful when a publisher reprints with a new UPC, or when you've re-labeled inventory in-house.
      </p>

      {all.length === 0 ? (
        <div className="border border-dashed border-rule px-3 py-4 text-center text-ink-faint" style={{ fontSize: "0.8rem" }}>
          No barcodes assigned yet
        </div>
      ) : (
        <div className="border border-rule">
          {all.map((b, idx) => (
            <div
              key={b.value}
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: idx < all.length - 1 ? "1px solid var(--rule-faint)" : "none" }}
            >
              <code style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--ink)" }}>{b.value}</code>
              {b.primary ? (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: "var(--teal)",
                    padding: "2px 6px",
                    border: "1px solid var(--teal)",
                    background: "var(--teal-mute)",
                  }}
                >
                  Primary
                </span>
              ) : (
                <button
                  onClick={() => makePrimary(b.value)}
                  disabled={pending}
                  className="text-orange hover:opacity-80"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
                >
                  Make Primary
                </button>
              )}
              <button
                onClick={() => removeBarcode(b.value)}
                disabled={pending}
                className="text-red hover:opacity-80"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addBarcode();
          }}
          placeholder="Scan or type a barcode"
          className="flex-1 border border-rule-hi bg-panel-mute text-ink px-3"
          style={{ height: 38, fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}
        />
        <button
          onClick={addBarcode}
          disabled={!draft.trim() || pending}
          className="bg-orange text-void disabled:opacity-30"
          style={{ height: 38, padding: "0 1rem", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Vendor Links ───────────────────────────

function VendorsPanel({ item }: { item: ItemSummary }) {
  const [links, setLinks] = useState<VendorLink[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftSku, setDraftSku] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const [draftCasePack, setDraftCasePack] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [linksRes, supRes] = await Promise.all([
        fetch(`/api/inventory/${item.id}/vendors`),
        fetch("/api/suppliers"),
      ]);
      if (linksRes.ok) setLinks(await linksRes.json());
      if (supRes.ok) {
        const data = await supRes.json();
        setSuppliers(Array.isArray(data) ? data : data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLink() {
    if (!draftSupplier) return;
    const cost = draftCost ? parseDollars(draftCost) : null;
    const casePack = draftCasePack ? parseInt(draftCasePack, 10) : null;
    await fetch(`/api/inventory/${item.id}/vendors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_id: draftSupplier,
        vendor_sku: draftSku || null,
        last_cost_cents: cost,
        case_pack: casePack && casePack > 0 ? casePack : null,
        preferred: links.length === 0,
      }),
    });
    setDraftSupplier("");
    setDraftSku("");
    setDraftCost("");
    setDraftCasePack("");
    load();
  }

  async function setPreferred(linkId: string) {
    await fetch(`/api/inventory/${item.id}/vendors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId, preferred: true }),
    });
    load();
  }

  async function removeLink(linkId: string) {
    await fetch(`/api/inventory/${item.id}/vendors?link_id=${linkId}`, { method: "DELETE" });
    load();
  }

  const availableSuppliers = suppliers.filter((s) => !links.some((l) => l.supplier_id === s.id));

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-ink-soft" style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
        Link this item to one or more distributors with vendor SKUs and case pack. Mark one as preferred — that's where reorder will default to.
      </p>

      {loading ? (
        <div className="text-ink-faint text-sm">Loading…</div>
      ) : links.length === 0 ? (
        <div className="border border-dashed border-rule px-3 py-4 text-center text-ink-faint" style={{ fontSize: "0.8rem" }}>
          No vendor links yet
        </div>
      ) : (
        <div className="border border-rule">
          {links.map((l, idx) => (
            <div
              key={l.id}
              className="px-3 py-3 grid items-center gap-2"
              style={{
                gridTemplateColumns: "auto 1fr auto auto auto",
                borderBottom: idx < links.length - 1 ? "1px solid var(--rule-faint)" : "none",
                background: l.preferred ? "var(--orange-mute)" : "transparent",
              }}
            >
              <input
                type="radio"
                checked={l.preferred}
                onChange={() => setPreferred(l.id)}
                aria-label="Preferred vendor"
              />
              <div className="min-w-0">
                <div className="text-ink truncate" style={{ fontWeight: 500 }}>
                  {l.supplier.name}
                  {l.supplier.account_number && (
                    <span className="text-ink-faint ml-2" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      ({l.supplier.account_number})
                    </span>
                  )}
                </div>
                {l.vendor_sku && (
                  <div className="text-ink-soft" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    SKU: {l.vendor_sku}
                  </div>
                )}
              </div>
              <div className="text-ink-soft tabular-nums" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", textAlign: "right" }}>
                {l.last_cost_cents != null ? formatCents(l.last_cost_cents) : "—"}
                {l.case_pack && (
                  <div className="text-ink-faint" style={{ fontSize: "0.7rem" }}>
                    /{l.case_pack}
                  </div>
                )}
              </div>
              {l.preferred && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    color: "var(--orange)",
                    padding: "2px 6px",
                    border: "1px solid var(--orange)",
                  }}
                >
                  Preferred
                </span>
              )}
              <button
                onClick={() => removeLink(l.id)}
                className="text-red hover:opacity-80"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new link */}
      {availableSuppliers.length > 0 ? (
        <div
          className="border border-rule-hi p-3 grid gap-2"
          style={{ gridTemplateColumns: "1fr 1fr 100px 80px auto", background: "var(--panel-mute)" }}
        >
          <select
            value={draftSupplier}
            onChange={(e) => setDraftSupplier(e.target.value)}
            className="border border-rule-hi bg-panel text-ink px-2"
            style={{ height: 38, fontSize: "0.9rem" }}
          >
            <option value="">Pick distributor…</option>
            {availableSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={draftSku}
            onChange={(e) => setDraftSku(e.target.value)}
            placeholder="Vendor SKU"
            className="border border-rule-hi bg-panel text-ink px-2"
            style={{ height: 38, fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}
          />
          <input
            type="text"
            inputMode="decimal"
            value={draftCost}
            onChange={(e) => setDraftCost(e.target.value)}
            placeholder="Cost"
            className="border border-rule-hi bg-panel text-ink px-2 tabular-nums"
            style={{ height: 38, fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}
          />
          <input
            type="text"
            inputMode="numeric"
            value={draftCasePack}
            onChange={(e) => setDraftCasePack(e.target.value)}
            placeholder="Case"
            className="border border-rule-hi bg-panel text-ink px-2 tabular-nums"
            style={{ height: 38, fontSize: "0.9rem", fontFamily: "var(--font-mono)" }}
          />
          <button
            onClick={addLink}
            disabled={!draftSupplier}
            className="bg-orange text-void disabled:opacity-30"
            style={{ height: 38, padding: "0 1rem", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            Add
          </button>
        </div>
      ) : suppliers.length === 0 ? (
        <p className="text-ink-faint text-sm">
          No suppliers set up yet. Add suppliers under{" "}
          <a href="/dashboard/purchase-orders" className="text-orange underline">
            Purchase Orders
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────── Variants ───────────────────────────

function VariantsPanel({ item }: { item: ItemSummary }) {
  const [parent, setParent] = useState<VariantSibling | null>(null);
  const [siblings, setSiblings] = useState<VariantSibling[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLink, setShowLink] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [parentResults, setParentResults] = useState<VariantSibling[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inventory/${item.id}/variants`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setParent(data.parent);
          setSiblings((data.variants || []).filter((v: VariantSibling) => v.id !== item.id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  useEffect(() => {
    if (!showLink) return;
    const t = setTimeout(async () => {
      const q = parentSearch.trim();
      if (q.length < 2) {
        setParentResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setParentResults(
            (data || []).filter((d: VariantSibling) => d.id !== item.id).slice(0, 10),
          );
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [parentSearch, showLink, item.id]);

  async function setParentTo(parentId: string | null, ownLabel?: string) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        parent_id: parentId,
        ...(ownLabel !== undefined ? { variant_label: ownLabel } : {}),
      }),
    });
    setShowLink(false);
    // Force refetch
    const res = await fetch(`/api/inventory/${item.id}/variants`);
    if (res.ok) {
      const data = await res.json();
      setParent(data.parent);
      setSiblings((data.variants || []).filter((v: VariantSibling) => v.id !== item.id));
    }
  }

  if (loading) return <div className="px-4 py-3 text-ink-faint text-sm">Loading…</div>;

  const isStandalone = !item.parent_id && siblings.length === 0;

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-ink-soft" style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
        Variants group items that share a base identity but differ in cover, edition, or condition (Pandemic Legacy seasons, D&D printings, MTG art alternatives).
      </p>

      {item.parent_id && parent && (
        <div className="border border-rule px-3 py-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
              Variant of
            </div>
            <a href={`/dashboard/inventory/${parent.id}`} className="text-ink hover:text-orange" style={{ fontWeight: 500 }}>
              {parent.name}
            </a>
            {item.variant_label && (
              <span className="text-ink-soft ml-2" style={{ fontSize: "0.85rem" }}>
                ({item.variant_label})
              </span>
            )}
          </div>
          <button
            onClick={() => setParentTo(null, "")}
            className="text-red hover:opacity-80"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Unlink
          </button>
        </div>
      )}

      {siblings.length > 0 && (
        <div>
          <div className="text-ink-faint mb-1" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
            {item.parent_id ? "Sibling variants" : "Variants of this item"}
          </div>
          <div className="border border-rule">
            {siblings.map((s, idx) => (
              <a
                key={s.id}
                href={`/dashboard/inventory/${s.id}`}
                className="flex items-center justify-between px-3 py-2 hover:bg-panel-mute"
                style={{
                  borderBottom: idx < siblings.length - 1 ? "1px solid var(--rule-faint)" : "none",
                }}
              >
                <div>
                  <span className="text-ink">{s.name}</span>
                  {s.variant_label && (
                    <span className="text-ink-soft ml-2" style={{ fontSize: "0.85rem" }}>
                      ({s.variant_label})
                    </span>
                  )}
                </div>
                <span className="text-ink-faint tabular-nums" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  {s.quantity} on hand
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {isStandalone && (
        <div className="text-ink-faint" style={{ fontSize: "0.85rem" }}>
          Stand-alone item. Link to a parent to make this a variant.
        </div>
      )}

      {/* Variant label edit when this item IS a variant */}
      {item.parent_id && (
        <div className="flex items-center gap-2">
          <span className="text-ink-soft" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            Variant label:
          </span>
          <input
            type="text"
            defaultValue={item.variant_label ?? ""}
            onBlur={(e) => setParentTo(item.parent_id, e.target.value)}
            placeholder="e.g. Cover A, Foil, Season 1"
            className="flex-1 border border-rule-hi bg-panel-mute text-ink px-3"
            style={{ height: 36, fontSize: "0.9rem" }}
          />
        </div>
      )}

      {/* Link to parent */}
      {!showLink ? (
        !item.parent_id && (
          <button
            onClick={() => setShowLink(true)}
            className="text-orange hover:opacity-80"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
          >
            + Link to a parent variant
          </button>
        )
      ) : (
        <div className="border border-rule-hi p-3 space-y-2" style={{ background: "var(--panel-mute)" }}>
          <input
            type="text"
            value={parentSearch}
            onChange={(e) => setParentSearch(e.target.value)}
            placeholder="Search items to set as parent…"
            autoFocus
            className="w-full border border-rule-hi bg-panel text-ink px-3"
            style={{ height: 38, fontSize: "0.9rem" }}
          />
          {parentResults.length > 0 && (
            <div className="border border-rule">
              {parentResults.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => setParentTo(r.id)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-mute"
                  style={{ borderBottom: idx < parentResults.length - 1 ? "1px solid var(--rule-faint)" : "none" }}
                >
                  <div className="text-ink">{r.name}</div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowLink(false)}
            className="text-ink-faint hover:text-ink"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Cost History ───────────────────────────

function CostHistoryPanel({ item }: { item: ItemSummary }) {
  const [history, setHistory] = useState<CostHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inventory/${item.id}/cost-history`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  return (
    <div className="px-4 py-4 space-y-3">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
      >
        <div>
          <div className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            Current
          </div>
          <div className="text-orange tabular-nums" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem" }}>
            {formatCents(item.cost_cents)}
          </div>
        </div>
        <div>
          <div className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            First
          </div>
          <div className="text-ink tabular-nums" style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
            {item.first_cost_cents != null ? formatCents(item.first_cost_cents) : "—"}
          </div>
        </div>
        <div>
          <div className="text-ink-faint" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            Last
          </div>
          <div className="text-ink tabular-nums" style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
            {item.last_cost_cents != null ? formatCents(item.last_cost_cents) : "—"}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-ink-faint text-sm">Loading…</div>
      ) : history.length === 0 ? (
        <div className="border border-dashed border-rule px-3 py-4 text-center text-ink-faint" style={{ fontSize: "0.8rem" }}>
          No cost changes recorded yet
        </div>
      ) : (
        <div className="border border-rule" style={{ maxHeight: 240, overflowY: "auto" }}>
          {history.map((h, idx) => (
            <div
              key={h.id}
              className="px-3 py-2 grid items-center"
              style={{
                gridTemplateColumns: "auto 1fr auto",
                gap: "0.75rem",
                borderBottom: idx < history.length - 1 ? "1px solid var(--rule-faint)" : "none",
              }}
            >
              <div className="text-ink-faint tabular-nums" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                {new Date(h.created_at).toLocaleDateString()}
              </div>
              <div className="text-ink-soft" style={{ fontSize: "0.85rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    padding: "1px 5px",
                    border: "1px solid var(--rule-hi)",
                    color: "var(--ink-faint)",
                    marginRight: "0.5rem",
                  }}
                >
                  {h.source}
                </span>
                {h.note}
                {h.quantity != null && <span className="text-ink-faint ml-2">×{h.quantity}</span>}
              </div>
              <div className="text-ink tabular-nums" style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 600 }}>
                {formatCents(h.cost_cents)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Aggregator ───────────────────────────

export function ItemAdvancedPanels({ item, onItemUpdated, refreshKey = 0 }: ItemAdvancedPanelsProps) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    barcodes: false,
    vendors: false,
    variants: false,
    history: false,
  });
  const toggle = (key: string) => setOpenMap((m) => ({ ...m, [key]: !m[key] }));

  const sections = [
    {
      key: "vendors",
      label: "Distributors",
      badge: undefined,
      body: <VendorsPanel item={item} />,
    },
    {
      key: "variants",
      label: "Variants",
      body: <VariantsPanel item={item} />,
    },
    {
      key: "barcodes",
      label: "Multi-Barcode",
      badge: item.barcodes.length + (item.barcode ? 1 : 0) > 1 ? `${item.barcodes.length + (item.barcode ? 1 : 0)}` : undefined,
      body: <BarcodesPanel item={item} onItemUpdated={onItemUpdated} />,
    },
    {
      key: "history",
      label: "Cost History",
      body: <CostHistoryPanel item={item} />,
    },
  ];

  return (
    <div className="border border-rule mt-4" key={refreshKey}>
      {sections.map((s, idx) => (
        <div key={s.key} style={{ borderBottom: idx < sections.length - 1 ? "1px solid var(--rule)" : "none" }}>
          <SectionHeader
            label={s.label}
            expanded={!!openMap[s.key]}
            onToggle={() => toggle(s.key)}
            badge={s.badge}
          />
          {openMap[s.key] && s.body}
        </div>
      ))}
    </div>
  );
}
