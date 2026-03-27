"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/types";
import { BarcodeScanner } from "@/components/barcode-scanner";

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  shipped: "bg-purple-500/20 text-purple-400",
  delivered: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-red-500/20 text-red-400",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
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
      const url = statusFilter
        ? `/api/orders?status=${statusFilter}`
        : "/api/orders";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-white">Orders</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["", "pending", "processing", "shipped", "delivered", "cancelled"] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {s || "All"}
            </button>
          )
        )}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
          No orders found.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => openOrder(order.id)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left hover:bg-zinc-800/80 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">
                      {order.order_number}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_COLORS[order.status] || "bg-zinc-700 text-zinc-300"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {order.customer?.name || "Guest"} &middot;{" "}
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""} &middot;{" "}
                    {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-400 shrink-0">
                  {formatCents(order.total_cents)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Order detail slide-over */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex md:justify-end">
          <div
            className="absolute inset-0 bg-black/60 hidden md:block"
            onClick={() => {
              setSelectedOrder(null);
              setShowPackShip(false);
            }}
          />
          <div className="relative z-50 w-full md:max-w-lg flex flex-col bg-zinc-950 md:border-l md:border-zinc-800 shadow-2xl md:animate-slide-in-right animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {selectedOrder.order_number}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    STATUS_COLORS[selectedOrder.status] || "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {selectedOrder.status}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setShowPackShip(false);
                }}
                className="text-zinc-500 hover:text-white text-xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Customer */}
              {selectedOrder.customer && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="text-xs text-zinc-500 mb-1">Customer</div>
                  <div className="text-sm font-medium text-white">
                    {selectedOrder.customer.name}
                  </div>
                  {selectedOrder.customer.email && (
                    <div className="text-xs text-zinc-400">{selectedOrder.customer.email}</div>
                  )}
                </div>
              )}

              {/* Shipping address */}
              {selectedOrder.shipping_address && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="text-xs text-zinc-500 mb-1">Ship To</div>
                  <div className="text-sm text-zinc-300">
                    {Object.values(selectedOrder.shipping_address).filter(Boolean).join(", ")}
                  </div>
                </div>
              )}

              {/* Tracking */}
              {selectedOrder.tracking_number && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="text-xs text-zinc-500 mb-1">Tracking</div>
                  <div className="text-sm font-mono text-white">
                    {selectedOrder.tracking_number}
                  </div>
                  {selectedOrder.shipping_method && (
                    <div className="text-xs text-zinc-400">{selectedOrder.shipping_method}</div>
                  )}
                </div>
              )}

              {/* Items */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="text-xs text-zinc-500 mb-2">Items</div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="text-zinc-300 truncate">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="text-zinc-500 ml-1">x{item.quantity}</span>
                          )}
                        </div>
                        {item.fulfilled && (
                          <span className="text-[10px] text-emerald-400">Packed</span>
                        )}
                      </div>
                      <span className="text-white font-mono shrink-0">
                        {formatCents(item.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800 space-y-1">
                  {selectedOrder.discount_cents > 0 && (
                    <div className="flex justify-between text-xs text-amber-400">
                      <span>Discount</span>
                      <span>-{formatCents(selectedOrder.discount_cents)}</span>
                    </div>
                  )}
                  {selectedOrder.shipping_cents > 0 && (
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Shipping</span>
                      <span>{formatCents(selectedOrder.shipping_cents)}</span>
                    </div>
                  )}
                  {selectedOrder.tax_cents > 0 && (
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Tax</span>
                      <span>{formatCents(selectedOrder.tax_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white pt-1">
                    <span>Total</span>
                    <span>{formatCents(selectedOrder.total_cents)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <div className="text-xs text-zinc-500 mb-1">Notes</div>
                  <div className="text-sm text-zinc-300">{selectedOrder.notes}</div>
                </div>
              )}

              {/* Pack & Ship panel */}
              {showPackShip && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Pack & Ship</h3>
                    <button
                      onClick={() => setShowScanner(true)}
                      className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors min-h-[44px]"
                    >
                      Scan to Verify
                    </button>
                  </div>

                  {/* Packing checklist */}
                  <div className="space-y-1">
                    {selectedOrder.items.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-zinc-800/50 cursor-pointer min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={packedItems.has(item.id)}
                          onChange={() => togglePacked(item.id)}
                          className="rounded border-zinc-700 bg-zinc-950"
                        />
                        <span className={`text-sm ${packedItems.has(item.id) ? "text-zinc-500 line-through" : "text-white"}`}>
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="text-zinc-500 ml-1">x{item.quantity}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Carrier */}
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Carrier</label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tracking number */}
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white font-mono placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Ship button */}
                  <button
                    onClick={handleMarkShipped}
                    disabled={shipping}
                    className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors min-h-[44px]"
                  >
                    {shipping ? "Shipping..." : "Mark Shipped"}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="border-t border-zinc-800 px-6 py-4 pb-safe space-y-2 shrink-0">
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
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 transition-colors min-h-[44px]"
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
                  className="w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 transition-colors min-h-[44px]"
                >
                  Ship Order
                </button>
              )}
              {selectedOrder.status === "shipped" && (
                <button
                  onClick={() =>
                    updateOrder(selectedOrder.id, { status: "delivered" })
                  }
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors min-h-[44px]"
                >
                  Mark Delivered
                </button>
              )}
              {(selectedOrder.status === "pending" || selectedOrder.status === "processing") && (
                <button
                  onClick={() =>
                    updateOrder(selectedOrder.id, { status: "cancelled" })
                  }
                  className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-colors min-h-[44px]"
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
