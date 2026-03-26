'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCents, RETURN_REASONS } from '@/lib/types';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="hidden md:block text-2xl font-bold text-white">Returns</h1>
        <Link
          href="/dashboard/returns/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          New Return
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-zinc-400">Loading returns...</div>
      ) : returns.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
          No returns yet.
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {returns.map((r) => (
              <div key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 min-h-11">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{r.customer_name}</span>
                  <span className="text-sm text-red-400 font-medium">-{formatCents(r.total_refund_cents)}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {r.item_count} items &middot; {r.refund_method === 'store_credit' ? 'Store Credit' : 'Cash'} &middot; {reasonLabel(r.reason)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium text-right">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Refund</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {returns.map((r) => (
                  <tr key={r.id} className="text-white hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-300">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{r.customer_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.item_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-400">
                      -{formatCents(r.total_refund_cents)}
                    </td>
                    <td className="px-4 py-3">
                      {r.refund_method === 'store_credit' ? 'Store Credit' : 'Cash'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{reasonLabel(r.reason)}</td>
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
