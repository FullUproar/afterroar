'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { formatCents } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';

/* ------------------------------------------------------------------ */
/*  Form-draft pattern reference                                       */
/*                                                                     */
/*  Every multi-field form should follow this contract:               */
/*    1. const { value, setValue, hasDraft, clearDraft } =            */
/*         useFormDraft("<unique-key>", initialValues);                */
/*    2. const dirty = JSON.stringify(value) !==                       */
/*         JSON.stringify(initialValues);                              */
/*    3. useUnsavedChangesWarning(dirty);                              */
/*    4. On successful submit: clearDraft();                           */
/*                                                                     */
/*  This keeps work safe across:                                      */
/*    - Mode toggles (dashboard ↔ register) — confirm prompt           */
/*    - Tab close / browser navigation — beforeunload prompt           */
/*    - Accidental nav back — auto-restore on remount                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Customer Segments                                                   */
/* ------------------------------------------------------------------ */

type CustomerSegment = 'vip' | 'regular' | 'new' | 'at_risk' | 'dormant' | 'active';

interface SegmentedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  credit_balance_cents: number;
  created_at: string;
  segment: CustomerSegment;
  lifetime_spend_cents: number;
  purchases_30d: number;
  last_purchase_date: string | null;
}

interface SegmentCounts {
  vip: number;
  regular: number;
  new: number;
  at_risk: number;
  dormant: number;
  active: number;
  total: number;
}

/**
 * Operator-Console segment chip.
 *  - color discipline: orange = VIP/active, yellow = at-risk, teal = regular/new ok,
 *    ink-faint = dormant, ink-soft = active default.
 *  - shape + glyph + label so color is never alone.
 */
const SEGMENT_CONFIG: Record<CustomerSegment, {
  label: string;
  glyph: string;
  /** Foreground color token */
  color: string;
  /** Background tint token */
  bg: string;
  /** Border color */
  border: string;
}> = {
  vip: {
    label: 'VIP',
    glyph: '★',
    color: 'var(--orange)',
    bg: 'var(--orange-mute)',
    border: 'rgba(255,122,0,0.35)',
  },
  regular: {
    label: 'Regular',
    glyph: '◆',
    color: 'var(--teal)',
    bg: 'var(--teal-mute)',
    border: 'rgba(94,176,155,0.30)',
  },
  new: {
    label: 'New',
    glyph: '+',
    color: 'var(--teal)',
    bg: 'var(--teal-mute)',
    border: 'rgba(94,176,155,0.30)',
  },
  at_risk: {
    label: 'At Risk',
    glyph: '!',
    color: 'var(--yellow)',
    bg: 'var(--yellow-mute)',
    border: 'rgba(251,219,101,0.35)',
  },
  dormant: {
    label: 'Dormant',
    glyph: '·',
    color: 'var(--ink-faint)',
    bg: 'var(--panel)',
    border: 'var(--rule-hi)',
  },
  active: {
    label: 'Active',
    glyph: '✓',
    color: 'var(--ink-soft)',
    bg: 'var(--panel)',
    border: 'var(--rule-hi)',
  },
};

function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const cfg = SEGMENT_CONFIG[segment];
  return (
    <span
      className="inline-flex items-center gap-1 font-mono"
      style={{
        fontSize: '0.6rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
        padding: '2px 6px',
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      <span aria-hidden="true">{cfg.glyph}</span>
      {cfg.label}
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<SegmentedCustomer[]>([]);
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  // Form draft is auto-persisted to localStorage per the contract above.
  // hasDraft lets us nudge the user that there's a recovered draft.
  const CUSTOMER_FORM_INITIAL = { name: '', email: '', phone: '' };
  const { value: form, setValue: setForm, hasDraft: hasFormDraft, clearDraft: clearFormDraft } =
    useFormDraft<{ name: string; email: string; phone: string }>(
      'customers-create',
      CUSTOMER_FORM_INITIAL,
    );
  // Dirty when any field differs from initial — drives the unsaved-
  // changes warning on mode switch + tab close.
  const formDirty =
    form.name !== CUSTOMER_FORM_INITIAL.name ||
    form.email !== CUSTOMER_FORM_INITIAL.email ||
    form.phone !== CUSTOMER_FORM_INITIAL.phone;
  useUnsavedChangesWarning(formDirty);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const PAGE_SIZE = 10;

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        // Third click: turn off sorting
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'email' || key === 'segment' ? 'asc' : 'desc');
    }
    setPage(0);
  }

  function sortArrow(key: string) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  const loadCustomers = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/customers/segments');
      if (!res.ok) {
        setLoadError('Failed to load customers. Try again.');
        return;
      }
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setCounts(data.counts ?? null);
    } catch {
      setLoadError('Failed to load customers. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Auto-open the form if there's a recovered draft so the cashier
  // sees their work-in-progress immediately.
  useEffect(() => {
    if (hasFormDraft && formDirty) setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', email: '', phone: '' });
        // Drop the persisted draft now that it's been submitted.
        clearFormDraft();
        setShowForm(false);
        setCreateError(null);
        loadCustomers();
      } else {
        const body = await res.json().catch(() => ({ error: 'Failed to add customer' }));
        setCreateError(body.error || 'Failed to add customer');
      }
    } catch {
      setCreateError('Network error — could not add customer');
    } finally {
      setSaving(false);
    }
  }

  // Filter by search and segment
  const filtered = customers.filter((c) => {
    if (segmentFilter !== 'all' && c.segment !== segmentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false)
      );
    }
    return true;
  });

  // Sort (null = no sort, use default order from API)
  const sorted = sortKey ? [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey as string) {
      case 'name': return dir * a.name.localeCompare(b.name);
      case 'email': return dir * (a.email || '').localeCompare(b.email || '');
      case 'segment': return dir * a.segment.localeCompare(b.segment);
      case 'lifetime_spend': return dir * (a.lifetime_spend_cents - b.lifetime_spend_cents);
      case 'credit': return dir * (a.credit_balance_cents - b.credit_balance_cents);
      case 'last_purchase': {
        const da = a.last_purchase_date ? new Date(a.last_purchase_date).getTime() : 0;
        const db = b.last_purchase_date ? new Date(b.last_purchase_date).getTime() : 0;
        return dir * (da - db);
      }
      default: return 0;
    }
  }) : filtered;

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, segmentFilter]);

  /* -------- KPI strip data ------------------------------------- */
  // Top customer (lifetime spend) + total credit outstanding —
  // computed locally so we don't add an extra fetch.
  const kpis = useMemo(() => {
    const top = customers.reduce<SegmentedCustomer | null>((best, c) => {
      if (!best) return c;
      return c.lifetime_spend_cents > best.lifetime_spend_cents ? c : best;
    }, null);
    const totalCreditCents = customers.reduce((sum, c) => sum + (c.credit_balance_cents ?? 0), 0);
    const totalLifetimeCents = customers.reduce((sum, c) => sum + (c.lifetime_spend_cents ?? 0), 0);
    return { top, totalCreditCents, totalLifetimeCents };
  }, [customers]);

  const segmentButtons: Array<{ key: CustomerSegment | 'all'; label: string; count: number | null; tooltip: string }> = [
    { key: 'all', label: 'All', count: counts?.total ?? null, tooltip: 'All customers' },
    { key: 'vip', label: 'VIP', count: counts?.vip ?? null, tooltip: 'Lifetime spend $500+' },
    { key: 'regular', label: 'Regular', count: counts?.regular ?? null, tooltip: '3+ purchases in the last 30 days' },
    { key: 'new', label: 'New', count: counts?.new ?? null, tooltip: 'Created in the last 14 days' },
    { key: 'at_risk', label: 'At Risk', count: counts?.at_risk ?? null, tooltip: 'Spent $100+ but hasn\'t visited in 30-60 days' },
    { key: 'dormant', label: 'Dormant', count: counts?.dormant ?? null, tooltip: 'Spent $100+ but hasn\'t visited in 60+ days' },
  ];

  return (
    <div className="flex flex-col h-full gap-4 min-w-0">
      <PageHeader
        title="Customers"
        crumb="Console · Network"
        desc="Walk-ins and Connect members. Tagged automatically by spend and recency — find regulars, re-engage at-risk, spot VIPs."
        action={
          <div className="flex gap-2">
            <a
              href={`/api/customers/export${segmentFilter !== 'all' ? `?segment=${segmentFilter}` : ''}`}
              download
              className="inline-flex items-center font-mono uppercase border px-3 transition-colors"
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                minHeight: 44,
                color: 'var(--ink-soft)',
                borderColor: 'var(--rule-hi)',
                background: 'var(--panel)',
              }}
            >
              Export CSV
            </a>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center font-display uppercase transition-colors"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                fontWeight: 700,
                padding: '0 1rem',
                minHeight: 48,
                color: showForm ? 'var(--ink)' : 'var(--void)',
                background: showForm ? 'transparent' : 'var(--orange)',
                border: showForm ? '1px solid var(--rule-hi)' : '1px solid var(--orange)',
              }}
            >
              {showForm ? 'Cancel' : 'Add Customer'}
            </button>
          </div>
        }
      />

      {/* KPI strip — operator readout (5 cells). */}
      {counts && (
        <section
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px"
          style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}
        >
          <KpiCell k="Total Customers" v={counts.total.toLocaleString()} primary />
          <KpiCell
            k="VIP"
            v={counts.vip.toLocaleString()}
            sub={counts.total > 0 ? `${Math.round((counts.vip / counts.total) * 100)}%` : '—'}
          />
          <KpiCell
            k="At Risk"
            v={counts.at_risk.toLocaleString()}
            sub={counts.at_risk > 0 ? 'Re-engage' : '—'}
            tone={counts.at_risk > 0 ? 'warn' : undefined}
          />
          <KpiCell
            k="Lifetime Spend"
            v={formatCents(kpis.totalLifetimeCents)}
            sub={kpis.top ? `Top: ${kpis.top.name}` : undefined}
          />
          <KpiCell
            k="Store Credit Out"
            v={formatCents(kpis.totalCreditCents)}
            sub={kpis.totalCreditCents > 0 ? 'Owed to customers' : '—'}
          />
        </section>
      )}

      {/* Add customer form — operator-console panel, slides in below header. */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4"
          style={{
            background: 'var(--panel-mute)',
            border: '1px solid var(--rule)',
            padding: '1.1rem',
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p
              className="font-mono uppercase text-ink-soft"
              style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}
            >
              New Customer
            </p>
            {hasFormDraft && formDirty && (
              <button
                type="button"
                onClick={() => { setForm({ name: '', email: '', phone: '' }); clearFormDraft(); }}
                className="font-mono uppercase text-orange hover:text-yellow transition-colors"
                style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
              >
                Discard draft
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FieldLabel label="Name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full font-body text-ink focus:outline-none"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--rule-hi)',
                  fontSize: '0.92rem',
                  padding: '0.65rem 0.85rem',
                  minHeight: 44,
                }}
              />
            </FieldLabel>
            <FieldLabel label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full font-body text-ink focus:outline-none"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--rule-hi)',
                  fontSize: '0.92rem',
                  padding: '0.65rem 0.85rem',
                  minHeight: 44,
                }}
              />
            </FieldLabel>
            <FieldLabel label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full font-body text-ink focus:outline-none"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--rule-hi)',
                  fontSize: '0.92rem',
                  padding: '0.65rem 0.85rem',
                  minHeight: 44,
                }}
              />
            </FieldLabel>
          </div>
          {createError && (
            <p
              className="font-mono"
              style={{
                fontSize: '0.7rem',
                letterSpacing: '0.06em',
                color: 'var(--red)',
                background: 'var(--red-mute)',
                border: '1px solid rgba(214,90,90,0.35)',
                padding: '0.55rem 0.75rem',
              }}
            >
              ! {createError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center font-display uppercase transition-colors disabled:opacity-50"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                fontWeight: 700,
                padding: '0 1.15rem',
                minHeight: 48,
                color: 'var(--void)',
                background: 'var(--orange)',
                border: '1px solid var(--orange)',
              }}
            >
              {saving ? 'Adding…' : 'Add Customer'}
            </button>
          </div>
        </form>
      )}

      {/* Segment filter — pill row */}
      {counts && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {segmentButtons.map((seg) => {
              const on = segmentFilter === seg.key;
              return (
                <button
                  key={seg.key}
                  onClick={() => setSegmentFilter(seg.key)}
                  className="inline-flex items-center gap-2 font-mono uppercase transition-colors"
                  style={{
                    fontSize: '0.66rem',
                    letterSpacing: '0.18em',
                    fontWeight: 600,
                    padding: '0.45rem 0.8rem',
                    minHeight: 36,
                    color: on ? 'var(--orange)' : 'var(--ink-soft)',
                    border: `1px solid ${on ? 'var(--orange)' : 'var(--rule-hi)'}`,
                    background: on ? 'var(--orange-mute)' : 'var(--panel)',
                  }}
                >
                  <span>{seg.label}</span>
                  {seg.count !== null && (
                    <span
                      className="tabular-nums"
                      style={{
                        opacity: 0.75,
                        fontSize: '0.62rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {seg.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {segmentFilter !== 'all' && (
            <p
              className="font-mono text-ink-faint"
              style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}
            >
              {segmentButtons.find(s => s.key === segmentFilter)?.tooltip}
              {' '}— auto-tagged from purchase history
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full font-body text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--rule-hi)',
            fontSize: '0.92rem',
            padding: '0.6rem 0.9rem',
            minHeight: 44,
          }}
        />
      </div>

      {loadError && (
        <div
          className="flex items-center justify-between gap-3"
          style={{
            border: '1px solid rgba(214,90,90,0.35)',
            background: 'var(--red-mute)',
            padding: '0.75rem 1rem',
          }}
        >
          <p className="font-mono uppercase text-red-fu" style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}>
            ! {loadError}
          </p>
          <button
            onClick={() => { setLoadError(null); loadCustomers(); }}
            className="font-mono uppercase text-red-fu hover:text-ink transition-colors"
            style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
          >
            Try again →
          </button>
        </div>
      )}

      {loading ? (
        <p
          className="font-mono uppercase text-ink-soft"
          style={{ fontSize: '0.7rem', letterSpacing: '0.18em', padding: '2rem 0', textAlign: 'center' }}
        >
          Loading customers…
        </p>
      ) : filtered.length === 0 && !loadError ? (
        <div className="ar-zone">
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}
            >
              {search || segmentFilter !== 'all' ? 'No matches' : 'No customers yet'}
            </div>
            <p className="font-display text-ink" style={{ fontSize: '1.2rem', letterSpacing: '0.005em' }}>
              {search || segmentFilter !== 'all' ? 'Try a different search or segment.' : 'Add your first customer to start tracking.'}
            </p>
            {!search && segmentFilter === 'all' && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 inline-flex items-center font-display uppercase"
                style={{
                  fontSize: '0.85rem',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  padding: '0.7rem 1.15rem',
                  minHeight: 48,
                  color: 'var(--void)',
                  background: 'var(--orange)',
                  border: '1px solid var(--orange)',
                }}
              >
                Add Your First Customer
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Result count */}
          <div className="shrink-0 flex items-center justify-between">
            <span
              className="font-mono uppercase text-ink-faint"
              style={{ fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 600 }}
            >
              {filtered.length.toLocaleString()} customer{filtered.length !== 1 ? 's' : ''}
              {totalPages > 1 ? ` · page ${page + 1} of ${totalPages}` : ''}
            </span>
          </div>

          {/* Scrollable data area */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-visible">
            {/* Mobile / tablet card view */}
            <div className="md:hidden flex flex-col" style={{ gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              {paginated.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/customers/${c.id}`}
                  className="ar-lstripe block"
                  style={{
                    background: 'var(--panel-mute)',
                    padding: '0.85rem 1rem',
                    minHeight: 64,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-display text-ink truncate" style={{ fontSize: '1rem', fontWeight: 500 }}>
                        {c.name}
                      </span>
                      <SegmentBadge segment={c.segment} />
                    </div>
                    <span
                      className="font-mono tabular-nums shrink-0"
                      style={{
                        fontSize: '0.78rem',
                        color: c.credit_balance_cents > 0 ? 'var(--teal)' : 'var(--ink-faint)',
                        fontWeight: 600,
                      }}
                    >
                      {formatCents(c.credit_balance_cents ?? 0)}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 flex items-center gap-3 font-mono"
                    style={{ fontSize: '0.66rem', letterSpacing: '0.04em', color: 'var(--ink-faint)' }}
                  >
                    <span className="truncate">{c.email || c.phone || 'No contact'}</span>
                    {c.lifetime_spend_cents > 0 && (
                      <span className="tabular-nums shrink-0" style={{ color: 'var(--ink-soft)' }}>
                        {formatCents(c.lifetime_spend_cents)} lifetime
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop dense list — operator-grade rows */}
            <div className="hidden md:flex flex-col">
              {/* Column headers */}
              <div
                className="grid items-center font-mono uppercase text-ink-faint sticky top-0 z-10"
                style={{
                  gridTemplateColumns: '1.6fr 110px 1.4fr 130px 130px 130px',
                  gap: '0.85rem',
                  padding: '0.55rem 1rem',
                  background: 'var(--panel-mute)',
                  borderBottom: '1px solid var(--rule)',
                  borderTop: '1px solid var(--rule)',
                  borderLeft: '1px solid var(--rule)',
                  borderRight: '1px solid var(--rule)',
                  fontSize: '0.55rem',
                  letterSpacing: '0.22em',
                  fontWeight: 600,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="text-left hover:text-ink transition-colors"
                >
                  Customer{sortArrow('name')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort('segment')}
                  className="text-left hover:text-ink transition-colors"
                >
                  Segment{sortArrow('segment')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort('email')}
                  className="text-left hover:text-ink transition-colors"
                >
                  Contact{sortArrow('email')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort('lifetime_spend')}
                  className="text-right hover:text-ink transition-colors"
                >
                  Lifetime{sortArrow('lifetime_spend')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort('credit')}
                  className="text-right hover:text-ink transition-colors"
                >
                  Credit{sortArrow('credit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort('last_purchase')}
                  className="text-right hover:text-ink transition-colors"
                >
                  Last Visit{sortArrow('last_purchase')}
                </button>
              </div>
              {/* Rows */}
              <div
                className="ar-stagger flex flex-col"
                style={{
                  borderLeft: '1px solid var(--rule)',
                  borderRight: '1px solid var(--rule)',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                {paginated.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/customers/${c.id}`}
                    className="ar-lstripe grid items-center hover:bg-panel transition-colors"
                    style={{
                      gridTemplateColumns: '1.6fr 110px 1.4fr 130px 130px 130px',
                      gap: '0.85rem',
                      padding: '0.7rem 1rem',
                      minHeight: 60,
                      background: 'var(--panel-mute)',
                      borderBottom: '1px solid var(--rule-faint)',
                    }}
                  >
                    <span
                      className="font-display text-ink truncate"
                      style={{ fontSize: '0.98rem', fontWeight: 500, letterSpacing: '0.005em' }}
                    >
                      {c.name}
                    </span>
                    <span>
                      <SegmentBadge segment={c.segment} />
                    </span>
                    <span
                      className="font-mono truncate"
                      style={{ fontSize: '0.74rem', color: 'var(--ink-soft)', letterSpacing: '0.02em' }}
                    >
                      {c.email || c.phone || '—'}
                    </span>
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{ fontSize: '0.84rem', color: 'var(--ink)', fontWeight: 600 }}
                    >
                      {c.lifetime_spend_cents > 0 ? formatCents(c.lifetime_spend_cents) : '—'}
                    </span>
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{
                        fontSize: '0.84rem',
                        color: c.credit_balance_cents > 0 ? 'var(--teal)' : 'var(--ink-faint)',
                        fontWeight: 600,
                      }}
                    >
                      {formatCents(c.credit_balance_cents ?? 0)}
                    </span>
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', letterSpacing: '0.02em' }}
                    >
                      {c.last_purchase_date
                        ? new Date(c.last_purchase_date).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center font-mono uppercase transition-colors disabled:opacity-30"
                style={{
                  fontSize: '0.66rem',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  padding: '0 0.85rem',
                  minHeight: 36,
                  color: 'var(--ink-soft)',
                  border: '1px solid var(--rule-hi)',
                  background: 'var(--panel)',
                }}
              >
                ← Prev
              </button>
              <div className="flex items-center gap-px">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i;
                  } else if (page < 3) {
                    pageNum = i;
                  } else if (page > totalPages - 4) {
                    pageNum = totalPages - 7 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  const on = page === pageNum;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className="font-mono tabular-nums transition-colors"
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        width: 36,
                        height: 36,
                        color: on ? 'var(--orange)' : 'var(--ink-soft)',
                        background: on ? 'var(--orange-mute)' : 'var(--panel)',
                        border: `1px solid ${on ? 'var(--orange)' : 'var(--rule-hi)'}`,
                      }}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center font-mono uppercase transition-colors disabled:opacity-30"
                style={{
                  fontSize: '0.66rem',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  padding: '0 0.85rem',
                  minHeight: 36,
                  color: 'var(--ink-soft)',
                  border: '1px solid var(--rule-hi)',
                  background: 'var(--panel)',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function KpiCell({
  k,
  v,
  sub,
  primary,
  tone,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
  tone?: 'warn' | 'err' | 'ok';
}) {
  const toneColor =
    tone === 'warn' ? 'var(--yellow)' : tone === 'err' ? 'var(--red)' : tone === 'ok' ? 'var(--teal)' : undefined;
  return (
    <div
      className="bg-panel-mute flex flex-col justify-between"
      style={{ padding: '0.85rem 1.1rem', minHeight: 92 }}
    >
      <div
        className="font-mono uppercase text-ink-faint"
        style={{ fontSize: '0.55rem', letterSpacing: '0.24em', fontWeight: 600 }}
      >
        {k}
      </div>
      <div
        className="font-display leading-none mt-2 truncate"
        style={{
          fontWeight: 700,
          fontSize: 'clamp(1.25rem, 2.5vw, 1.85rem)',
          letterSpacing: '-0.01em',
          color: toneColor ?? (primary ? 'var(--orange)' : 'var(--ink)'),
        }}
      >
        {v}
      </div>
      {sub && (
        <div
          className="font-mono mt-2 truncate"
          style={{
            fontSize: '0.62rem',
            letterSpacing: '0.04em',
            color: toneColor ?? 'var(--ink-soft)',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="font-mono uppercase text-ink-soft"
        style={{ fontSize: '0.6rem', letterSpacing: '0.22em', fontWeight: 600 }}
      >
        {label}
        {required ? <span className="text-orange ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}
