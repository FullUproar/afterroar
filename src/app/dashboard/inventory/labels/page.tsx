'use client';

import { useState, useEffect } from 'react';
import { SearchInput } from '@/components/search-input';
import { InventoryItem, formatCents } from '@/lib/types';

interface LabelItem {
  item: InventoryItem;
  quantity: number;
}

export default function LabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, LabelItem>>(new Map());
  const [labelSize, setLabelSize] = useState<'small' | 'medium'>('small');
  const [includePrice, setIncludePrice] = useState(true);
  const [includeBarcode, setIncludeBarcode] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) setItems(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      (async () => {
        const res = await fetch('/api/inventory');
        if (res.ok) setItems(await res.json());
      })();
      return;
    }

    const timer = setTimeout(async () => {
      const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) setItems(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function toggleItem(item: InventoryItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, quantity: 1 });
      }
      return next;
    });
  }

  function updateQuantity(id: string, qty: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) {
        next.set(id, { ...entry, quantity: Math.max(1, qty) });
      }
      return next;
    });
  }

  async function handlePrint() {
    if (selected.size === 0) return;
    setPrinting(true);
    try {
      const payload = {
        items: Array.from(selected.values()).map((s) => ({
          item_id: s.item.id,
          quantity: s.quantity,
        })),
        label_size: labelSize,
        include_price: includePrice,
        include_barcode: includeBarcode,
      };

      const res = await fetch('/api/inventory/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const html = await res.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 500);
        }
      }
    } finally {
      setPrinting(false);
    }
  }

  const totalLabels = Array.from(selected.values()).reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard/inventory" className="text-sm text-zinc-400 hover:text-white mb-2 block">
            &larr; Back to Inventory
          </a>
          <h1 className="text-2xl font-bold text-white">Print Labels</h1>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing || selected.size === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm font-medium"
        >
          {printing ? 'Preparing...' : `Print ${totalLabels} Label${totalLabels !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-wrap gap-6 items-center">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Label Size</label>
          <select
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value as 'small' | 'medium')}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm"
          >
            <option value="small">Small (1.5&quot; x 1&quot;)</option>
            <option value="medium">Medium (2&quot; x 1&quot;)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includePrice}
            onChange={(e) => setIncludePrice(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-800 text-indigo-600"
          />
          Include Price
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeBarcode}
            onChange={(e) => setIncludeBarcode(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-800 text-indigo-600"
          />
          Include Barcode
        </label>
      </div>

      {/* Selected items */}
      {selected.size > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Selected ({selected.size} items, {totalLabels} labels)
          </h2>
          <div className="space-y-2">
            {Array.from(selected.values()).map(({ item, quantity }) => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-800 rounded px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleItem(item)}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    X
                  </button>
                  <span className="text-white">{item.name}</span>
                  <span className="text-zinc-400">{formatCents(item.price_cents)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">Labels:</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                    className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm text-center"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search items to label..."
      />

      {loading ? (
        <p className="text-zinc-400">Loading inventory...</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-400">No items found.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                    selected.has(item.id) ? 'bg-indigo-900/20' : 'hover:bg-zinc-800/50'
                  } text-white`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleItem(item)}
                      className="rounded border-zinc-700 bg-zinc-800 text-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{item.sku || '--'}</td>
                  <td className="px-4 py-3 text-right">{formatCents(item.price_cents)}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{item.barcode || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
