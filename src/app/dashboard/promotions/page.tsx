'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { formatCents } from '@/lib/types';
import {
  PROMOTION_TYPES,
  PROMOTION_SCOPES,
  CUSTOMER_DISCOUNT_TAGS,
} from '@/lib/promotions';

interface Promo {
  id: string;
  name: string;
  type: string;
  value: number;
  scope: string;
  scope_value: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  priority: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'tcg_single', label: 'TCG Singles' },
  { value: 'sealed', label: 'Sealed Product' },
  { value: 'board_game', label: 'Board Games' },
  { value: 'miniature', label: 'Miniatures' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'food_drink', label: 'Food / Drink' },
  { value: 'other', label: 'Other' },
];

export default function PromotionsPage() {
  const { can } = useStore();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [type, setType] = useState('percent_off');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('all');
  const [scopeValue, setScopeValue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    fetch('/api/promotions')
      .then((r) => r.json())
      .then((d) => setPromos(d))
      .catch(() => setError('Failed to load promotions'))
      .finally(() => setLoading(false));
  }, []);

  if (!can('inventory.adjust')) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to manage promotions.</p>
      </div>
    );
  }

  async function handleCreate() {
    if (!name.trim() || !value) return;
    setSaving(true);
    setError('');
    try {
      const numValue = type === 'percent_off'
        ? parseInt(value)
        : Math.round(parseFloat(value) * 100); // dollars to cents for amount_off/fixed_price

      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          value: numValue,
          scope,
          scope_value: scopeValue || undefined,
          starts_at: startsAt || undefined,
          ends_at: endsAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');

      setPromos((prev) => [data, ...prev]);
      setShowCreate(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await fetch('/api/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      });
      setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
    } catch {
      setError('Failed to update');
    }
  }

  function resetForm() {
    setName('');
    setType('percent_off');
    setValue('');
    setScope('all');
    setScopeValue('');
    setStartsAt('');
    setEndsAt('');
  }

  function formatPromoValue(promo: Promo) {
    if (promo.type === 'percent_off') return `${promo.value}% off`;
    if (promo.type === 'amount_off') return `${formatCents(promo.value)} off`;
    if (promo.type === 'fixed_price') return `Fixed: ${formatCents(promo.value)}`;
    return String(promo.value);
  }

  function formatScope(promo: Promo) {
    const scopeDef = PROMOTION_SCOPES.find((s) => s.value === promo.scope);
    let label = scopeDef?.label ?? promo.scope;
    if (promo.scope_value) {
      if (promo.scope === 'category') {
        label = CATEGORIES.find((c) => c.value === promo.scope_value)?.label ?? promo.scope_value;
      } else if (promo.scope === 'customer_tag') {
        label = CUSTOMER_DISCOUNT_TAGS.find((t) => t.value === promo.scope_value)?.label ?? promo.scope_value;
      } else if (promo.scope === 'coupon') {
        label = `Code: ${promo.scope_value}`;
      } else if (promo.scope === 'quantity_min') {
        label = `Buy ${promo.scope_value}+`;
      } else {
        label += `: ${promo.scope_value}`;
      }
    }
    return label;
  }

  const needsScopeValue = ['category', 'item', 'customer_tag', 'quantity_min', 'combo', 'coupon'].includes(scope);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-2xl font-bold text-white">Promotions & Discounts</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {showCreate ? 'Cancel' : 'New Promotion'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Create Promotion</h2>

          <input
            type="text"
            placeholder="Promotion name (e.g. Weekend Board Game Sale)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                {PROMOTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Value ({type === 'percent_off' ? '%' : '$'})
              </label>
              <input type="number" min="0" step={type === 'percent_off' ? '1' : '0.01'}
                value={value} onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'percent_off' ? '20' : '5.00'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Applies to</label>
              <select value={scope} onChange={(e) => { setScope(e.target.value); setScopeValue(''); }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                {PROMOTION_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {needsScopeValue && (
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                {scope === 'category' ? 'Category' :
                 scope === 'customer_tag' ? 'Customer Group' :
                 scope === 'coupon' ? 'Coupon Code' :
                 scope === 'quantity_min' ? 'Minimum Quantity' :
                 scope === 'item' ? 'Item ID' :
                 scope === 'combo' ? 'Item IDs (id1+id2)' : 'Value'}
              </label>
              {scope === 'category' ? (
                <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ) : scope === 'customer_tag' ? (
                <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  <option value="">Select group</option>
                  {CUSTOMER_DISCOUNT_TAGS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)}
                  placeholder={scope === 'coupon' ? 'FNMNIGHT' : scope === 'quantity_min' ? '3' : ''}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none" />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Starts (optional)</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Ends (optional)</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>

          <button onClick={handleCreate} disabled={!name.trim() || !value || saving}
            className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors">
            {saving ? 'Creating...' : 'Create Promotion'}
          </button>
        </div>
      )}

      {/* Promotions list */}
      {loading ? (
        <div className="text-zinc-400">Loading promotions...</div>
      ) : promos.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          <p className="text-lg font-medium">No promotions yet</p>
          <p className="mt-2 text-sm">Create a sale, discount, or coupon to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((promo) => {
            const isExpired = promo.ends_at && new Date(promo.ends_at) < new Date();
            return (
              <div
                key={promo.id}
                className={`rounded-lg border p-4 transition-colors ${
                  !promo.active || isExpired
                    ? 'border-zinc-800 bg-zinc-900/50 opacity-60'
                    : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{promo.name}</span>
                      <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                        {formatPromoValue(promo)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {formatScope(promo)}
                      {promo.starts_at && (
                        <> · Starts {new Date(promo.starts_at).toLocaleDateString()}</>
                      )}
                      {promo.ends_at && (
                        <> · Ends {new Date(promo.ends_at).toLocaleDateString()}</>
                      )}
                      {isExpired && (
                        <span className="ml-2 text-red-400">(expired)</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(promo.id, !promo.active)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      promo.active ? 'bg-green-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        promo.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
