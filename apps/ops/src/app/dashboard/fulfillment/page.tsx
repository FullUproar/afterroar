"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, EmptyState } from "@/components/shared/ui";
import { SubNav } from "@/components/ui/sub-nav";
import { ORDERS_TABS } from "@/lib/nav-groups";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price_cents: number;
  fulfilled: boolean;
  fulfillment_type: string;
  fulfillment_provider: string | null;
  inventory_item?: {
    id: string;
    sku: string | null;
    barcode: string | null;
    image_url: string | null;
    category: string;
    weight_oz: number | null;
    /** Live on-hand at fetch time — used to detect mid-fulfillment shortages. */
    quantity: number;
  } | null;
}

interface ShippingLabel {
  id: string;
  carrier_code: string;
  service_code: string;
  tracking_number: string | null;
  shipment_cost_cents: number;
  created_at: string;
}

interface FulfillmentOrder {
  id: string;
  order_number: string;
  source: string;
  status: string;
  fulfillment_status: string;
  fulfillment_type: string;
  /** Set by ingest when on-hand couldn't cover the ordered qty. */
  is_oversold: boolean;
  total_cents: number;
  shipping_cents: number;
  shipping_method: string | null;
  shipping_carrier: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
  weight_oz: number | null;
  notes: string | null;
  created_at: string;
  shipped_at: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  items: OrderItem[];
  shipping_labels: ShippingLabel[];
}

/** A line item that can't be covered by current on-hand. */
interface ShortItem {
  line_id: string;
  inventory_item_id: string | null;
  name: string;
  ordered: number;
  on_hand: number;
  short_by: number;
}

interface Summary {
  unfulfilled: number;
  picking: number;
  packed: number;
  shipped: number;
  delivered: number;
}

interface ShippingRate {
  carrier: string;
  name: string;
  code: string;
  totalCents: number;
}

type TabFilter = "unfulfilled" | "picking,packed" | "shipped" | "all";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_LABELS: Record<string, string> = {
  online: "Online",
  shopify: "Shopify",
  phone: "Phone",
  pos: "In-Store",
  marketplace: "Marketplace",
};

const FULFILLMENT_TYPE_LABEL: Record<string, string> = {
  merchant: "Self-Fulfill",
  pod: "Print-on-Demand",
  "3pl": "3PL",
};

/* ------------------------------------------------------------------ */
/*  Shared button styles                                               */
/* ------------------------------------------------------------------ */

const ghostBtnStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  letterSpacing: '0.18em',
  fontWeight: 600,
  padding: '0 0.85rem',
  minHeight: 44,
  color: 'var(--ink-soft)',
  border: '1px solid var(--rule-hi)',
  background: 'var(--panel)',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
};

const primaryBtnStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  fontWeight: 700,
  padding: '0 0.9rem',
  minHeight: 44,
  color: 'var(--void)',
  background: 'var(--orange)',
  border: '1px solid var(--orange)',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-display)',
};

const tealBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--teal)',
  border: '1px solid var(--teal)',
};

const yellowBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--yellow)',
  border: '1px solid var(--yellow)',
  color: 'var(--void)',
};

const redBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--red)',
  border: '1px solid var(--red)',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [summary, setSummary] = useState<Summary>({ unfulfilled: 0, picking: 0, packed: 0, shipped: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("unfulfilled");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pullSheetLoading, setPullSheetLoading] = useState(false);

  // Rate shopping state
  const [rateOrderId, setRateOrderId] = useState<string | null>(null);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [generatingLabel, setGeneratingLabel] = useState(false);

  // Oversell resolution state — keyed by order id when the cashier
  // opens the "what to do?" picker. The reconcile dialog uses
  // reconcileQuantities to track per-item user input.
  const [oversellOrderId, setOversellOrderId] = useState<string | null>(null);
  const [oversellAction, setOversellAction] = useState<"backorder" | "cancel" | "reconcile" | null>(null);
  const [oversellSubmitting, setOversellSubmitting] = useState(false);
  const [reconcileQuantities, setReconcileQuantities] = useState<Record<string, number>>({});

  /**
   * Compute which line items are short on inventory at this very moment.
   * Drives the oversell banner — surfaces both ingest-time oversells
   * (is_oversold = true) and the case where stock dropped after ingest
   * (e.g. POS sale snuck in between webhook and fulfillment).
   */
  function getShortItems(order: FulfillmentOrder): ShortItem[] {
    const out: ShortItem[] = [];
    for (const line of order.items) {
      if (line.fulfillment_type !== "merchant") continue;
      const inv = line.inventory_item;
      if (!inv) continue;
      // After ingest we hard-decremented on-hand. So if quantity is now
      // negative, that's exactly how short we are. We treat anything
      // < 0 as a shortage and recommend reconcile / backorder / cancel.
      if (inv.quantity < 0) {
        out.push({
          line_id: line.id,
          inventory_item_id: inv.id,
          name: line.name,
          ordered: line.quantity,
          on_hand: inv.quantity,
          // The shortfall is the absolute negative balance, capped at
          // the line quantity (we can never owe more than we sold).
          short_by: Math.min(line.quantity, Math.abs(inv.quantity)),
        });
      }
    }
    return out;
  }

  async function submitOversellResolution(
    order: FulfillmentOrder,
    action: "backorder" | "cancel" | "reconcile",
  ) {
    setOversellSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        order_id: order.id,
        action,
      };
      if (action === "reconcile") {
        const reconcile_quantities = Object.entries(reconcileQuantities)
          .map(([inventory_item_id, on_hand]) => ({ inventory_item_id, on_hand }))
          .filter((adj) => Number.isFinite(adj.on_hand));
        if (reconcile_quantities.length === 0) {
          setOversellSubmitting(false);
          return;
        }
        body.reconcile_quantities = reconcile_quantities;
      }
      const res = await fetch("/api/fulfillment/oversell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setOversellOrderId(null);
        setOversellAction(null);
        setReconcileQuantities({});
        await fetchOrders();
      }
    } finally {
      setOversellSubmitting(false);
    }
  }

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/fulfillment?status=${tab}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders);
      setSummary(data.summary);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(fetchOrders, 30_000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  const updateFulfillment = async (orderId: string, data: Record<string, unknown>) => {
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/fulfillment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, ...data }),
      });
      if (res.ok) await fetchOrders();
    } finally {
      setActionLoading(null);
    }
  };

  const fetchRates = async (order: FulfillmentOrder) => {
    setRateOrderId(order.id);
    setLoadingRates(true);
    setRates([]);
    setSelectedRate(null);

    try {
      // Build items from order for weight calculation
      const items = order.items.map((item) => ({
        category: item.inventory_item?.category || "other",
        quantity: item.quantity,
        weight_oz: item.inventory_item?.weight_oz || undefined,
      }));

      const addr = order.shipping_address || {};
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          to_zip: addr.zip || addr.postalCode || "",
          to_state: addr.state || "",
          to_country: addr.country || "US",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRates(data.rates || []);
        if (data.rates?.length > 0) setSelectedRate(data.rates[0]);
      }
    } finally {
      setLoadingRates(false);
    }
  };

  const generateLabel = async (orderId: string) => {
    if (!selectedRate) return;
    setGeneratingLabel(true);

    try {
      const res = await fetch("/api/shipping/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          carrier_code: selectedRate.carrier,
          service_code: selectedRate.code,
        }),
      });

      if (res.ok) {
        setRateOrderId(null);
        setRates([]);
        setSelectedRate(null);
        await fetchOrders();
      }
    } finally {
      setGeneratingLabel(false);
    }
  };

  const printPullSheet = async () => {
    setPullSheetLoading(true);
    try {
      const res = await fetch(`/api/fulfillment/pull-sheet?status=${tab}`);
      if (!res.ok) return;
      const data = await res.json();

      const sections = (data.sections || []) as {
        category: string;
        items: {
          name: string;
          sku: string | null;
          total_quantity: number;
          orders: string[];
          location: string | null;
        }[];
      }[];

      // Build print-friendly HTML
      const html = `<!DOCTYPE html>
<html><head>
<title>Pull Sheet - ${new Date(data.generated_at).toLocaleDateString()}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; padding: 20px; color: #000; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; }
  .section { margin-bottom: 16px; }
  .section-header { font-size: 14px; font-weight: bold; text-transform: uppercase; background: #eee; padding: 4px 8px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #999; padding: 2px 4px; }
  td { padding: 4px; border-bottom: 1px dotted #ccc; vertical-align: top; }
  .cb { width: 20px; text-align: center; }
  .qty { width: 40px; text-align: center; font-weight: bold; }
  .sku { width: 120px; font-size: 11px; color: #555; }
  .loc { width: 120px; font-size: 11px; color: #555; }
  .orders { font-size: 10px; color: #777; }
  @media print { body { padding: 10px; } }
</style>
</head><body>
<h1>Pull Sheet</h1>
<div class="meta">
  Generated: ${new Date(data.generated_at).toLocaleString()} &nbsp;|&nbsp;
  Orders: ${data.order_count} &nbsp;|&nbsp;
  Total items: ${data.total_items}
</div>
${sections.map((s: typeof sections[number]) => `
<div class="section">
  <div class="section-header">${s.category.replace(/_/g, " ")}</div>
  <table>
    <tr><th class="cb"></th><th class="qty">Qty</th><th>Item</th><th class="sku">SKU</th><th class="loc">Location</th><th>Orders</th></tr>
    ${s.items.map((item: typeof s.items[number]) => `
    <tr>
      <td class="cb">&#9744;</td>
      <td class="qty">${item.total_quantity}</td>
      <td>${item.name}</td>
      <td class="sku">${item.sku || "-"}</td>
      <td class="loc">${item.location || "-"}</td>
      <td class="orders">${item.orders.join(", ")}</td>
    </tr>`).join("")}
  </table>
</div>`).join("")}
</body></html>`;

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        // Auto-trigger print dialog after a brief render
        setTimeout(() => win.print(), 400);
      }
    } finally {
      setPullSheetLoading(false);
    }
  };

  const formatAddress = (addr: Record<string, string> | null) => {
    if (!addr) return "No address";
    const parts = [addr.street1 || addr.street, addr.street2, addr.city, addr.state, addr.zip || addr.postalCode].filter(Boolean);
    return parts.join(", ") || "No address";
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: "unfulfilled", label: "To Fulfill", count: summary.unfulfilled },
    { key: "picking,packed", label: "In Progress", count: summary.picking + summary.packed },
    { key: "shipped", label: "Shipped", count: summary.shipped },
    { key: "all", label: "All", count: summary.unfulfilled + summary.picking + summary.packed + summary.shipped + summary.delivered },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={ORDERS_TABS} />
      <PageHeader
        title="Fulfillment Queue"
        crumb="Console · Sales"
        desc="Pick, pack, label, ship — the live work queue for what's leaving the building today."
        action={
          <button
            onClick={printPullSheet}
            disabled={pullSheetLoading}
            className="inline-flex items-center gap-2 transition-colors disabled:opacity-50"
            style={ghostBtnStyle}
          >
            {pullSheetLoading ? "Generating..." : "Print Pull Sheet"}
          </button>
        }
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-2 font-mono uppercase transition-colors"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                padding: '0.45rem 0.8rem',
                minHeight: 44,
                color: on ? 'var(--orange)' : 'var(--ink-soft)',
                border: `1px solid ${on ? 'var(--orange)' : 'var(--rule-hi)'}`,
                background: on ? 'var(--orange-mute)' : 'var(--panel)',
              }}
            >
              <span>{t.label}</span>
              {t.count > 0 && (
                <span
                  className="tabular-nums"
                  style={{
                    opacity: 0.75,
                    fontSize: '0.62rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Loading</span></div>
          <div className="p-8 text-center font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.06em' }}>
            <span className="mr-2 animate-spin inline-block">◐</span>
            Loading orders...
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <EmptyState
          icon="✓"
          title={tab === "unfulfilled" ? "All caught up" : "No orders"}
          description={tab === "unfulfilled"
            ? "No orders waiting to be fulfilled"
            : "No orders match this filter"}
        />
      )}

      {/* Order list */}
      <div className="space-y-2">
        {orders.map((order) => {
          const isExpanded = expandedOrder === order.id;
          const isShowingRates = rateOrderId === order.id;
          const merchantItems = order.items.filter((i) => i.fulfillment_type === "merchant");
          const podItems = order.items.filter((i) => i.fulfillment_type === "pod");
          const thirdPartyItems = order.items.filter((i) => i.fulfillment_type === "3pl");
          const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
          const typeLabel = FULFILLMENT_TYPE_LABEL[order.fulfillment_type] || FULFILLMENT_TYPE_LABEL.merchant;

          return (
            <div
              key={order.id}
              className="ar-stripe ar-lstripe overflow-hidden"
              style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
            >
              {/* Order header — always visible */}
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-panel"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-ink" style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                      #{order.order_number}
                    </span>
                    <StatusBadge status={order.fulfillment_status} size="xs" />
                    <span
                      className="font-mono uppercase text-ink-faint"
                      style={{
                        fontSize: '0.6rem',
                        letterSpacing: '0.18em',
                        fontWeight: 600,
                        padding: '2px 6px',
                        border: '1px solid var(--rule-hi)',
                      }}
                    >
                      {SOURCE_LABELS[order.source] || order.source}
                    </span>
                    {order.fulfillment_type !== "merchant" && (
                      <span
                        className="font-mono uppercase text-orange"
                        style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}
                      >
                        {typeLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    <span>{order.customer?.name || "Guest"}</span>
                    <span>·</span>
                    <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span className="tabular-nums">{formatCents(order.total_cents)}</span>
                    <span>·</span>
                    <span>{timeAgo(order.created_at)}</span>
                  </div>
                </div>

                {order.tracking_number && (
                  <div className="font-mono text-teal shrink-0" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    <span className="mr-1">🚚</span>
                    {order.tracking_number}
                  </div>
                )}

                <span className="text-ink-faint shrink-0 font-mono">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded order details */}
              {isExpanded && (() => {
                const shortItems = getShortItems(order);
                const showOversellBanner = order.is_oversold || shortItems.length > 0;
                const oversellOpen = oversellOrderId === order.id;
                return (
                <div className="p-4 space-y-4" style={{ borderTop: '1px solid var(--rule)' }}>
                  {/* Oversell banner — yellow=warn semantic */}
                  {showOversellBanner && (
                    <div
                      className="p-3 space-y-2"
                      style={{
                        border: '1px solid var(--yellow)',
                        background: 'var(--yellow-mute)',
                      }}
                    >
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-yellow text-base shrink-0">⚠</span>
                        <div className="flex-1">
                          <p className="font-display text-ink" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                            Short {shortItems.reduce((s, i) => s + i.short_by, 0) || "some"} unit
                            {shortItems.reduce((s, i) => s + i.short_by, 0) === 1 ? "" : "s"}
                            {shortItems.length > 0 && (
                              <span className="font-mono text-ink-soft" style={{ fontSize: '0.78rem', fontWeight: 400 }}>
                                {' '}— {shortItems.map((i) => i.name).join(", ")}
                              </span>
                            )}
                          </p>
                          <p className="font-mono uppercase text-ink-faint mt-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                            Choose how to proceed
                          </p>
                          {!oversellOpen && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => { setOversellOrderId(order.id); setOversellAction("backorder"); }}
                                className="inline-flex items-center font-mono uppercase transition-colors"
                                style={{
                                  fontSize: '0.62rem',
                                  letterSpacing: '0.14em',
                                  fontWeight: 700,
                                  padding: '0 0.7rem',
                                  minHeight: 36,
                                  color: 'var(--yellow)',
                                  border: '1px solid var(--yellow)',
                                  background: 'transparent',
                                }}
                              >
                                Backorder remaining
                              </button>
                              <button
                                onClick={() => { setOversellOrderId(order.id); setOversellAction("cancel"); }}
                                className="inline-flex items-center font-mono uppercase transition-colors"
                                style={{
                                  fontSize: '0.62rem',
                                  letterSpacing: '0.14em',
                                  fontWeight: 700,
                                  padding: '0 0.7rem',
                                  minHeight: 36,
                                  color: 'var(--red)',
                                  border: '1px solid var(--red)',
                                  background: 'transparent',
                                }}
                              >
                                Cancel + refund
                              </button>
                              <button
                                onClick={() => {
                                  setOversellOrderId(order.id);
                                  setOversellAction("reconcile");
                                  // Pre-fill reconcile fields with the
                                  // ordered quantity — the most common
                                  // case is "I have it, count was wrong".
                                  const initial: Record<string, number> = {};
                                  for (const s of shortItems) {
                                    if (s.inventory_item_id) initial[s.inventory_item_id] = s.ordered;
                                  }
                                  setReconcileQuantities(initial);
                                }}
                                className="inline-flex items-center font-mono uppercase transition-colors"
                                style={{
                                  fontSize: '0.62rem',
                                  letterSpacing: '0.14em',
                                  fontWeight: 700,
                                  padding: '0 0.7rem',
                                  minHeight: 36,
                                  color: 'var(--teal)',
                                  border: '1px solid var(--teal)',
                                  background: 'transparent',
                                }}
                              >
                                Skip — count is wrong
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Confirmation panels for the chosen action */}
                      {oversellOpen && oversellAction === "backorder" && (
                        <div className="pt-2 flex items-center justify-between gap-3 text-xs text-ink" style={{ borderTop: '1px solid var(--yellow)' }}>
                          <span>Mark order as backordered? Customer should be notified separately.</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitOversellResolution(order, "backorder")}
                              disabled={oversellSubmitting}
                              className="inline-flex items-center disabled:opacity-50"
                              style={yellowBtnStyle}
                            >
                              {oversellSubmitting ? "..." : "Confirm Backorder"}
                            </button>
                            <button
                              onClick={() => { setOversellOrderId(null); setOversellAction(null); }}
                              className="inline-flex items-center"
                              style={ghostBtnStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {oversellOpen && oversellAction === "cancel" && (
                        <div className="pt-2 flex items-center justify-between gap-3 text-xs text-ink" style={{ borderTop: '1px solid var(--yellow)' }}>
                          <span>Cancel the order and restore stock for the cancelled lines? (Refund happens upstream on the marketplace.)</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitOversellResolution(order, "cancel")}
                              disabled={oversellSubmitting}
                              className="inline-flex items-center disabled:opacity-50"
                              style={redBtnStyle}
                            >
                              {oversellSubmitting ? "..." : "Confirm Cancel"}
                            </button>
                            <button
                              onClick={() => { setOversellOrderId(null); setOversellAction(null); }}
                              className="inline-flex items-center"
                              style={ghostBtnStyle}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {oversellOpen && oversellAction === "reconcile" && (
                        <div className="pt-2 space-y-2 text-xs text-ink" style={{ borderTop: '1px solid var(--yellow)' }}>
                          <p className="font-mono uppercase text-ink-soft" style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                            Set actual on-hand · adjustment reason: fulfillment reconciliation
                          </p>
                          <div className="space-y-1">
                            {shortItems.map((s) => s.inventory_item_id ? (
                              <div key={s.line_id} className="flex items-center gap-2">
                                <span className="flex-1 truncate text-ink-soft">
                                  {s.name}{' '}
                                  <span className="font-mono text-ink-faint">(system: {s.on_hand}, ordered: {s.ordered})</span>
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={reconcileQuantities[s.inventory_item_id] ?? ""}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setReconcileQuantities((prev) => ({
                                      ...prev,
                                      [s.inventory_item_id!]: Number.isNaN(v) ? 0 : v,
                                    }));
                                  }}
                                  className="w-20 font-mono tabular-nums"
                                  style={{
                                    background: 'var(--panel)',
                                    border: '1px solid var(--rule-hi)',
                                    color: 'var(--ink)',
                                    padding: '0.4rem 0.5rem',
                                    fontSize: '0.85rem',
                                  }}
                                />
                              </div>
                            ) : null)}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => submitOversellResolution(order, "reconcile")}
                              disabled={oversellSubmitting}
                              className="inline-flex items-center disabled:opacity-50"
                              style={tealBtnStyle}
                            >
                              {oversellSubmitting ? "..." : "Adjust Inventory"}
                            </button>
                            <button
                              onClick={() => { setOversellOrderId(null); setOversellAction(null); setReconcileQuantities({}); }}
                              className="inline-flex items-center"
                              style={ghostBtnStyle}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ship-to address */}
                  <div className="flex items-start gap-3">
                    <span className="text-ink-faint mt-0.5 shrink-0">📦</span>
                    <div className="text-sm">
                      <p className="font-display text-ink" style={{ fontWeight: 600 }}>{order.customer?.name || "Guest"}</p>
                      <p className="text-ink-soft">{formatAddress(order.shipping_address)}</p>
                      {order.customer?.email && (
                        <p className="font-mono text-ink-faint" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>{order.customer.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Pick list — merchant items */}
                  {merchantItems.length > 0 && (
                    <div>
                      <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                        Pick List
                      </p>
                      <div className="space-y-1">
                        {merchantItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 text-sm p-2"
                            style={{
                              background: item.fulfilled ? 'var(--teal-mute)' : 'var(--panel)',
                              border: `1px solid ${item.fulfilled ? 'var(--teal)' : 'var(--rule)'}`,
                              opacity: item.fulfilled ? 0.7 : 1,
                            }}
                          >
                            {item.inventory_item?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.inventory_item.image_url}
                                alt=""
                                className="w-8 h-8 object-cover"
                                style={{ border: '1px solid var(--rule)' }}
                              />
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
                                <span className="text-ink-faint text-xs">□</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`truncate ${item.fulfilled ? 'line-through text-ink-soft' : 'text-ink'}`}>{item.name}</p>
                              {item.inventory_item?.sku && (
                                <p className="font-mono text-ink-faint" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>SKU: {item.inventory_item.sku}</p>
                              )}
                            </div>
                            <span className="font-mono text-ink tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* POD items */}
                  {podItems.length > 0 && (
                    <div>
                      <p className="font-mono uppercase text-orange mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                        Print-on-Demand
                      </p>
                      <div className="space-y-1">
                        {podItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 text-sm p-2"
                            style={{ background: 'var(--orange-mute)', border: '1px solid var(--orange)' }}
                          >
                            <span className="text-orange text-xs">🏷</span>
                            <span className="flex-1 truncate text-ink">{item.name}</span>
                            <span className="font-mono uppercase text-orange" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                              {item.fulfillment_provider || "POD"}
                            </span>
                            <span className="font-mono text-ink tabular-nums" style={{ fontSize: '0.85rem' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3PL items */}
                  {thirdPartyItems.length > 0 && (
                    <div>
                      <p className="font-mono uppercase text-teal mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                        Third-Party Logistics
                      </p>
                      <div className="space-y-1">
                        {thirdPartyItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 text-sm p-2"
                            style={{ background: 'var(--teal-mute)', border: '1px solid var(--teal)' }}
                          >
                            <span className="text-teal text-xs">🚚</span>
                            <span className="flex-1 truncate text-ink">{item.name}</span>
                            <span className="font-mono uppercase text-teal" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                              {item.fulfillment_provider || "3PL"}
                            </span>
                            <span className="font-mono text-ink tabular-nums" style={{ fontSize: '0.85rem' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing labels */}
                  {order.shipping_labels.length > 0 && (
                    <div>
                      <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                        Shipping Labels
                      </p>
                      {order.shipping_labels.map((label) => (
                        <div
                          key={label.id}
                          className="flex items-center gap-3 text-sm p-2"
                          style={{ background: 'var(--teal-mute)', border: '1px solid var(--teal)' }}
                        >
                          <span className="text-teal text-xs">✅</span>
                          <span className="font-mono text-ink" style={{ letterSpacing: '0.04em' }}>{label.tracking_number}</span>
                          <span className="font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                            {label.carrier_code} · <span className="tabular-nums">{formatCents(label.shipment_cost_cents)}</span>
                          </span>
                          <a
                            href={`/api/shipping/labels/${label.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto font-mono uppercase text-orange hover:underline flex items-center gap-1"
                            style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🖨 Print
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rate shopping panel */}
                  {isShowingRates && (
                    <div className="ar-zone active" style={{ borderColor: 'var(--orange)' }}>
                      <div className="ar-zone-head" style={{ background: 'var(--orange-mute)', color: 'var(--orange)' }}>
                        <span>🚚 Select Shipping Rate</span>
                      </div>
                      <div className="p-3">
                        {loadingRates ? (
                          <div className="flex items-center gap-2 font-mono text-ink-soft" style={{ fontSize: '0.78rem' }}>
                            <span className="animate-spin inline-block">◐</span> Fetching rates...
                          </div>
                        ) : rates.length === 0 ? (
                          <div className="font-mono text-yellow flex items-center gap-2" style={{ fontSize: '0.78rem' }}>
                            ⚠ No rates available. Check ShipStation config.
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-visible">
                              {rates.map((rate) => {
                                const isSelected = selectedRate?.code === rate.code && selectedRate?.carrier === rate.carrier;
                                return (
                                  <button
                                    key={`${rate.carrier}-${rate.code}`}
                                    onClick={() => setSelectedRate(rate)}
                                    className="w-full flex items-center gap-3 p-2.5 text-sm text-left transition-colors"
                                    style={{
                                      background: isSelected ? 'var(--orange-mute)' : 'var(--panel)',
                                      border: `1px solid ${isSelected ? 'var(--orange)' : 'var(--rule)'}`,
                                    }}
                                  >
                                    <div className="flex-1">
                                      <p className="font-display text-ink" style={{ fontWeight: 500 }}>{rate.name}</p>
                                      <p className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em' }}>
                                        {rate.carrier}
                                      </p>
                                    </div>
                                    <span className="font-mono tabular-nums text-ink" style={{ fontWeight: 600 }}>
                                      {formatCents(rate.totalCents)}
                                    </span>
                                    {order.shipping_cents > 0 && rate.totalCents < order.shipping_cents && (
                                      <span className="font-mono text-teal" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>
                                        +{formatCents(order.shipping_cents - rate.totalCents)} margin
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => generateLabel(order.id)}
                                disabled={!selectedRate || generatingLabel}
                                className="flex-1 inline-flex items-center justify-center disabled:opacity-50"
                                style={primaryBtnStyle}
                              >
                                {generatingLabel ? "Creating..." : "🖨 Buy Label"}
                              </button>
                              <button
                                onClick={() => { setRateOrderId(null); setRates([]); }}
                                className="inline-flex items-center"
                                style={ghostBtnStyle}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {order.notes && (
                    <p className="text-sm italic text-ink-soft p-2" style={{ background: 'var(--yellow-mute)', border: '1px solid var(--yellow)' }}>
                      {order.notes}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap pt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                    {order.fulfillment_status === "unfulfilled" && (
                      <button
                        onClick={() => updateFulfillment(order.id, { fulfillment_status: "picking" })}
                        disabled={actionLoading === order.id}
                        className="inline-flex items-center gap-2 disabled:opacity-50"
                        style={primaryBtnStyle}
                      >
                        📦 Start Picking
                      </button>
                    )}

                    {(order.fulfillment_status === "picking" || order.fulfillment_status === "unfulfilled") && (
                      <button
                        onClick={() => updateFulfillment(order.id, { fulfillment_status: "packed" })}
                        disabled={actionLoading === order.id}
                        className="inline-flex items-center gap-2 disabled:opacity-50"
                        style={primaryBtnStyle}
                      >
                        📦 Mark Packed
                      </button>
                    )}

                    {(order.fulfillment_status === "picking" || order.fulfillment_status === "packed") && !isShowingRates && (
                      <button
                        onClick={() => fetchRates(order)}
                        className="inline-flex items-center gap-2"
                        style={primaryBtnStyle}
                      >
                        🚚 Buy Shipping Label
                      </button>
                    )}

                    {(order.fulfillment_status === "packed" || order.shipping_labels.length > 0) && (
                      <button
                        onClick={() => updateFulfillment(order.id, { fulfillment_status: "shipped" })}
                        disabled={actionLoading === order.id}
                        className="inline-flex items-center gap-2 disabled:opacity-50"
                        style={primaryBtnStyle}
                      >
                        🚚 Mark Shipped
                      </button>
                    )}

                    {order.fulfillment_status === "shipped" && (
                      <button
                        onClick={() => updateFulfillment(order.id, { fulfillment_status: "delivered" })}
                        disabled={actionLoading === order.id}
                        className="inline-flex items-center gap-2 disabled:opacity-50"
                        style={tealBtnStyle}
                      >
                        ✅ Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
