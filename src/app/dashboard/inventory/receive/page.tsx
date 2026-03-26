'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { formatCents, parseDollars } from '@/lib/types';

/* ---------- types ---------- */

interface ReceiveItem {
  key: number;
  inventory_item_id?: string;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  quantity: number;
  price_cents: number;
  cost_cents: number;
  matched: boolean; // true if matched to existing inventory
  source: 'scan' | 'manual' | 'invoice' | 'ai';
}

/* ---------- component ---------- */

export default function ReceivePage() {
  const [items, setItems] = useState<ReceiveItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceText, setInvoiceText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; totalUnitsReceived: number } | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('other');
  const [manualSku, setManualSku] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualPrice, setManualPrice] = useState('');
  const [manualCost, setManualCost] = useState('');

  const scanRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.cost_cents * i.quantity, 0);

  /* ---- Barcode scan handler ---- */
  async function handleScan(barcode: string) {
    if (!barcode.trim()) return;

    // Check if we already have this barcode in the current batch
    const existing = items.find((i) => i.barcode === barcode);
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
      setScanInput('');
      return;
    }

    // Search inventory for this barcode
    try {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(barcode)}`);
      const data = await res.json();
      const match = Array.isArray(data) ? data.find((d: { barcode: string }) => d.barcode === barcode) : null;

      if (match) {
        setItems((prev) => [
          ...prev,
          {
            key: nextKey.current++,
            inventory_item_id: match.id,
            name: match.name,
            category: match.category,
            sku: match.sku ?? '',
            barcode,
            quantity: 1,
            price_cents: match.price_cents,
            cost_cents: match.cost_cents,
            matched: true,
            source: 'scan',
          },
        ]);
      } else {
        // Unknown barcode — add as new with placeholder
        setItems((prev) => [
          ...prev,
          {
            key: nextKey.current++,
            name: `Unknown (${barcode})`,
            category: 'other',
            sku: '',
            barcode,
            quantity: 1,
            price_cents: 0,
            cost_cents: 0,
            matched: false,
            source: 'scan',
          },
        ]);
      }
    } catch {
      // Offline or error — add as unknown
      setItems((prev) => [
        ...prev,
        {
          key: nextKey.current++,
          name: `Unknown (${barcode})`,
          category: 'other',
          sku: '',
          barcode,
          quantity: 1,
          price_cents: 0,
          cost_cents: 0,
          matched: false,
          source: 'scan',
        },
      ]);
    }

    setScanInput('');
    scanRef.current?.focus();
  }

  /* ---- Manual add ---- */
  function addManualItem() {
    if (!manualName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        name: manualName.trim(),
        category: manualCategory,
        sku: manualSku.trim(),
        barcode: manualBarcode.trim(),
        quantity: Math.max(1, parseInt(manualQty) || 1),
        price_cents: manualPrice ? parseDollars(manualPrice) : 0,
        cost_cents: manualCost ? parseDollars(manualCost) : 0,
        matched: false,
        source: 'manual',
      },
    ]);
    setManualName('');
    setManualSku('');
    setManualBarcode('');
    setManualQty('1');
    setManualPrice('');
    setManualCost('');
    setShowManual(false);
    scanRef.current?.focus();
  }

  /* ---- Invoice AI import ---- */
  async function handleInvoiceImport() {
    if (!invoiceText.trim()) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/inventory/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: invoiceText }),
      });
      const data = await res.json();

      if (data.items?.length > 0) {
        const newItems: ReceiveItem[] = data.items.map((item: {
          name: string;
          category?: string;
          sku?: string;
          barcode?: string;
          quantity?: number;
          price_cents?: number;
          cost_cents?: number;
        }) => ({
          key: nextKey.current++,
          name: item.name,
          category: item.category ?? 'other',
          sku: item.sku ?? '',
          barcode: item.barcode ?? '',
          quantity: item.quantity ?? 1,
          price_cents: item.price_cents ?? 0,
          cost_cents: item.cost_cents ?? 0,
          matched: false,
          source: 'invoice' as const,
        }));
        setItems((prev) => [...prev, ...newItems]);
        setShowInvoice(false);
        setInvoiceText('');
      } else {
        setError(data.notes ?? 'No items found in invoice');
      }
    } catch {
      setError('Failed to process invoice');
    } finally {
      setProcessing(false);
    }
  }

  /* ---- Update item ---- */
  function updateItem(key: number, patch: Partial<ReceiveItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  /* ---- Submit receiving ---- */
  async function handleSubmit() {
    if (items.length === 0) return;
    setProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            inventory_item_id: i.inventory_item_id,
            barcode: i.barcode || undefined,
            sku: i.sku || undefined,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            price_cents: i.price_cents,
            cost_cents: i.cost_cents,
          })),
          source: items[0]?.source ?? 'manual',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to receive inventory');
      setResult(data);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setProcessing(false);
    }
  }

  /* ---- Success ---- */
  if (success && result) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-8">
          <h2 className="text-xl font-bold text-green-400">Inventory Received</h2>
          <div className="mt-4 space-y-1 text-sm text-zinc-300">
            <p><span className="font-medium text-green-400">{result.totalUnitsReceived}</span> units received</p>
            <p><span className="font-medium text-blue-400">{result.created}</span> new items created</p>
            <p><span className="font-medium text-zinc-400">{result.updated}</span> existing items updated</p>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Link href="/dashboard/inventory" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 transition-colors">
            View Inventory
          </Link>
          <button
            onClick={() => { setSuccess(false); setResult(null); setItems([]); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
          >
            Receive More
          </button>
        </div>
      </div>
    );
  }

  /* ---- Main UI ---- */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Receive Inventory</h1>
        {items.length > 0 && (
          <div className="text-sm text-zinc-400">
            {items.length} items · {totalUnits} units · {formatCents(totalCost)} cost
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Input methods */}
      <div className="space-y-3">
        {/* Barcode scan input */}
        <div className="flex gap-2">
          <input
            ref={scanRef}
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleScan(scanInput);
              }
            }}
            autoFocus
            placeholder="Scan barcode or type item name..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => handleScan(scanInput)}
            className="rounded-lg bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(!showManual)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              showManual ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            + Manual Entry
          </button>
          <button
            onClick={() => setShowInvoice(!showInvoice)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              showInvoice ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Import Invoice (AI)
          </button>
        </div>

        {/* Manual entry form */}
        {showManual && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 space-y-3">
            <div className="text-sm font-medium text-white">Add Item Manually</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Name *" value={manualName} onChange={(e) => setManualName(e.target.value)}
                className="col-span-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                <option value="tcg_single">TCG Single</option>
                <option value="sealed">Sealed Product</option>
                <option value="board_game">Board Game</option>
                <option value="miniature">Miniature</option>
                <option value="accessory">Accessory</option>
                <option value="food_drink">Food / Drink</option>
                <option value="other">Other</option>
              </select>
              <input type="text" placeholder="Qty" value={manualQty} onChange={(e) => setManualQty(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              <input type="text" placeholder="SKU" value={manualSku} onChange={(e) => setManualSku(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              <input type="text" placeholder="Barcode" value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              <input type="text" placeholder="Retail $" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              <input type="text" placeholder="Cost $" value={manualCost} onChange={(e) => setManualCost(e.target.value)}
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={addManualItem} disabled={!manualName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                Add
              </button>
              <button onClick={() => setShowManual(false)}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Invoice import */}
        {showInvoice && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 space-y-3">
            <div className="text-sm font-medium text-white">Import from Invoice</div>
            <p className="text-xs text-zinc-400">
              Paste your distributor invoice, packing list, or order confirmation. AI will extract all items.
            </p>
            <textarea
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
              rows={6}
              placeholder="Paste invoice text here..."
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={handleInvoiceImport} disabled={!invoiceText.trim() || processing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
                {processing ? 'Extracting...' : 'Extract Items'}
              </button>
              <button onClick={() => { setShowInvoice(false); setInvoiceText(''); }}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium text-right">Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Cost</th>
                  <th className="px-4 py-2 font-medium text-right">Retail</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {items.map((item) => (
                  <tr key={item.key} className="text-white">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-zinc-500">
                        {item.category}
                        {item.sku && ` · ${item.sku}`}
                        {item.barcode && ` · ${item.barcode}`}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right text-sm text-white tabular-nums focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                      {item.cost_cents > 0 ? formatCents(item.cost_cents) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {item.price_cents > 0 ? formatCents(item.price_cents) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {item.matched ? (
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400 border border-green-500/30">
                          Existing
                        </span>
                      ) : item.name.startsWith('Unknown') ? (
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400 border border-yellow-500/30">
                          New — needs details
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400 border border-blue-500/30">
                          New
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-zinc-400">
              {items.filter((i) => i.matched).length} existing · {items.filter((i) => !i.matched).length} new
            </div>
            <button
              onClick={handleSubmit}
              disabled={processing || items.length === 0}
              className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {processing ? 'Receiving...' : `Receive ${totalUnits} Units`}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <p className="text-lg font-medium text-zinc-400">Ready to receive</p>
          <p className="mt-2 text-sm text-zinc-500">
            Scan barcodes, add items manually, or import a distributor invoice.
          </p>
        </div>
      )}
    </div>
  );
}
