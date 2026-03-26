'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCents, parseDollars } from '@/lib/types';

interface POItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string | null;
  name: string;
  sku: string | null;
  quantity_ordered: number;
  quantity_received: number;
  cost_cents: number;
  inventory_item?: { id: string; name: string; quantity: number } | null;
}

interface PurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string | null;
  supplier_name: string;
  status: string;
  order_date: string;
  expected_delivery: string | null;
  total_cost_cents: number;
  notes: string | null;
  item_count: number;
  items: POItem[];
  supplier?: { id: string; name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventorySearchItem {
  id: string;
  name: string;
  sku: string | null;
  cost_cents: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700 text-zinc-300',
  submitted: 'bg-blue-900 text-blue-300',
  partially_received: 'bg-yellow-900 text-yellow-300',
  received: 'bg-green-900 text-green-300',
  cancelled: 'bg-red-900 text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  partially_received: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

interface NewPOItem {
  inventory_item_id?: string;
  name: string;
  sku?: string;
  quantity_ordered: number;
  cost_cents: number;
  cost_display: string;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // New PO form
  const [formSupplier, setFormSupplier] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDelivery, setFormDelivery] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<NewPOItem[]>([
    { name: '', quantity_ordered: 1, cost_cents: 0, cost_display: '' },
  ]);
  const [saving, setSaving] = useState(false);

  // Search inventory for adding items
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventorySearchItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Receive modal
  const [receiveItem, setReceiveItem] = useState<POItem | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [receiving, setReceiving] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-orders');
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    fetch('/api/suppliers')
      .then((r) => r.ok ? r.json() : [])
      .then(setSuppliers)
      .catch(() => {});
  }, [loadOrders]);

  useEffect(() => {
    if (!itemSearch || itemSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(itemSearch)}`);
      if (res.ok) setSearchResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  async function loadDetail(id: string) {
    const res = await fetch(`/api/purchase-orders/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDetailPO(data);
      setExpandedId(id);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formSupplier.trim()) return;
    const validItems = formItems.filter((i) => i.name.trim());
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: formSupplierId || null,
          supplier_name: formSupplier.trim(),
          expected_delivery: formDelivery || null,
          notes: formNotes || null,
          items: validItems.map((i) => ({
            inventory_item_id: i.inventory_item_id || null,
            name: i.name,
            sku: i.sku || null,
            quantity_ordered: i.quantity_ordered,
            cost_cents: i.cost_cents,
          })),
        }),
      });
      if (res.ok) {
        resetForm();
        loadOrders();
      }
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setShowForm(false);
    setFormSupplier('');
    setFormSupplierId('');
    setFormDelivery('');
    setFormNotes('');
    setFormItems([{ name: '', quantity_ordered: 1, cost_cents: 0, cost_display: '' }]);
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      loadOrders();
      if (expandedId === id) loadDetail(id);
    }
  }

  async function handleReceive() {
    if (!receiveItem || !detailPO) return;
    const qty = parseInt(receiveQty, 10);
    if (!qty || qty <= 0) return;

    setReceiving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${detailPO.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          item_id: receiveItem.id,
          quantity_received: qty,
        }),
      });
      if (res.ok) {
        setReceiveItem(null);
        setReceiveQty('');
        loadDetail(detailPO.id);
        loadOrders();
      }
    } finally {
      setReceiving(false);
    }
  }

  function selectSearchItem(item: InventorySearchItem, index: number) {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      inventory_item_id: item.id,
      name: item.name,
      sku: item.sku || '',
      cost_cents: item.cost_cents,
      cost_display: (item.cost_cents / 100).toFixed(2),
    };
    setFormItems(updated);
    setItemSearch('');
    setSearchResults([]);
    setActiveItemIndex(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium"
        >
          {showForm ? 'Cancel' : 'New PO'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Supplier</label>
              <select
                value={formSupplierId}
                onChange={(e) => {
                  setFormSupplierId(e.target.value);
                  const s = suppliers.find((s) => s.id === e.target.value);
                  if (s) setFormSupplier(s.name);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">-- Select or type below --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={formSupplier}
                onChange={(e) => { setFormSupplier(e.target.value); setFormSupplierId(''); }}
                placeholder="Or type supplier name"
                className="mt-2 w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={formDelivery}
                onChange={(e) => setFormDelivery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-zinc-400">Items</label>
              <button
                type="button"
                onClick={() =>
                  setFormItems([...formItems, { name: '', quantity_ordered: 1, cost_cents: 0, cost_display: '' }])
                }
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {formItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5 relative">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...formItems];
                        updated[i] = { ...updated[i], name: e.target.value, inventory_item_id: undefined };
                        setFormItems(updated);
                      }}
                      onFocus={() => setActiveItemIndex(i)}
                      placeholder="Item name (type to search)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    />
                    {activeItemIndex === i && item.name.length >= 2 && (
                      <div className="relative">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder="Search inventory..."
                          className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1 text-white text-xs"
                        />
                        {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full bg-zinc-800 border border-zinc-700 rounded mt-1 max-h-32 overflow-y-auto">
                            {searchResults.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => selectSearchItem(r, i)}
                                className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 text-sm text-white"
                              >
                                {r.name} {r.sku && <span className="text-zinc-500 text-xs ml-1">({r.sku})</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity_ordered}
                      onChange={(e) => {
                        const updated = [...formItems];
                        updated[i] = { ...updated[i], quantity_ordered: parseInt(e.target.value) || 1 };
                        setFormItems(updated);
                      }}
                      placeholder="Qty"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={item.cost_display}
                      onChange={(e) => {
                        const updated = [...formItems];
                        updated[i] = {
                          ...updated[i],
                          cost_display: e.target.value,
                          cost_cents: parseDollars(e.target.value),
                        };
                        setFormItems(updated);
                      }}
                      placeholder="Cost ($)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm text-zinc-400">
                      {formatCents(item.cost_cents * item.quantity_ordered)}
                    </span>
                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormItems(formItems.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-400 text-xs ml-1"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm text-zinc-300">
              Total: {formatCents(formItems.reduce((s, i) => s + i.cost_cents * i.quantity_ordered, 0))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm font-medium"
            >
              {saving ? 'Creating...' : 'Create PO'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading purchase orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-zinc-400">No purchase orders yet.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <>
                  <tr
                    key={po.id}
                    onClick={() => expandedId === po.id ? setExpandedId(null) : loadDetail(po.id)}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer text-white"
                  >
                    <td className="px-4 py-3 font-medium">{po.supplier_name}</td>
                    <td className="px-4 py-3 text-zinc-300">{po.item_count}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatCents(po.total_cost_cents)}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {new Date(po.order_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString() : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[po.status] || 'bg-zinc-700 text-zinc-300'}`}>
                        {STATUS_LABELS[po.status] || po.status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === po.id && detailPO && (
                    <tr key={`${po.id}-detail`}>
                      <td colSpan={6} className="bg-zinc-950 px-4 py-4 border-b border-zinc-800">
                        <div className="space-y-4">
                          {/* Status actions */}
                          <div className="flex gap-2 flex-wrap">
                            {detailPO.status === 'draft' && (
                              <>
                                <button onClick={() => handleStatusChange(po.id, 'submitted')} className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs">
                                  Submit Order
                                </button>
                                <button onClick={() => handleStatusChange(po.id, 'cancelled')} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs">
                                  Cancel
                                </button>
                              </>
                            )}
                            {detailPO.status === 'submitted' && (
                              <button onClick={() => handleStatusChange(po.id, 'cancelled')} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-xs">
                                Cancel
                              </button>
                            )}
                          </div>

                          {detailPO.notes && (
                            <p className="text-sm text-zinc-400">Notes: {detailPO.notes}</p>
                          )}

                          {/* Items table */}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-zinc-500 text-left text-xs">
                                <th className="pb-2">Item</th>
                                <th className="pb-2">SKU</th>
                                <th className="pb-2 text-center">Ordered</th>
                                <th className="pb-2 text-center">Received</th>
                                <th className="pb-2 text-right">Unit Cost</th>
                                <th className="pb-2 text-right">Line Total</th>
                                {['submitted', 'partially_received'].includes(detailPO.status) && (
                                  <th className="pb-2 text-center">Actions</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {detailPO.items.map((item) => (
                                <tr key={item.id} className="border-t border-zinc-800 text-white">
                                  <td className="py-2">{item.name}</td>
                                  <td className="py-2 text-zinc-400">{item.sku || '--'}</td>
                                  <td className="py-2 text-center">{item.quantity_ordered}</td>
                                  <td className="py-2 text-center">
                                    <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-400' : item.quantity_received > 0 ? 'text-yellow-400' : 'text-zinc-400'}>
                                      {item.quantity_received}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right text-zinc-300">{formatCents(item.cost_cents)}</td>
                                  <td className="py-2 text-right text-zinc-300">{formatCents(item.cost_cents * item.quantity_ordered)}</td>
                                  {['submitted', 'partially_received'].includes(detailPO.status) && (
                                    <td className="py-2 text-center">
                                      {item.quantity_received < item.quantity_ordered && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setReceiveItem(item); setReceiveQty(String(item.quantity_ordered - item.quantity_received)); }}
                                          className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs"
                                        >
                                          Receive
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Receive Modal */}
      {receiveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setReceiveItem(null)}>
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-1">Receive Items</h2>
            <p className="text-sm text-zinc-400 mb-4">{receiveItem.name}</p>
            <p className="text-xs text-zinc-500 mb-3">
              Ordered: {receiveItem.quantity_ordered} | Already received: {receiveItem.quantity_received} | Remaining: {receiveItem.quantity_ordered - receiveItem.quantity_received}
            </p>
            <input
              type="number"
              min={1}
              max={receiveItem.quantity_ordered - receiveItem.quantity_received}
              value={receiveQty}
              onChange={(e) => setReceiveQty(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setReceiveItem(null)} className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm">
                Cancel
              </button>
              <button onClick={handleReceive} disabled={receiving} className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded text-sm font-medium">
                {receiving ? 'Receiving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
