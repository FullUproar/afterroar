'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store-context';
import { formatCents } from '@/lib/types';

/* ---------- types ---------- */

interface LedgerAgg {
  sales_revenue_cents: number;
  event_fees_cents: number;
  gross_revenue_cents: number;
  trade_in_payouts_cents: number;
  refunds_cents: number;
  total_payouts_cents: number;
  net_cash_flow_cents: number;
  credit_issued_cents: number;
  credit_redeemed_cents: number;
}

interface CategoryRow {
  category: string;
  item_count: number;
  total_units: number;
  cost_basis_cents: number;
  retail_value_cents: number;
  potential_margin_cents: number;
  margin_percent: number;
  zero_stock_items: number;
}

interface DeadStockRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  cost_trapped_cents: number;
  retail_value_cents: number;
}

interface CashFlowData {
  today: LedgerAgg;
  this_week: LedgerAgg;
  this_month: LedgerAgg;
  all_time: LedgerAgg;
  month_trend: {
    revenue_change_cents: number;
    revenue_change_percent: number | null;
    payout_change_cents: number;
  };
  inventory: {
    total_skus: number;
    total_units: number;
    cost_basis_cents: number;
    retail_value_cents: number;
    potential_margin_cents: number;
    zero_stock_count: number;
  };
  category_breakdown: CategoryRow[];
  dead_stock: DeadStockRow[];
  trade_ins: {
    count: number;
    total_offer_cents: number;
    total_payout_cents: number;
    cash_payouts: number;
    credit_payouts: number;
  };
  returns: {
    count: number;
    total_refunded_cents: number;
    restocking_fees_collected_cents: number;
    cash_refunds: number;
    credit_refunds: number;
  };
  outstanding_credit: {
    total_cents: number;
    customer_count: number;
  };
  total_customers: number;
}

/* ---------- helpers ---------- */

const CATEGORY_LABELS: Record<string, string> = {
  tcg_single: 'TCG Singles',
  sealed: 'Sealed Product',
  board_game: 'Board Games',
  miniature: 'Miniatures',
  accessory: 'Accessories',
  food_drink: 'Café / Food',
  other: 'Other',
};

function catLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

function trendArrow(change: number) {
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '→';
}

function trendColor(change: number, positiveIsGood = true) {
  if (change === 0) return 'text-zinc-400';
  const isPositive = change > 0;
  return (isPositive === positiveIsGood) ? 'text-green-400' : 'text-red-400';
}

/* ---------- sub-components ---------- */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'yellow' | 'default';
}) {
  const accentMap = {
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    default: 'text-white',
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${accentMap[accent ?? 'default']}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white">{children}</h2>;
}

/* ---------- main component ---------- */

export default function CashFlowPage() {
  const { can } = useStore();
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'today' | 'this_week' | 'this_month'>('this_week');

  useEffect(() => {
    fetch('/api/reports/cash-flow')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load cash flow data');
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (!can('cash_flow')) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500">You don&apos;t have permission to view cash flow data.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-zinc-400">Loading cash flow intelligence...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        {error || 'Failed to load data'}
      </div>
    );
  }

  const agg = data[period];
  const periodLabels = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Cash Flow Intelligence</h1>
        <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
          {(['today', 'this_week', 'this_month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ---- TOP STAT CARDS ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`${periodLabels[period]} Revenue`}
          value={formatCents(agg.gross_revenue_cents)}
          sub={`Sales ${formatCents(agg.sales_revenue_cents)} + Events ${formatCents(agg.event_fees_cents)}`}
          accent="green"
        />
        <StatCard
          label={`${periodLabels[period]} Payouts`}
          value={formatCents(agg.total_payouts_cents)}
          sub={`Trade-ins ${formatCents(agg.trade_in_payouts_cents)} + Refunds ${formatCents(agg.refunds_cents)}`}
          accent="red"
        />
        <StatCard
          label={`${periodLabels[period]} Net Cash Flow`}
          value={formatCents(agg.net_cash_flow_cents)}
          accent={agg.net_cash_flow_cents >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Money In Inventory"
          value={formatCents(data.inventory.cost_basis_cents)}
          sub={`${data.inventory.total_skus} SKUs · ${data.inventory.total_units} units`}
        />
      </div>

      {/* ---- MONTH TREND ---- */}
      {data.month_trend.revenue_change_percent !== null && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400">Month-over-month:</span>
            <span className={trendColor(data.month_trend.revenue_change_cents)}>
              {trendArrow(data.month_trend.revenue_change_cents)} Revenue{' '}
              {data.month_trend.revenue_change_percent > 0 ? '+' : ''}
              {data.month_trend.revenue_change_percent}%
              ({formatCents(Math.abs(data.month_trend.revenue_change_cents))})
            </span>
            <span className={trendColor(data.month_trend.payout_change_cents, false)}>
              {trendArrow(data.month_trend.payout_change_cents)} Payouts{' '}
              {formatCents(Math.abs(data.month_trend.payout_change_cents))}
            </span>
          </div>
        </div>
      )}

      {/* ---- WHERE YOUR MONEY IS ---- */}
      <div className="space-y-4">
        <SectionHeader>Where Your Money Is</SectionHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Inventory (Cost Basis)"
            value={formatCents(data.inventory.cost_basis_cents)}
            sub={`Retail value: ${formatCents(data.inventory.retail_value_cents)}`}
          />
          <StatCard
            label="Potential Margin"
            value={formatCents(data.inventory.potential_margin_cents)}
            sub="If everything sold at retail"
            accent="green"
          />
          <StatCard
            label="Outstanding Store Credit"
            value={formatCents(data.outstanding_credit.total_cents)}
            sub={`${data.outstanding_credit.customer_count} customers with balances`}
            accent="yellow"
          />
        </div>
      </div>

      {/* ---- INVENTORY BY CATEGORY ---- */}
      <div className="space-y-4">
        <SectionHeader>Capital by Category</SectionHeader>

        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">SKUs</th>
                <th className="px-4 py-3 font-medium text-right">Units</th>
                <th className="px-4 py-3 font-medium text-right">Cost Basis</th>
                <th className="px-4 py-3 font-medium text-right">Retail Value</th>
                <th className="px-4 py-3 font-medium text-right">Margin</th>
                <th className="px-4 py-3 font-medium text-right">Out of Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data.category_breakdown.map((cat) => (
                <tr key={cat.category} className="text-white hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{catLabel(cat.category)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{cat.item_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{cat.total_units}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(cat.cost_basis_cents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(cat.retail_value_cents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-400">
                    {cat.margin_percent}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cat.zero_stock_items > 0 ? (
                      <span className="text-yellow-400">{cat.zero_stock_items}</span>
                    ) : (
                      <span className="text-zinc-500">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- DEAD STOCK ALERTS ---- */}
      {data.dead_stock.length > 0 && (
        <div className="space-y-4">
          <SectionHeader>Dead Stock Alerts</SectionHeader>
          <p className="text-sm text-zinc-400">
            Items with &gt;$50 cost basis sitting in inventory. This is where your cash is trapped.
          </p>

          <div className="overflow-hidden rounded-lg border border-yellow-500/20 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Cost Trapped</th>
                  <th className="px-4 py-3 font-medium text-right">Retail Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {data.dead_stock.map((item) => (
                  <tr key={item.id} className="text-white hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-zinc-300">{catLabel(item.category)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-yellow-400">
                      {formatCents(item.cost_trapped_cents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {formatCents(item.retail_value_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- TRADE-INS & RETURNS THIS MONTH ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-medium text-white">Trade-Ins This Month</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Count</span>
              <span className="text-white tabular-nums">{data.trade_ins.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Offer Value</span>
              <span className="text-white tabular-nums">{formatCents(data.trade_ins.total_offer_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Paid Out</span>
              <span className="text-red-400 tabular-nums">{formatCents(data.trade_ins.total_payout_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Cash / Credit</span>
              <span className="text-zinc-300">
                {data.trade_ins.cash_payouts} / {data.trade_ins.credit_payouts}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h3 className="font-medium text-white">Returns This Month</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Count</span>
              <span className="text-white tabular-nums">{data.returns.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Refunded</span>
              <span className="text-red-400 tabular-nums">{formatCents(data.returns.total_refunded_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Restocking Fees Collected</span>
              <span className="text-green-400 tabular-nums">
                {formatCents(data.returns.restocking_fees_collected_cents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Cash / Credit</span>
              <span className="text-zinc-300">
                {data.returns.cash_refunds} / {data.returns.credit_refunds}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- AI INSIGHTS PLACEHOLDER ---- */}
      <div className="rounded-lg border border-dashed border-indigo-500/30 bg-indigo-500/5 p-6">
        <h3 className="font-medium text-indigo-300">AI Insights</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Coming soon: AI-powered recommendations based on your cash flow patterns.
          &quot;Your sealed MTG inventory hasn&apos;t moved in 45 days — consider a 15% sale
          to free up ${formatCents(data.inventory.cost_basis_cents > 0 ? Math.round(data.inventory.cost_basis_cents * 0.15) : 0)}.&quot;
        </p>
      </div>
    </div>
  );
}
