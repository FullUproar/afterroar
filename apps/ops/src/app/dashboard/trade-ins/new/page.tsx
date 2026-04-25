'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Link from 'next/link';
import { Customer, formatCents, parseDollars } from '@/lib/types';
import { useStoreSettings } from '@/lib/store-settings';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { PageHeader } from '@/components/page-header';
import { HelpTooltip } from '@/components/help-tooltip';
import { calculateOffer, type Condition } from '@/lib/tcg-pricing';

/* ---------- types ---------- */

interface InventoryResult {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  image_url: string | null;
  quantity: number;
}

interface TradeItem {
  key: number;
  name: string;
  category: string;
  market_price_cents: number;
  offer_price_cents: number;
  condition: Condition;
  quantity: number;
  inventory_item_id?: string;
  image_url?: string | null;
  current_stock?: number;
  manualOffer?: boolean; // true when user has manually edited the offer
}

const CONDITIONS: Condition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];

/* Condition pill colors — operator console palette
   NM/LP/MP = teal/orange/yellow tonal grade,
   HP/DMG = red-tinted to signal "rough card" */
const CONDITION_COLORS: Record<Condition, { fg: string; bg: string; activeBg: string; border: string }> = {
  NM:  { fg: 'var(--teal)',   bg: 'transparent', activeBg: 'var(--teal-mute)',   border: 'var(--teal)' },
  LP:  { fg: 'var(--orange)', bg: 'transparent', activeBg: 'var(--orange-mute)', border: 'var(--orange)' },
  MP:  { fg: 'var(--yellow)', bg: 'transparent', activeBg: 'var(--yellow-mute)', border: 'var(--yellow)' },
  HP:  { fg: 'var(--red)',    bg: 'transparent', activeBg: 'var(--red-mute)',    border: 'var(--red)' },
  DMG: { fg: 'var(--red)',    bg: 'transparent', activeBg: 'var(--red-mute)',    border: 'var(--red)' },
};

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

export default function NewTradeInPage() {
  const storeSettings = useStoreSettings();
  const [step, setStep] = useState(1);

  // Cash position indicator for buylist decisions
  const [cashIndicator, setCashIndicator] = useState<{ level: "healthy" | "tight" | "critical"; message: string } | null>(null);
  useEffect(() => {
    fetch("/api/intelligence").then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data?.insights) return;
      const runway = data.insights.find((i: { id: string }) => i.id === "liquidity-runway");
      if (!runway) return;
      if (runway.type === "warning") {
        setCashIndicator({ level: runway.priority === "high" ? "critical" : "tight", message: "Cash is tight — consider offering store credit instead of cash" });
      } else {
        setCashIndicator({ level: "healthy", message: "Cash position is healthy" });
      }
    }).catch(() => {});
  }, []);

  // Step 1 — customer
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);

  // Step 2 — items
  const [items, setItems] = useState<TradeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryResult[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const nextKey = useRef(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Step 3 — payout
  const [payoutType, setPayoutType] = useState<'cash' | 'credit'>('cash');
  const [creditBonus, setCreditBonus] = useState(storeSettings.trade_in_credit_bonus_percent);
  const [notes, setNotes] = useState('');
  const [customerTier, setCustomerTier] = useState<string | null>(null);

  // Tiered credit bonus: VIP customers get a better rate
  useEffect(() => {
    if (!selectedCustomer) { setCustomerTier(null); return; }
    // Check customer's lifetime spend to determine tier
    fetch(`/api/customers/${selectedCustomer.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.ledger_entries) return;
        const lifetime = data.ledger_entries
          .filter((e: { type: string }) => e.type === "sale")
          .reduce((s: number, e: { amount_cents: number }) => s + e.amount_cents, 0);
        const baseBonus = storeSettings.trade_in_credit_bonus_percent;
        if (lifetime >= 50000) { // $500+ = VIP
          setCustomerTier("VIP");
          setCreditBonus(baseBonus + 10); // +10% on top
        } else if (lifetime >= 20000) { // $200+ = Regular
          setCustomerTier("Regular");
          setCreditBonus(baseBonus + 5); // +5% on top
        } else {
          setCustomerTier(null);
          setCreditBonus(baseBonus);
        }
      })
      .catch(() => {});
  }, [selectedCustomer, storeSettings.trade_in_credit_bonus_percent]);

  // Track which items just had their offer recalculated (for flash animation)
  const [flashingKeys, setFlashingKeys] = useState<Set<number>>(new Set());

  // submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  /* ---- customer search ---- */
  useEffect(() => {
    if (customerQuery.length < 2) {
      setCustomerResults([]);
      return;
    }
    const ctrl = new AbortController();
    setCustomerLoading(true);
    fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setCustomerResults(d))
      .catch(() => {})
      .finally(() => setCustomerLoading(false));
    return () => ctrl.abort();
  }, [customerQuery]);

  /* ---- inventory search ---- */
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/inventory/search?q=${encodeURIComponent(searchQuery)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setSearchResults(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [searchQuery]);

  /* ---- helpers ---- */

  function addItemFromSearch(inv: InventoryResult) {
    const defaultCondition: Condition = "LP";
    const isTCG = inv.category === "tcg_single";
    // Use TCG pricing engine for singles, 50% for everything else
    const offerCents = isTCG
      ? calculateOffer({ marketPriceCents: inv.price_cents, condition: defaultCondition, isFoil: false })
      : Math.round(inv.price_cents * 0.5);

    setItems((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        name: inv.name,
        category: inv.category,
        market_price_cents: inv.price_cents,
        offer_price_cents: offerCents,
        condition: defaultCondition,
        quantity: 1,
        inventory_item_id: inv.id,
        image_url: inv.image_url,
        current_stock: inv.quantity,
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function addManualItem() {
    if (!manualName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        name: manualName.trim(),
        category: manualCategory.trim(),
        market_price_cents: 0,
        offer_price_cents: 0,
        condition: 'LP' as Condition,
        quantity: 1,
      },
    ]);
    setManualName('');
    setManualCategory('');
    setShowManual(false);
    searchRef.current?.focus();
  }

  /** Flash the offer field briefly when auto-recalculated */
  const triggerFlash = useCallback((key: number) => {
    setFlashingKeys((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setFlashingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 600);
  }, []);

  /** Compute offer cents for an item given its properties */
  function computeOffer(item: { category: string; market_price_cents: number }, condition: Condition): number {
    const isTCG = item.category === "tcg_single";
    if (isTCG && item.market_price_cents > 0) {
      return calculateOffer({ marketPriceCents: item.market_price_cents, condition, isFoil: false });
    }
    return Math.round(item.market_price_cents * 0.5);
  }

  function updateItem(key: number, patch: Partial<TradeItem>) {
    setItems((prev) => prev.map((i) => {
      if (i.key !== key) return i;
      const updated = { ...i, ...patch };

      // If user manually edited the offer, mark it so condition changes don't override
      if (patch.offer_price_cents !== undefined && !patch.condition) {
        updated.manualOffer = true;
      }

      // Auto-recalculate offer when condition changes (unless user manually overrode)
      if (patch.condition && !updated.manualOffer && i.market_price_cents > 0) {
        updated.offer_price_cents = computeOffer(i, patch.condition as Condition);
        triggerFlash(key);
      }
      return updated;
    }));
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const totalOfferCents = items.reduce((s, i) => s + i.offer_price_cents * i.quantity, 0);
  const totalPayoutCents =
    payoutType === 'credit'
      ? Math.round(totalOfferCents * (1 + creditBonus / 100))
      : totalOfferCents;

  /* ---- quick-create customer ---- */
  async function createCustomer() {
    if (!newName.trim()) return;
    setCustomerLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() || null, phone: newPhone.trim() || null }),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      const customer = await res.json();
      setSelectedCustomer(customer);
      setShowCreate(false);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setCustomerLoading(false);
    }
  }

  /* ---- submit ---- */
  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const body = {
        customer_id: selectedCustomer!.id,
        items: items.map((i) => ({
          name: i.name,
          category: i.category,
          attributes: { condition: i.condition, inventory_item_id: i.inventory_item_id },
          quantity: i.quantity,
          market_price_cents: i.market_price_cents,
          offer_price_cents: i.offer_price_cents,
        })),
        payout_type: payoutType,
        credit_bonus_percent: payoutType === 'credit' ? creditBonus : 0,
        notes: notes.trim() || null,
      };
      const res = await fetch('/api/trade-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create trade-in');
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create trade-in');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- keyboard nav ---- */
  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      addItemFromSearch(searchResults[0]);
    }
  }

  /* ---- success screen ---- */
  if (success) {
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="ar-zone" style={{ borderColor: 'var(--teal)' }}>
          <div className="ar-zone-head" style={{ background: 'var(--teal-mute)', color: 'var(--teal)' }}>
            <span>Trade-In Complete</span>
          </div>
          <div className="p-8">
            <p className="font-display text-teal mb-2" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              Payout issued
            </p>
            <p className="text-ink-soft" style={{ fontSize: '0.95rem' }}>
              {items.length} item{items.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-mono tabular-nums text-ink">{formatCents(totalPayoutCents)}</span>{' '}
              {payoutType === 'credit' ? 'store credit' : 'cash'}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/trade-ins"
          className="inline-flex items-center font-mono uppercase transition-colors"
          style={ghostBtnStyle}
        >
          ← Back to Trade-Ins
        </Link>
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="New Trade-In"
        crumb="Console · Stock"
        desc="Pick a customer, scan / search items, choose payout method."
        backHref="/dashboard/trade-ins"
      />

      {/* progress */}
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
        <div className="p-3" style={{ border: '1px solid var(--red)', background: 'var(--red-mute)', color: 'var(--red)' }}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ============ STEP 1: CUSTOMER ============ */}
      {step === 1 && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 1 · Select Customer</span></div>
          <div className="p-5 space-y-4">

            {selectedCustomer ? (
              <div className="flex items-center justify-between p-4" style={{ background: 'var(--orange-mute)', border: '1px solid var(--orange)' }}>
                <div>
                  <div className="font-display text-ink" style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                  {selectedCustomer.email && (
                    <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>{selectedCustomer.email}</div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="font-mono uppercase text-ink-soft hover:text-ink transition-colors"
                  style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600, minHeight: 44, padding: '0 0.6rem' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search customers by name..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  autoFocus
                  style={inputStyle}
                />

                {customerLoading && (
                  <p className="font-mono uppercase text-ink-faint" style={{ fontSize: '0.66rem', letterSpacing: '0.18em' }}>
                    Searching...
                  </p>
                )}

                {customerResults.length > 0 && (
                  <div className="space-y-1 p-2" style={{ background: 'var(--panel)', border: '1px solid var(--rule)' }}>
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerQuery('');
                          setCustomerResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-panel-hi transition-colors"
                        style={{ minHeight: 44 }}
                      >
                        <span className="font-display" style={{ fontWeight: 500 }}>{c.name}</span>
                        {c.email && <span className="ml-2 font-mono text-ink-soft" style={{ fontSize: '0.74rem' }}>{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="font-mono uppercase text-orange hover:underline transition-colors"
                  style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 700, minHeight: 36, padding: '0 0.4rem' }}
                >
                  {showCreate ? '× Cancel' : '+ Create New Customer'}
                </button>

                {showCreate && (
                  <div className="space-y-3 p-4" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
                    <input
                      type="text"
                      placeholder="Name *"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      onClick={createCustomer}
                      disabled={!newName.trim() || customerLoading}
                      className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                      style={primaryBtnStyle}
                    >
                      Create & Select
                    </button>
                  </div>
                )}
              </>
            )}

            {selectedCustomer && (
              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center font-display uppercase transition-colors"
                  style={primaryBtnStyle}
                >
                  Next: Add Items →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 2: ITEMS ============ */}
      {step === 2 && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 2 · Add Items</span></div>
          <div className="p-5 space-y-4">

            {/* Cash position indicator */}
            {cashIndicator && cashIndicator.level !== "healthy" && (
              <div
                className="px-3 py-2 text-xs flex items-center gap-2"
                style={{
                  background: cashIndicator.level === "critical" ? 'var(--red-mute)' : 'var(--yellow-mute)',
                  border: `1px solid ${cashIndicator.level === "critical" ? 'var(--red)' : 'var(--yellow)'}`,
                  color: cashIndicator.level === "critical" ? 'var(--red)' : 'var(--yellow)',
                }}
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${cashIndicator.level === "critical" ? "animate-pulse" : ""}`}
                  style={{ background: cashIndicator.level === "critical" ? 'var(--red)' : 'var(--yellow)' }}
                />
                <span className="font-mono uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.14em', fontWeight: 700 }}>
                  {cashIndicator.message}
                </span>
              </div>
            )}

            {/* search */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search inventory to add item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => setShowBarcodeScanner(true)}
                  className="inline-flex items-center font-mono uppercase transition-colors"
                  style={ghostBtnStyle}
                  title="Scan barcode"
                >
                  Scan
                </button>
              </div>
              {searchResults.length > 0 && (
                <div
                  className="absolute z-10 mt-1 w-full shadow-xl"
                  style={{ background: 'var(--panel)', border: '1px solid var(--rule)' }}
                >
                  {searchResults.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => addItemFromSearch(inv)}
                      className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-panel-hi transition-colors"
                      style={{ minHeight: 44 }}
                    >
                      <span className="font-display" style={{ fontWeight: 500 }}>{inv.name}</span>
                      <span className="ml-2 font-mono text-ink-soft" style={{ fontSize: '0.7rem' }}>{inv.category}</span>
                      <span className="ml-2 font-mono tabular-nums text-ink-soft" style={{ fontSize: '0.7rem' }}>{formatCents(inv.price_cents)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowManual((v) => !v)}
              className="font-mono uppercase text-orange hover:underline transition-colors"
              style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 700, minHeight: 36, padding: '0 0.4rem' }}
            >
              {showManual ? '× Cancel Manual Entry' : '+ Manual Entry'}
            </button>

            {showManual && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Item name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
                  style={{ ...inputStyle, width: 144 }}
                />
                <button
                  onClick={addManualItem}
                  disabled={!manualName.trim()}
                  className="inline-flex items-center disabled:opacity-50"
                  style={ghostBtnStyle}
                >
                  Add
                </button>
              </div>
            )}

            {/* items list */}
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="p-4 space-y-3"
                    style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
                  >
                    {/* Row 1: Item info left, remove button right */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 min-w-0">
                        {/* Card image */}
                        {item.image_url && item.category === "tcg_single" && (
                          <div
                            className="shrink-0 w-14 overflow-hidden"
                            style={{ height: 78, background: 'var(--slate)', border: '1px solid var(--rule)' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-display text-ink truncate" style={{ fontWeight: 600 }}>{item.name}</div>
                          {item.category && (
                            <div className="font-mono text-ink-faint" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>{item.category}</div>
                          )}
                          {item.market_price_cents > 0 && (
                            <div className="font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                              Market: <span className="tabular-nums">{formatCents(item.market_price_cents)}</span>
                            </div>
                          )}
                          {item.current_stock !== undefined && item.category === "tcg_single" && (
                            <div className="font-mono mt-0.5" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>
                              {item.current_stock <= 1 ? (
                                <span className="text-red-fu">🔥 Low stock — offer more to secure</span>
                              ) : item.current_stock >= 5 ? (
                                <span className="text-teal">Well stocked ({item.current_stock}) — standard offer</span>
                              ) : (
                                <span className="text-ink-soft">{item.current_stock} in stock</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-ink-faint hover:text-red-fu transition-colors text-lg leading-none flex items-center justify-center"
                        style={{ minHeight: 44, minWidth: 44 }}
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        ×
                      </button>
                    </div>

                    {/* Row 2: Condition pill row */}
                    <div className="flex gap-1.5">
                      {CONDITIONS.map((c) => {
                        const isActive = item.condition === c;
                        const colors = CONDITION_COLORS[c];
                        return (
                          <button
                            key={c}
                            onClick={() => updateItem(item.key, { condition: c })}
                            className="flex-1 inline-flex items-center justify-center font-mono uppercase transition-colors"
                            style={{
                              fontSize: '0.78rem',
                              letterSpacing: '0.14em',
                              fontWeight: 700,
                              minHeight: 44,
                              color: colors.fg,
                              border: `1px solid ${isActive ? colors.border : 'var(--rule-hi)'}`,
                              background: isActive ? colors.activeBg : colors.bg,
                            }}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 3: Offer + Qty + Line total */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-1.5 text-ink-soft">
                        <span className="font-mono uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600 }}>Offer $</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(item.offer_price_cents / 100).toFixed(2)}
                          onChange={(e) =>
                            updateItem(item.key, {
                              offer_price_cents: parseDollars(e.target.value),
                            })
                          }
                          className="w-24 font-mono tabular-nums transition-all"
                          style={{
                            ...inputStyle,
                            padding: '0.4rem 0.5rem',
                            ...(flashingKeys.has(item.key)
                              ? { borderColor: 'var(--orange)', background: 'var(--orange-mute)' }
                              : {}),
                          }}
                        />
                        {item.manualOffer && (
                          <button
                            onClick={() => {
                              const recalc = computeOffer(item, item.condition);
                              setItems((prev) => prev.map((i) =>
                                i.key === item.key ? { ...i, offer_price_cents: recalc, manualOffer: false } : i
                              ));
                              triggerFlash(item.key);
                            }}
                            className="font-mono uppercase text-orange hover:underline"
                            style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700 }}
                            title="Reset to auto-calculated offer"
                          >
                            Reset
                          </button>
                        )}
                      </label>

                      <label className="flex items-center gap-1.5 text-ink-soft">
                        <span className="font-mono uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600 }}>Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.key, { quantity: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-16 font-mono tabular-nums"
                          style={{ ...inputStyle, padding: '0.4rem 0.5rem' }}
                        />
                      </label>

                      <div className="ml-auto font-mono tabular-nums text-ink" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        {formatCents(item.offer_price_cents * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* running total */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              <span className="font-mono uppercase text-ink-soft" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600 }}>
                Running Total
              </span>
              <span className="font-mono tabular-nums text-ink" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {formatCents(totalOfferCents)}
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
                disabled={items.length === 0}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={primaryBtnStyle}
              >
                Next: Payout →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 3: PAYOUT ============ */}
      {step === 3 && (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Step 3 · Payout</span></div>
          <div className="p-5 space-y-4">

            {/* toggle */}
            <div className="flex gap-1.5">
              {(['cash', 'credit'] as const).map((t) => {
                const on = payoutType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setPayoutType(t)}
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
                    {t === 'credit' ? 'Store Credit' : 'Cash'}
                  </button>
                );
              })}
            </div>

            {payoutType === 'credit' && (
              <div className="p-4 space-y-2" style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="font-mono uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 600 }}>Credit Bonus %</span>
                  <HelpTooltip text="The credit bonus is an extra percentage added on top of the cash offer when customers choose store credit. A 30% bonus means a $10 cash offer becomes $13 in store credit." />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={creditBonus}
                    onChange={(e) => setCreditBonus(Math.max(0, Number(e.target.value)))}
                    className="w-20 font-mono tabular-nums"
                    style={{ ...inputStyle, padding: '0.4rem 0.5rem' }}
                  />
                </label>
                {customerTier && (
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: '0.6rem',
                        letterSpacing: '0.18em',
                        fontWeight: 700,
                        padding: '2px 6px',
                        color: customerTier === "VIP" ? 'var(--yellow)' : 'var(--teal)',
                        background: customerTier === "VIP" ? 'var(--yellow-mute)' : 'var(--teal-mute)',
                        border: `1px solid ${customerTier === "VIP" ? 'var(--yellow)' : 'var(--teal)'}`,
                      }}
                    >
                      {customerTier} +{customerTier === "VIP" ? "10" : "5"}% bonus
                    </span>
                  </div>
                )}
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.78rem', letterSpacing: '0.04em' }}>
                  Base: <span className="tabular-nums">{formatCents(totalOfferCents)}</span> + {creditBonus}% bonus ={' '}
                  <span className="tabular-nums text-teal" style={{ fontWeight: 600 }}>{formatCents(totalPayoutCents)}</span>
                </div>
              </div>
            )}

            {/* notes */}
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, minHeight: 60 }}
            />

            {/* summary */}
            <div className="ar-zone">
              <div className="ar-zone-head"><span>Summary</span></div>
              <div className="p-4 space-y-2 text-sm">
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  Customer: <span className="text-ink">{selectedCustomer?.name}</span>
                </div>
                <div className="font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  Items: <span className="text-ink">{items.length}</span> ({items.reduce((s, i) => s + i.quantity, 0)} total qty)
                </div>
                <ul className="space-y-1 pt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                  {items.map((item) => (
                    <li key={item.key} className="flex justify-between text-ink-soft">
                      <span>
                        {item.name} <span className="font-mono text-ink-faint">({item.condition})</span> ×{item.quantity}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatCents(item.offer_price_cents * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between pt-2 text-ink" style={{ fontWeight: 500, borderTop: '1px solid var(--rule)' }}>
                  <span>Total Offer</span>
                  <span className="font-mono tabular-nums">{formatCents(totalOfferCents)}</span>
                </div>
                <div className="flex justify-between text-ink" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  <span className="font-display">
                    Payout ({payoutType === 'credit' ? `Credit +${creditBonus}%` : 'Cash'})
                  </span>
                  <span className="font-mono tabular-nums text-teal">{formatCents(totalPayoutCents)}</span>
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
                disabled={submitting}
                className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
                style={{
                  ...primaryBtnStyle,
                  background: 'var(--teal)',
                  border: '1px solid var(--teal)',
                }}
              >
                {submitting ? 'Processing...' : 'Complete Trade-In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode scanner */}
      {showBarcodeScanner && (
        <BarcodeScanner
          title="Scan Item Barcode"
          onScan={(code) => {
            setShowBarcodeScanner(false);
            setSearchQuery(code);
          }}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
}
