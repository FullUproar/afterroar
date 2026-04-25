"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/types";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge as SharedStatusBadge, EmptyState } from "@/components/shared/ui";
import { Pagination } from "@/components/ui/pagination";
import { SubNav } from "@/components/ui/sub-nav";
import { ORDERS_TABS } from "@/lib/nav-groups";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface OrderItem {
  id: string;
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  price_cents: number;
  total_cents: number;
  fulfilled: boolean;
  inventory_item?: { id: string; name: string; barcode: string | null; sku: string | null };
}

interface Order {
  id: string;
  order_number: string;
  source: string;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  shipping_method: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer: { id: string; name: string; email: string | null } | null;
  items: OrderItem[];
}

type StatusFilter = "" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPackShip, setShowPackShip] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Pack & Ship state
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set());
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState<string>("USPS");
  const [shipping, setShipping] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setOrders(result.data || result);
        if (result.total != null) setTotalItems(result.total);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch order detail
  async function openOrder(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      }
    } catch {
      // Network error
    }
  }

  // Update order status
  async function updateOrder(orderId: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedOrder(updated);
        fetchOrders();
      }
    } catch {
      // Network error
    }
  }

  // Mark shipped
  async function handleMarkShipped() {
    if (!selectedOrder || shipping) return;
    setShipping(true);
    try {
      await updateOrder(selectedOrder.id, {
        status: "shipped",
        tracking_number: trackingNumber || null,
        shipping_method: carrier,
        fulfilled_items: Array.from(packedItems),
      });
      setShowPackShip(false);
      setTrackingNumber("");
      setPackedItems(new Set());
    } finally {
      setShipping(false);
    }
  }

  // Barcode scan for packing verification
  function handlePackScan(code: string) {
    setShowScanner(false);
    if (!selectedOrder) return;
    // Find item matching barcode
    const match = selectedOrder.items.find(
      (item) =>
        item.inventory_item?.barcode === code ||
        item.inventory_item?.sku === code
    );
    if (match) {
      setPackedItems((prev) => new Set([...prev, match.id]));
    } else {
      alert(`No matching item found for barcode: ${code}`);
    }
  }

  function togglePacked(itemId: string) {
    setPackedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

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

  return (
    <div className="mx-auto max-w-5xl flex flex-col h-full gap-4">
      <SubNav items={ORDERS_TABS} />
      <PageHeader
        title="Orders"
        crumb="Console · Sales"
        desc="Customer orders end-to-end — pending intake, pick & pack, tracking, delivery."
      />

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scroll-visible">
        {STATUS_FILTERS.map((s) => {
          const on = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => { setStatusFilter(s.key); setPage(1); }}
              className="inline-flex items-center font-mono uppercase whitespace-nowrap transition-colors"
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
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Loading</span></div>
          <div className="p-8 text-center font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.06em' }}>
            Loading orders...
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Orders</span><span>No results</span></div>
          <div className="p-10 text-center">
            <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.66rem', letterSpacing: '0.28em' }}>
              No orders found
            </p>
            <p className="font-display text-ink" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {statusFilter ? `No ${statusFilter} orders` : "Orders will appear here when placed"}
            </p>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter("")}
                className="mt-4 inline-flex items-center font-mono uppercase transition-colors"
                style={{
                  fontSize: '0.66rem',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  padding: '0 0.85rem',
                  minHeight: 44,
                  color: 'var(--orange)',
                  border: '1px solid var(--orange)',
                  background: 'var(--orange-mute)',
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => openOrder(order.id)}
              className="ar-stripe ar-lstripe w-full text-left transition-colors hover:bg-panel"
              style={{
                background: 'var(--panel-mute)',
                border: '1px solid var(--rule)',
                padding: '0.85rem 1.1rem',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-ink" style={{ fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                      {order.order_number}
                    </span>
                    <SharedStatusBadge status={order.status} size="xs" />
                  </div>
                  <div className="font-mono text-ink-soft mt-1" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                    {order.customer?.name || "Guest"} · {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-mono tabular-nums shrink-0 text-teal" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  {formatCents(order.total_cents)}
                </div>
              </div>
            </button>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        </div>
      )}

      {/* Order detail slide-over */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex md:justify-end">
          <div
            className="absolute inset-0 bg-overlay-bg hidden md:block"
            onClick={() => {
              setSelectedOrder(null);
              setShowPackShip(false);
            }}
          />
          <div
            className="relative z-50 w-full md:max-w-lg flex flex-col shadow-2xl md:animate-slide-in-right animate-slide-up"
            style={{ background: 'var(--slate)', borderLeft: '1px solid var(--rule)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--rule)' }}
            >
              <div>
                <p className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                  Order
                </p>
                <h2 className="font-display text-ink" style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.005em' }}>
                  {selectedOrder.order_number}
                </h2>
                <div className="mt-1">
                  <SharedStatusBadge status={selectedOrder.status} size="xs" />
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setShowPackShip(false);
                }}
                className="text-ink-soft hover:text-ink transition-colors text-xl leading-none flex items-center justify-center"
                style={{ minHeight: 44, minWidth: 44 }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scroll-visible">
              {/* Customer */}
              {selectedOrder.customer && (
                <div className="ar-zone">
                  <div className="ar-zone-head"><span>Customer</span></div>
                  <div className="p-3">
                    <div className="font-display text-ink" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                      {selectedOrder.customer.name}
                    </div>
                    {selectedOrder.customer.email && (
                      <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                        {selectedOrder.customer.email}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shipping address */}
              {selectedOrder.shipping_address && (
                <div className="ar-zone">
                  <div className="ar-zone-head"><span>Ship To</span></div>
                  <div className="p-3 text-ink-soft" style={{ fontSize: '0.85rem' }}>
                    {Object.values(selectedOrder.shipping_address).filter(Boolean).join(", ")}
                  </div>
                </div>
              )}

              {/* Tracking */}
              {selectedOrder.tracking_number && (
                <div className="ar-zone">
                  <div className="ar-zone-head"><span>Tracking</span></div>
                  <div className="p-3">
                    <div className="font-mono text-ink" style={{ fontSize: '0.88rem', letterSpacing: '0.04em' }}>
                      {selectedOrder.tracking_number}
                    </div>
                    {selectedOrder.shipping_method && (
                      <div className="font-mono text-ink-soft mt-1" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                        {selectedOrder.shipping_method}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="ar-zone">
                <div className="ar-zone-head"><span>Items</span><span>{selectedOrder.items.length}</span></div>
                <div className="p-3 space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="text-ink truncate">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="text-ink-soft ml-1 font-mono">×{item.quantity}</span>
                          )}
                        </div>
                        {item.fulfilled && (
                          <span className="font-mono uppercase text-teal" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                            Packed
                          </span>
                        )}
                      </div>
                      <span className="text-ink font-mono tabular-nums shrink-0">
                        {formatCents(item.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="px-3 py-2 space-y-1"
                  style={{ borderTop: '1px solid var(--rule)' }}
                >
                  {selectedOrder.discount_cents > 0 && (
                    <div className="flex justify-between text-xs text-yellow font-mono tabular-nums">
                      <span>Discount</span>
                      <span>-{formatCents(selectedOrder.discount_cents)}</span>
                    </div>
                  )}
                  {selectedOrder.shipping_cents > 0 && (
                    <div className="flex justify-between text-xs text-ink-soft font-mono tabular-nums">
                      <span>Shipping</span>
                      <span>{formatCents(selectedOrder.shipping_cents)}</span>
                    </div>
                  )}
                  {selectedOrder.tax_cents > 0 && (
                    <div className="flex justify-between text-xs text-ink-soft font-mono tabular-nums">
                      <span>Tax</span>
                      <span>{formatCents(selectedOrder.tax_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-ink pt-1" style={{ fontSize: '1rem', fontWeight: 700 }}>
                    <span>Total</span>
                    <span className="font-mono tabular-nums">{formatCents(selectedOrder.total_cents)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="ar-zone">
                  <div className="ar-zone-head"><span>Notes</span></div>
                  <div className="p-3 text-ink-soft" style={{ fontSize: '0.85rem' }}>{selectedOrder.notes}</div>
                </div>
              )}

              {/* Pack & Ship panel */}
              {showPackShip && (
                <div
                  className="ar-zone active"
                  style={{ borderColor: 'var(--orange)' }}
                >
                  <div className="ar-zone-head" style={{ background: 'var(--orange-mute)', color: 'var(--orange)' }}>
                    <span>Pack & Ship</span>
                    <button
                      onClick={() => setShowScanner(true)}
                      className="font-mono uppercase transition-colors hover:text-ink"
                      style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}
                    >
                      Scan to Verify →
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    {/* Packing checklist */}
                    <div className="space-y-1">
                      {selectedOrder.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 px-2 py-2 cursor-pointer transition-colors hover:bg-panel"
                          style={{ minHeight: 44 }}
                        >
                          <input
                            type="checkbox"
                            checked={packedItems.has(item.id)}
                            onChange={() => togglePacked(item.id)}
                            className="rounded"
                            style={{ accentColor: 'var(--orange)' }}
                          />
                          <span className={`text-sm ${packedItems.has(item.id) ? "text-ink-soft line-through" : "text-ink"}`}>
                            {item.name}
                            {item.quantity > 1 && (
                              <span className="text-ink-soft ml-1 font-mono">×{item.quantity}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Carrier */}
                    <div>
                      <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                        Carrier
                      </label>
                      <select
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        style={inputStyle}
                      >
                        {CARRIERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tracking number */}
                    <div>
                      <label className="block font-mono uppercase text-ink-faint mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                        className="font-mono"
                        style={inputStyle}
                      />
                    </div>

                    {/* Ship button */}
                    <button
                      onClick={handleMarkShipped}
                      disabled={shipping}
                      className="w-full inline-flex items-center justify-center font-display uppercase transition-colors disabled:opacity-50"
                      style={{
                        fontSize: '0.95rem',
                        letterSpacing: '0.06em',
                        fontWeight: 700,
                        padding: '0 1rem',
                        minHeight: 48,
                        color: 'var(--void)',
                        background: 'var(--orange)',
                        border: '1px solid var(--orange)',
                      }}
                    >
                      {shipping ? "Shipping..." : "Mark Shipped"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="px-6 py-4 pb-safe space-y-2 shrink-0" style={{ borderTop: '1px solid var(--rule)' }}>
              {selectedOrder.status === "pending" && (
                <button
                  onClick={() => {
                    setShowPackShip(true);
                    // Pre-check already-fulfilled items
                    const alreadyPacked = new Set(
                      selectedOrder.items.filter((i) => i.fulfilled).map((i) => i.id)
                    );
                    setPackedItems(alreadyPacked);
                  }}
                  className="w-full inline-flex items-center justify-center font-display uppercase transition-colors"
                  style={{
                    fontSize: '0.95rem',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    minHeight: 48,
                    color: 'var(--void)',
                    background: 'var(--orange)',
                    border: '1px solid var(--orange)',
                  }}
                >
                  Pack & Ship
                </button>
              )}
              {selectedOrder.status === "processing" && !showPackShip && (
                <button
                  onClick={() => {
                    setShowPackShip(true);
                    const alreadyPacked = new Set(
                      selectedOrder.items.filter((i) => i.fulfilled).map((i) => i.id)
                    );
                    setPackedItems(alreadyPacked);
                  }}
                  className="w-full inline-flex items-center justify-center font-display uppercase transition-colors"
                  style={{
                    fontSize: '0.95rem',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    minHeight: 48,
                    color: 'var(--void)',
                    background: 'var(--orange)',
                    border: '1px solid var(--orange)',
                  }}
                >
                  Ship Order
                </button>
              )}
              {selectedOrder.status === "shipped" && (
                <button
                  onClick={() =>
                    updateOrder(selectedOrder.id, { status: "delivered" })
                  }
                  className="w-full inline-flex items-center justify-center font-display uppercase transition-colors"
                  style={{
                    fontSize: '0.95rem',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    minHeight: 48,
                    color: 'var(--void)',
                    background: 'var(--teal)',
                    border: '1px solid var(--teal)',
                  }}
                >
                  Mark Delivered
                </button>
              )}
              {(selectedOrder.status === "pending" || selectedOrder.status === "processing") && (
                <button
                  onClick={() =>
                    updateOrder(selectedOrder.id, { status: "cancelled" })
                  }
                  className="w-full inline-flex items-center justify-center font-mono uppercase transition-colors hover:bg-red-fu/10"
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    minHeight: 44,
                    color: 'var(--red)',
                    border: '1px solid var(--red)',
                    background: 'transparent',
                  }}
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barcode scanner for packing verification */}
      {showScanner && (
        <BarcodeScanner
          title="Scan to Verify"
          onScan={handlePackScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
