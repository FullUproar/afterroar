'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatCents } from '@/lib/types';
import { StatusBadge } from '@/components/mobile-card';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SubNav } from "@/components/ui/sub-nav";

const INVENTORY_TABS = [
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/catalog', label: 'Card Catalog' },
  { href: '/dashboard/deck-builder', label: 'Deck Builder' },
  { href: '/dashboard/trade-ins', label: 'Trade-Ins' },
  { href: '/dashboard/consignment', label: 'Consignment' },
];

interface TradeInRow {
  id: string;
  created_at: string;
  customer_name: string;
  item_count: number;
  total_offer_cents: number;
  total_payout_cents: number;
  payout_type: 'cash' | 'credit';
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
}

const statusVariants: Record<string, 'pending' | 'info' | 'success' | 'error'> = {
  pending: 'pending',
  accepted: 'info',
  completed: 'success',
  rejected: 'error',
};

export default function TradeInsPage() {
  const [tradeIns, setTradeIns] = useState<TradeInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const loadTradeIns = useCallback(async () => {
    try {
      setError('');
      const res = await fetch(`/api/trade-ins?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Failed to load trade-ins');
      const result = await res.json();
      setTradeIns(result.data || result);
      if (result.total != null) setTotalItems(result.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadTradeIns();
  }, [loadTradeIns]);

  return (
    <div className="flex flex-col h-full gap-4">
      <SubNav items={INVENTORY_TABS} />
      <PageHeader
        title="Trade-Ins"
        crumb="Console · Stock"
        desc="Customer buylist intake — cards, games, accessories. Credit pushes straight to the customer's account."
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              href="/dashboard/trade-ins/bulk"
              className="inline-flex items-center font-mono uppercase transition-colors"
              style={{
                fontSize: '0.66rem',
                letterSpacing: '0.18em',
                fontWeight: 600,
                padding: '0 0.85rem',
                minHeight: 44,
                color: 'var(--ink-soft)',
                border: '1px solid var(--rule-hi)',
                background: 'var(--panel)',
              }}
            >
              Bulk Buylist
            </Link>
            <Link
              href="/dashboard/trade-ins/new"
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
              New Trade-In
            </Link>
          </div>
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
            Loading trade-ins...
          </div>
        </div>
      ) : tradeIns.length === 0 ? (
        <div className="ar-zone">
          <div className="ar-zone-head"><span>Trade-Ins</span><span>No results</span></div>
          <div className="p-10 text-center">
            <p className="font-mono uppercase text-ink-faint mb-2" style={{ fontSize: '0.66rem', letterSpacing: '0.28em' }}>
              No trade-ins yet
            </p>
            <p className="font-display text-ink mb-1" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Start your first trade-in
            </p>
            <p className="text-ink-soft mb-4 max-w-md mx-auto" style={{ fontSize: '0.85rem' }}>
              Accept trade-ins for cards, games, and accessories. Credit goes straight to the customer's account.
            </p>
            <Link
              href="/dashboard/trade-ins/new"
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
              Start Your First Trade-In
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {tradeIns.map((ti) => (
              <div
                key={ti.id}
                className="ar-lstripe"
                style={{
                  background: 'var(--panel-mute)',
                  border: '1px solid var(--rule)',
                  padding: '0.85rem 1.1rem',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-ink leading-snug" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {ti.customer_name}
                  </span>
                  <StatusBadge variant={statusVariants[ti.status] ?? 'info'} className="capitalize">
                    {ti.status}
                  </StatusBadge>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-ink-soft" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                  <span>{ti.item_count} items · {ti.payout_type}</span>
                  <span className="text-ink tabular-nums" style={{ fontWeight: 600 }}>{formatCents(ti.total_offer_cents)}</span>
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
                  <th className="px-4 py-3 text-right">Total Offer</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tradeIns.map((ti) => (
                  <tr
                    key={ti.id}
                    className="text-ink hover:bg-panel transition-colors"
                    style={{ borderTop: '1px solid var(--rule-faint)' }}
                  >
                    <td className="px-4 py-3 font-mono text-ink-soft tabular-nums" style={{ fontSize: '0.78rem' }}>
                      {new Date(ti.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-display" style={{ fontWeight: 500 }}>{ti.customer_name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{ti.item_count}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ fontWeight: 600 }}>
                      {formatCents(ti.total_offer_cents)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      <span className="capitalize">{ti.payout_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={statusVariants[ti.status] ?? 'info'} className="capitalize">
                        {ti.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        </>
      )}
    </div>
  );
}
