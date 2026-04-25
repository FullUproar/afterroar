'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCents, RETURN_REASONS } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { SubNav } from '@/components/ui/sub-nav';
import { ORDERS_TABS } from '@/lib/nav-groups';

interface ReturnRow {
  id: string;
  created_at: string;
  customer_name: string;
  item_count: number;
  total_refund_cents: number;
  refund_method: 'cash' | 'store_credit';
  reason: string;
  status: string;
}

const reasonLabel = (reason: string) =>
  RETURN_REASONS.find((r) => r.value === reason)?.label ?? reason;

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/returns')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load returns');
        return res.json();
      })
      .then((data) => setReturns(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={ORDERS_TABS} />
      <PageHeader
        title="Returns"
        crumb="Console · Sales"
        desc="Refund processing — items back, stock restored, credit issued."
        action={
          <Link
            href="/dashboard/returns/new"
            className="inline-flex items-center font-display uppercase transition-colors"
            style={{
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              fontWeight: 700,
              padding: '0 1rem',
              minHeight: 48,
              color: 'var(--void)',
              background: 'var(--orange)',
              border: '1px solid var(--orange)',
            }}
          >
            New Return
          </Link>
        }
      />

      {error && (
        <div
          className="p-4"
          style={{
            border: '1px solid var(--red)',
            background: 'var(--red-mute)',
            color: 'var(--red)',
          }}
        >
          <p className="font-mono uppercase mb-1" style={{ fontSize: '0.66rem', letterSpacing: '0.18em', fontWeight: 700 }}>
            Error
          </p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Loading</span></div>
          <div className="p-8 text-center font-mono text-ink-soft" style={{ fontSize: '0.74rem', letterSpacing: '0.06em' }}>
            Loading returns...
          </div>
        </div>
      ) : returns.length === 0 ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Returns</span><span>No results</span></div>
          <div className="p-10 text-center">
            <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.66rem', letterSpacing: '0.28em' }}>
              No returns yet
            </p>
            <p className="font-display text-ink mb-1" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Process your first return
            </p>
            <p className="text-ink-soft mb-4 max-w-md mx-auto" style={{ fontSize: '0.85rem' }}>
              Stock is automatically restored and credit applied.
            </p>
            <Link
              href="/dashboard/returns/new"
              className="inline-flex items-center font-display uppercase transition-colors"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.06em',
                fontWeight: 700,
                padding: '0 1rem',
                minHeight: 48,
                color: 'var(--void)',
                background: 'var(--orange)',
                border: '1px solid var(--orange)',
              }}
            >
              Process a Return
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {returns.map((r) => (
              <div
                key={r.id}
                className="ar-lstripe"
                style={{
                  background: 'var(--panel-mute)',
                  border: '1px solid var(--rule)',
                  padding: '0.85rem 1.1rem',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-ink leading-snug" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {r.customer_name}
                  </span>
                  <span className="font-mono tabular-nums text-red-fu" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    -{formatCents(r.total_refund_cents)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                  {r.item_count} items · {r.refund_method === 'store_credit' ? 'Store Credit' : 'Cash'} · {reasonLabel(r.reason)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div
            className="hidden md:block overflow-hidden"
            style={{ background: 'var(--panel-mute)', border: '1px solid var(--rule)' }}
          >
            <table className="w-full text-left text-sm">
              <thead style={{ borderBottom: '1px solid var(--rule)', background: 'var(--slate)' }}>
                <tr className="font-mono uppercase text-ink-soft" style={{ fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 600 }}>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Refund</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr
                    key={r.id}
                    className="text-ink hover:bg-panel transition-colors"
                    style={{ borderTop: '1px solid var(--rule-faint)' }}
                  >
                    <td className="px-4 py-3 font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.78rem' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-display" style={{ fontWeight: 500 }}>{r.customer_name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{r.item_count}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-red-fu" style={{ fontWeight: 600 }}>
                      -{formatCents(r.total_refund_cents)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {r.refund_method === 'store_credit' ? 'Store Credit' : 'Cash'}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{reasonLabel(r.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
