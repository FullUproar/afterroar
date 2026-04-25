'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCents, RETURN_REASONS, ReturnReason } from '@/lib/types';
import { useStoreSettings } from '@/lib/store-settings';
import { PageHeader } from '@/components/page-header';

/* ---------- types ---------- */

interface SaleItem {
  inventory_item_id: string;
  name: string;
  category: string | null;
  quantity: number;
  price_cents: number;
  already_returned: number;
  max_returnable: number;
}

interface SaleRow {
  id: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string;
  amount_cents: number;
  payment_method: string;
  items: SaleItem[];
}

interface ReturnItem {
  inventory_item_id: string;
  name: string;
  category: string | null;
  price_cents: number;
  quantity: number;
  max_returnable: number;
  restock: boolean;
  selected: boolean;
}

/* ---------- shared styles ---------- */
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

const primaryBtnStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  letterSpacing: '0.06em',
  fontWeight: 700,
  padding: '0 1rem',
  minHeight: 48,
  color: 'var(--void)',
  background: 'var(--orange)',
  border: '1px solid var(--orange)',
};

const ghostBtnStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  letterSpacing: '0.18em',
  fontWeight: 600,
  padding: '0 0.85rem',
  minHeight: 44,
  color: 'var(--ink-soft)',
  border: '1px solid var(--rule-hi)',
  background: 'var(--panel)',
};

/* ---------- component ---------- */

export default function NewReturnPage() {
  const storeSettings = useStoreSettings();
  const [step, setStep] = useState(1);

  // Step 1 — find sale
  const [searchQuery, setSearchQuery] = useState('');
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);

  // Step 2 — select items
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState<ReturnReason>('changed_mind');
  const [reasonNotes, setReasonNotes] = useState('');

  // Step 3 — refund method
  const [refundMethod, setRefundMethod] = useState<'cash' | 'store_credit'>('cash');
  const [creditBonus, setCreditBonus] = useState(storeSettings.return_credit_bonus_percent);
  const [restockingFee, setRestockingFee] = useState(storeSettings.return_restocking_fee_percent);

  // submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resultData, setResultData] = useState<{
    total_refund_cents: number;
    refund_method: string;
  } | null>(null);

  /* ---- sale search ---- */
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSales([]);
      return;
    }
    const ctrl = new AbortController();
    setSalesLoading(true);
    fetch(`/api/returns/sales?q=${encodeURIComponent(searchQuery)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => setSales(d))
      .catch(() => {})
      .finally(() => setSalesLoading(false));
    return () => ctrl.abort();
  }, [searchQuery]);

  /* ---- select a sale ---- */
  function selectSale(sale: SaleRow) {
    setSelectedSale(sale);
    setReturnItems(
      sale.items
        .filter((i) => i.max_returnable > 0)
        .map((i) => ({
          inventory_item_id: i.inventory_item_id,
          name: i.name,
          category: i.category,
          price_cents: i.price_cents,
          quantity: 1,
          max_returnable: i.max_returnable,
          restock: true,
          selected: false,
        }))
    );
    setStep(2);
  }

  /* ---- item helpers ---- */
  function toggleItem(idx: number) {
    setReturnItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, selected: !item.selected } : item
      )
    );
  }

  function updateItem(idx: number, patch: Partial<ReturnItem>) {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  const selectedItems = returnItems.filter((i) => i.selected);
  const subtotalCents = selectedItems.reduce(
    (sum, i) => sum + i.price_cents * i.quantity,
    0
  );
  const restockingFeeCents = Math.round(subtotalCents * restockingFee / 100);
  const refundAmountCents = subtotalCents - restockingFeeCents;
  const totalRefundCents =
    refundMethod === 'store_credit'
      ? Math.round(refundAmountCents * (1 + creditBonus / 100))
      : refundAmountCents;

  /* ---- submit ---- */
  async function handleSubmit() {
    const methodLabel = refundMethod === 'store_credit' ? 'store credit' : 'cash';
    const confirmed = window.confirm(
      `Refund ${formatCents(totalRefundCents)} to ${methodLabel}? This cannot be undone.`
    );
    if (!confirmed) return;
    setSubmitting(true);
    setError('');
    try {
      const body = {
        original_ledger_entry_id: selectedSale!.id,
        items: selectedItems.map((i) => ({
          inventory_item_id: i.inventory_item_id,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          price_cents: i.price_cents,
          restock: i.restock,
        })),
        refund_method: refundMethod,
        credit_bonus_percent: refundMethod === 'store_credit' ? creditBonus : 0,
        reason,
        reason_notes: reasonNotes.trim() || null,
        restocking_fee_percent: restockingFee,
      };
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to process return');
      }
      const data = await res.json();
      setResultData(data);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- success screen ---- */
  if (success && resultData) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div
          className="ar-zone"
          style={{ borderColor: 'var(--teal)' }}
        >
          <div
            className="ar-zone-head"
            style={{ background: 'var(--teal-mute)', color: 'var(--teal)' }}
          >
            <span>Return Processed</span>
          </div>
          <div className="p-8">
            <p className="font-display text-teal mb-2" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              Refund issued
            </p>
            <p className="text-ink-soft" style={{ fontSize: '0.95rem' }}>
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-mono tabular-nums text-ink">{formatCents(resultData.total_refund_cents)}</span>{' '}
              {resultData.refund_method === 'store_credit' ? 'store credit' : 'cash refund'}
            </p>
            {selectedSale?.customer_name && selectedSale.customer_name !== 'Guest' && (
              <p className="font-mono text-ink-faint mt-2" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                Customer: {selectedSale.customer_name}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/returns"
          className="inline-flex items-center font-mono uppercase transition-colors"
          style={ghostBtnStyle}
        >
          ← Back to Returns
        </Link>
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="New Return"
        crumb="Console · Sales"
        desc="Find the original sale, pick items to return, choose refund method."
        backHref="/dashboard/returns"
      />

      {/* progress indicator — operator-grade */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map((s) => {
          const on = s === step;
          const done = s < step;
          return (
            <div
              key={s}
              className="flex-1 inline-flex items-center justify-center font-mono uppercase"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 700,
                padding: '0.55rem 0.5rem',
                minHeight: 36,
                color: on ? 'var(--orange)' : done ? 'var(--teal)' : 'var(--ink-faint)',
                border: `1px solid ${on ? 'var(--orange)' : done ? 'var(--teal)' : 'var(--rule-hi)'}`,
                background: on ? 'var(--orange-mute)' : done ? 'var(--teal-mute)' : 'var(--panel)',
              }}
            >
              Step {s}
              {done && <span className="ml-1.5">✓</span>}
            </div>
          );
        })}
      </div>

      {error && (
        <div
          className="p-3"
          style={{
            border: '1px solid var(--red)',
            background: 'var(--red-mute)',
            color: 'var(--red)',
          }}
        >
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ============ STEP 1: FIND SALE ============ */}
      {step === 1 && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 1 · Find Original Sale</span></div>
          <div className="p-5 space-y-4">
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={inputStyle}
            />

            {salesLoading && (
              <p className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.66rem', letterSpacing: '0.18em' }}>
                Searching...
              </p>
            )}

            {sales.length > 0 && (
              <div className="space-y-2">
                {sales.map((sale) => {
                  const hasReturnableItems = sale.items.some((i) => i.max_returnable > 0);
                  return (
                    <button
                      key={sale.id}
                      onClick={() => hasReturnableItems && selectSale(sale)}
                      disabled={!hasReturnableItems}
                      className={`ar-stripe ar-lstripe w-full p-4 text-left transition-colors ${hasReturnableItems ? 'hover:bg-panel' : 'cursor-not-allowed opacity-50'}`}
                      style={{
                        background: 'var(--panel-mute)',
                        border: '1px solid var(--rule)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-display text-ink" style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {sale.customer_name}
                          </span>
                          <span className="ml-3 font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                            {new Date(sale.created_at).toLocaleDateString()}{' '}
                            {new Date(sale.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-ink" style={{ fontWeight: 600 }}>
                          {formatCents(sale.amount_cents)}
                        </span>
                      </div>
                      <div className="mt-1 text-ink-soft" style={{ fontSize: '0.85rem' }}>
                        {sale.items.map((i) => i.name).join(', ')}
                      </div>
                      {!hasReturnableItems && (
                        <div className="mt-1 font-mono uppercase text-red-fu" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                          All items already returned
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 2: SELECT ITEMS ============ */}
      {step === 2 && selectedSale && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 2 · Select Items to Return</span></div>
          <div className="p-5 space-y-4">
            <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
              Sale to <span className="text-ink">{selectedSale.customer_name}</span> on{' '}
              <span className="text-ink">{new Date(selectedSale.created_at).toLocaleDateString()}</span> ·{' '}
              <span className="font-mono tabular-nums text-ink">{formatCents(selectedSale.amount_cents)}</span>
            </div>

            {/* items */}
            <div className="space-y-2">
              {returnItems.map((item, idx) => (
                <div
                  key={item.inventory_item_id}
                  className="p-4 transition-colors"
                  style={{
                    background: item.selected ? 'var(--orange-mute)' : 'var(--panel-mute)',
                    border: `1px solid ${item.selected ? 'var(--orange)' : 'var(--rule)'}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(idx)}
                      className="mt-1 h-4 w-4"
                      style={{ accentColor: 'var(--orange)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-ink" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{item.name}</div>
                        <div className="font-mono tabular-nums text-ink-soft" style={{ fontSize: '0.85rem' }}>
                          {formatCents(item.price_cents)} ea
                        </div>
                      </div>
                      {item.category && (
                        <div className="font-mono text-ink-faint" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>{item.category}</div>
                      )}
                      <div className="font-mono text-ink-faint" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>
                        Max returnable: {item.max_returnable}
                      </div>

                      {item.selected && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-1.5 text-ink-soft">
                            Qty
                            <input
                              type="number"
                              min="1"
                              max={item.max_returnable}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(idx, {
                                  quantity: Math.min(
                                    Math.max(1, Number(e.target.value)),
                                    item.max_returnable
                                  ),
                                })
                              }
                              className="w-16 font-mono tabular-nums"
                              style={{ ...inputStyle, padding: '0.4rem 0.5rem' }}
                            />
                          </label>

                          <label className="flex items-center gap-1.5 text-ink-soft">
                            <input
                              type="checkbox"
                              checked={item.restock}
                              onChange={(e) =>
                                updateItem(idx, { restock: e.target.checked })
                              }
                              className="h-3.5 w-3.5"
                              style={{ accentColor: 'var(--orange)' }}
                            />
                            Restock
                          </label>

                          <div className="ml-auto font-mono tabular-nums text-ink" style={{ fontWeight: 600 }}>
                            {formatCents(item.price_cents * item.quantity)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* reason */}
            <div className="space-y-2">
              <label className="block font-mono uppercase text-ink-faint" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                style={inputStyle}
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              placeholder="Additional notes (optional)"
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, minHeight: 60 }}
            />

            {/* running total */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              <span className="font-mono uppercase text-ink-soft" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                Return Subtotal ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
              </span>
              <span className="font-mono tabular-nums text-ink" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {formatCents(subtotalCents)}
              </span>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center font-mono uppercase transition-colors"
                style={ghostBtnStyle}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedItems.length === 0}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={primaryBtnStyle}
              >
                Next: Refund Method →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 3: REFUND METHOD ============ */}
      {step === 3 && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 3 · Refund Method</span></div>
          <div className="p-5 space-y-4">
            {/* toggle */}
            <div className="flex gap-1.5">
              {(['cash', 'store_credit'] as const).map((m) => {
                const on = refundMethod === m;
                return (
                  <button
                    key={m}
                    onClick={() => setRefundMethod(m)}
                    className="flex-1 inline-flex items-center justify-center font-mono uppercase transition-colors"
                    style={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.18em',
                      fontWeight: 700,
                      minHeight: 48,
                      color: on ? 'var(--orange)' : 'var(--ink-soft)',
                      border: `1px solid ${on ? 'var(--orange)' : 'var(--rule-hi)'}`,
                      background: on ? 'var(--orange-mute)' : 'var(--panel)',
                    }}
                  >
                    {m === 'store_credit' ? 'Store Credit' : 'Cash'}
                  </button>
                );
              })}
            </div>

            {refundMethod === 'store_credit' && (
              <div className="p-4" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  Credit Bonus %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={creditBonus}
                    onChange={(e) => setCreditBonus(Math.max(0, Number(e.target.value)))}
                    className="w-20 font-mono tabular-nums"
                    style={{ ...inputStyle, padding: '0.4rem 0.5rem', width: 80 }}
                  />
                </label>
              </div>
            )}

            {/* restocking fee */}
            <div className="p-4" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Restocking Fee %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={restockingFee}
                  onChange={(e) => setRestockingFee(Math.max(0, Number(e.target.value)))}
                  className="w-20 font-mono tabular-nums"
                  style={{ ...inputStyle, padding: '0.4rem 0.5rem', width: 80 }}
                />
              </label>
            </div>

            {/* summary */}
            <div className="ar-zone">
              <div className="ar-zone-head"><span>Summary</span></div>
              <div className="p-4 space-y-2 text-sm">
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  Customer: <span className="text-ink">{selectedSale?.customer_name ?? 'Guest'}</span>
                </div>
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  Original Sale:{' '}
                  <span className="text-ink">
                    {selectedSale && new Date(selectedSale.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  Reason:{' '}
                  <span className="text-ink">
                    {RETURN_REASONS.find((r) => r.value === reason)?.label}
                  </span>
                </div>

                <ul className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                  {selectedItems.map((item) => (
                    <li key={item.inventory_item_id} className="flex justify-between text-ink-soft">
                      <span>
                        {item.name} ×{item.quantity}
                        {!item.restock && (
                          <span className="ml-1 font-mono uppercase text-yellow" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}>
                            (no restock)
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatCents(item.price_cents * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between pt-2 text-ink-soft" style={{ borderTop: '1px solid var(--rule)' }}>
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatCents(subtotalCents)}</span>
                </div>

                {restockingFeeCents > 0 && (
                  <div className="flex justify-between text-ink-soft">
                    <span>Restocking Fee ({restockingFee}%)</span>
                    <span className="font-mono tabular-nums">-{formatCents(restockingFeeCents)}</span>
                  </div>
                )}

                {refundMethod === 'store_credit' && creditBonus > 0 && (
                  <div className="flex justify-between text-teal">
                    <span>Credit Bonus (+{creditBonus}%)</span>
                    <span className="font-mono tabular-nums">
                      +{formatCents(totalRefundCents - refundAmountCents)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2" style={{ fontWeight: 700, fontSize: '1.05rem', borderTop: '1px solid var(--rule)' }}>
                  <span className="font-display">
                    Total Refund ({refundMethod === 'store_credit' ? 'Store Credit' : 'Cash'})
                  </span>
                  <span className="font-mono tabular-nums text-red-fu">
                    {formatCents(totalRefundCents)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center font-mono uppercase transition-colors"
                style={ghostBtnStyle}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedItems.length === 0}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={{
                  ...primaryBtnStyle,
                  background: 'var(--teal)',
                  border: '1px solid var(--teal)',
                  color: 'var(--void)',
                }}
              >
                {submitting ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
