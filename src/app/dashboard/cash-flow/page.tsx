'use client';

import { useEffect, useState, useRef } from 'react';
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
  last_sale_date: string | null;
  days_since_sale: number | null;
}

interface FastMoverRow {
  id: string;
  name: string;
  category: string;
  units_sold_30d: number;
  sales_per_week: number;
  current_stock: number;
  days_of_stock: number | null;
}

interface DailyRevenueRow {
  date: string;
  revenue_cents: number;
  payout_cents: number;
  net_cents: number;
  day_of_week: number;
}

interface MarginRow {
  category: string;
  revenue_cents: number;
  cost_cents: number;
  profit_cents: number;
  margin_percent: number;
  units_sold: number;
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
  daily_revenue: DailyRevenueRow[];
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
  dead_stock_summary: {
    count_30d: number;
    value_30d: number;
    count_60d: number;
    value_60d: number;
    count_90d: number;
    value_90d: number;
  };
  fast_movers: FastMoverRow[];
  avg_days_to_sell: Record<string, number | null>;
  margin_analysis: MarginRow[];
  trade_in_roi: {
    total_cost_cents: number;
    total_items_received: number;
    estimated_revenue_cents: number;
    outstanding_value_cents: number;
    roi_percent: number;
  };
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
  food_drink: 'Cafe / Food',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  tcg_single: 'bg-violet-500',
  sealed: 'bg-blue-500',
  board_game: 'bg-emerald-500',
  miniature: 'bg-amber-500',
  accessory: 'bg-rose-500',
  food_drink: 'bg-cyan-500',
  other: 'bg-zinc-500',
};

function catLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-zinc-500';
}

function trendArrow(change: number) {
  if (change > 0) return '\u2191';
  if (change < 0) return '\u2193';
  return '\u2192';
}

function trendColor(change: number, positiveIsGood = true) {
  if (change === 0) return 'text-zinc-400';
  const isPositive = change > 0;
  return (isPositive === positiveIsGood) ? 'text-green-400' : 'text-red-400';
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ---------- sub-components ---------- */

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'yellow' | 'default' | 'indigo';
  icon?: string;
}) {
  const accentBorder = {
    green: 'border-green-500/20',
    red: 'border-red-500/20',
    yellow: 'border-yellow-500/20',
    indigo: 'border-indigo-500/20',
    default: 'border-zinc-800',
  };
  const accentText = {
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    indigo: 'text-indigo-400',
    default: 'text-white',
  };
  const accentGlow = {
    green: 'shadow-green-500/5',
    red: 'shadow-red-500/5',
    yellow: 'shadow-yellow-500/5',
    indigo: 'shadow-indigo-500/5',
    default: '',
  };
  return (
    <div className={`rounded-xl border ${accentBorder[accent ?? 'default']} bg-zinc-900/80 p-5 shadow-lg ${accentGlow[accent ?? 'default']} backdrop-blur-sm transition-all hover:border-zinc-700`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${accentText[accent ?? 'default']}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white">{children}</h2>
      {sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

/* ---------- Revenue Chart ---------- */

function RevenueChart({ data, onHover }: { data: DailyRevenueRow[]; onHover?: (day: DailyRevenueRow | null) => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => Math.max(d.revenue_cents, d.payout_cents)), 1);
  const chartHeight = 200;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Revenue Flow</h3>
          <p className="text-xs text-zinc-500">Last 30 days — daily revenue vs payouts</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
            <span className="text-zinc-400">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-rose-500/60" />
            <span className="text-zinc-400">Payouts</span>
          </div>
        </div>
      </div>

      {/* Hovered day tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="mb-3 rounded-lg bg-zinc-800/80 px-3 py-2 text-xs">
          <span className="font-medium text-white">{formatDayLabel(data[hoveredIdx].date)}</span>
          <span className="mx-2 text-zinc-600">|</span>
          <span className="text-indigo-400">Revenue: {formatCents(data[hoveredIdx].revenue_cents)}</span>
          <span className="mx-2 text-zinc-600">|</span>
          <span className="text-rose-400">Payouts: {formatCents(data[hoveredIdx].payout_cents)}</span>
          <span className="mx-2 text-zinc-600">|</span>
          <span className={data[hoveredIdx].net_cents >= 0 ? 'text-green-400' : 'text-red-400'}>
            Net: {formatCents(data[hoveredIdx].net_cents)}
          </span>
        </div>
      )}

      <div ref={containerRef} className="relative flex items-end gap-0.5" style={{ height: chartHeight }}>
        {data.map((day, i) => {
          const revenueH = (day.revenue_cents / maxRevenue) * (chartHeight - 20);
          const payoutH = (day.payout_cents / maxRevenue) * (chartHeight - 20);
          const isWeekend = day.day_of_week === 0 || day.day_of_week === 6;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={day.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: chartHeight }}
              onMouseEnter={() => {
                setHoveredIdx(i);
                onHover?.(day);
              }}
              onMouseLeave={() => {
                setHoveredIdx(null);
                onHover?.(null);
              }}
            >
              {/* Revenue bar */}
              <div className="relative flex w-full flex-col items-center justify-end" style={{ height: chartHeight - 20 }}>
                {/* Payout bar (overlaid, semi-transparent) */}
                {payoutH > 0 && (
                  <div
                    className={`absolute bottom-0 w-full rounded-t transition-all ${
                      isHovered ? 'bg-rose-500/80' : 'bg-rose-500/40'
                    }`}
                    style={{ height: Math.max(payoutH, 1) }}
                  />
                )}
                {/* Revenue bar */}
                <div
                  className={`relative w-full rounded-t transition-all ${
                    isHovered
                      ? 'bg-indigo-400'
                      : isWeekend
                        ? 'bg-indigo-600/60'
                        : 'bg-indigo-500/80'
                  }`}
                  style={{ height: Math.max(revenueH, 1) }}
                />
              </div>
              {/* Date label — show every 5th day */}
              {i % 5 === 0 && (
                <span className="mt-1 text-[9px] text-zinc-600 tabular-nums">
                  {formatShortDate(day.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Category Bar ---------- */

function CategoryBars({ categories, totalCost }: { categories: CategoryRow[]; totalCost: number }) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const pct = totalCost > 0 ? (cat.cost_basis_cents / totalCost) * 100 : 0;
        return (
          <div key={cat.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-200">{catLabel(cat.category)}</span>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 tabular-nums">{cat.item_count} SKUs</span>
                <span className="font-medium text-white tabular-nums">{formatCents(cat.cost_basis_cents)}</span>
                <span className="w-12 text-right text-xs text-zinc-400 tabular-nums">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${catColor(cat.category)}`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
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
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-zinc-400">Loading cash flow intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-400">
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

  const totalDeadStockValue = data.dead_stock.reduce((s, d) => s + d.cost_trapped_cents, 0);

  return (
    <div className="space-y-8 pb-12">
      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hidden md:block text-2xl font-bold tracking-tight text-white">Cash Flow Intelligence</h1>
          <p className="mt-1 text-sm text-zinc-500">Where your money is, where it&apos;s going, and where it&apos;s stuck.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-zinc-800/80 p-1 shadow-inner">
          {(['today', 'this_week', 'this_month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                period === p
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
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
          label="Capital in Inventory"
          value={formatCents(data.inventory.cost_basis_cents)}
          sub={`${data.inventory.total_skus} SKUs across ${data.category_breakdown.length} categories`}
          icon="$"
          accent="indigo"
        />
        <StatCard
          label={`${periodLabels[period]} Revenue`}
          value={formatCents(agg.gross_revenue_cents)}
          sub={`Sales ${formatCents(agg.sales_revenue_cents)} + Events ${formatCents(agg.event_fees_cents)}`}
          icon="+"
          accent="green"
        />
        <StatCard
          label={`${periodLabels[period]} Payouts`}
          value={formatCents(agg.total_payouts_cents)}
          sub={`Trade-ins ${formatCents(agg.trade_in_payouts_cents)} + Refunds ${formatCents(agg.refunds_cents)}`}
          icon="-"
          accent="red"
        />
        <StatCard
          label={`${periodLabels[period]} Net Cash Flow`}
          value={formatCents(agg.net_cash_flow_cents)}
          sub={agg.net_cash_flow_cents >= 0 ? 'Cash positive' : 'More going out than in'}
          icon="="
          accent={agg.net_cash_flow_cents >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* ---- MONTH TREND ---- */}
      {data.month_trend.revenue_change_percent !== null && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-5 py-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-zinc-500 font-medium">Month-over-month</span>
            <span className={trendColor(data.month_trend.revenue_change_cents)}>
              {trendArrow(data.month_trend.revenue_change_cents)} Revenue{' '}
              {data.month_trend.revenue_change_percent > 0 ? '+' : ''}
              {data.month_trend.revenue_change_percent}%
              <span className="ml-1 text-xs opacity-70">({formatCents(Math.abs(data.month_trend.revenue_change_cents))})</span>
            </span>
            <span className={trendColor(data.month_trend.payout_change_cents, false)}>
              {trendArrow(data.month_trend.payout_change_cents)} Payouts{' '}
              <span className="text-xs opacity-70">{formatCents(Math.abs(data.month_trend.payout_change_cents))}</span>
            </span>
          </div>
        </div>
      )}

      {/* ---- REVENUE CHART ---- */}
      <RevenueChart data={data.daily_revenue} />

      {/* ---- INVENTORY BY CATEGORY + VELOCITY ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Inventory by Category */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
          <SectionHeader sub="Where your capital is tied up">Inventory by Category</SectionHeader>
          <div className="mt-5">
            <CategoryBars categories={data.category_breakdown} totalCost={data.inventory.cost_basis_cents} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4 text-sm">
            <span className="text-zinc-400">Total cost basis</span>
            <span className="font-semibold text-white tabular-nums">{formatCents(data.inventory.cost_basis_cents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Total retail value</span>
            <span className="text-zinc-300 tabular-nums">{formatCents(data.inventory.retail_value_cents)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Potential margin</span>
            <span className="text-green-400 tabular-nums">{formatCents(data.inventory.potential_margin_cents)}</span>
          </div>
        </div>

        {/* Right: Velocity */}
        <div className="space-y-6">
          {/* Fast Movers */}
          <div className="rounded-xl border border-green-500/10 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
            <SectionHeader sub="Top sellers in the last 30 days">Fast Movers</SectionHeader>
            {data.fast_movers.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No sales data yet for velocity analysis.</p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {data.fast_movers.slice(0, 5).map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10 text-xs font-bold text-green-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">{item.name}</p>
                      <p className="text-xs text-zinc-500">{catLabel(item.category)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-400 tabular-nums">{item.sales_per_week}/wk</p>
                      <p className="text-xs text-zinc-500 tabular-nums">
                        {item.current_stock} left
                        {item.days_of_stock !== null && item.days_of_stock <= 14 && (
                          <span className="ml-1 text-yellow-400">({item.days_of_stock}d)</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dead Stock */}
          <div className="rounded-xl border border-yellow-500/10 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
            <SectionHeader sub="Items with no sales in 30+ days">Dead Stock</SectionHeader>
            {data.dead_stock.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No dead stock detected. Everything is moving.</p>
            ) : (
              <>
                <div className="mt-3 mb-4 flex gap-3 text-xs">
                  <div className="rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-yellow-400">
                    {data.dead_stock_summary.count_30d} items / {formatCents(data.dead_stock_summary.value_30d)} stuck 30d+
                  </div>
                  {data.dead_stock_summary.count_90d > 0 && (
                    <div className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-red-400">
                      {data.dead_stock_summary.count_90d} items / {formatCents(data.dead_stock_summary.value_90d)} stuck 90d+
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  {data.dead_stock.slice(0, 5).map((item, i) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/10 text-xs font-bold text-yellow-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{item.name}</p>
                        <p className="text-xs text-zinc-500">
                          {catLabel(item.category)} &middot; qty {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-yellow-400 tabular-nums">{formatCents(item.cost_trapped_cents)}</p>
                        <p className="text-xs text-zinc-500 tabular-nums">
                          {item.days_since_sale !== null
                            ? `${item.days_since_sale}d ago`
                            : 'Never sold'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {totalDeadStockValue > 0 && (
                  <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">
                    Top {data.dead_stock.length} dead items = {formatCents(totalDeadStockValue)} trapped capital.
                    Consider markdowns to free this cash.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- MARGIN ANALYSIS ---- */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
        <SectionHeader sub="Actual margins from the last 30 days of sales">Margin Analysis by Category</SectionHeader>
        {data.margin_analysis.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No sales data yet for margin analysis.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Units Sold</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Profit</th>
                  <th className="px-4 py-3 font-medium text-right">Margin</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Days to Sell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.margin_analysis.map((row) => (
                  <tr key={row.category} className="text-white transition-colors hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${catColor(row.category)}`} />
                        <span className="font-medium">{catLabel(row.category)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{row.units_sold}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCents(row.revenue_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{formatCents(row.cost_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-400">{formatCents(row.profit_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        row.margin_percent >= 40 ? 'bg-green-500/10 text-green-400' :
                        row.margin_percent >= 20 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {row.margin_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                      {data.avg_days_to_sell[row.category] !== null && data.avg_days_to_sell[row.category] !== undefined
                        ? `${data.avg_days_to_sell[row.category]}d`
                        : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- TRADE-IN ROI + WHERE YOUR MONEY IS ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trade-In ROI */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
          <SectionHeader sub="All-time trade-in performance">Trade-In ROI</SectionHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Spent on trade-ins</span>
              <span className="text-sm font-medium text-red-400 tabular-nums">{formatCents(data.trade_in_roi.total_cost_cents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Sold from trade-ins</span>
              <span className="text-sm font-medium text-green-400 tabular-nums">{formatCents(data.trade_in_roi.estimated_revenue_cents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Outstanding inventory</span>
              <span className="text-sm font-medium text-yellow-400 tabular-nums">{formatCents(data.trade_in_roi.outstanding_value_cents)}</span>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">ROI</span>
                <span className={`text-lg font-bold tabular-nums ${
                  data.trade_in_roi.roi_percent >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {data.trade_in_roi.roi_percent > 0 ? '+' : ''}{data.trade_in_roi.roi_percent}%
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {data.trade_in_roi.total_items_received} items received all-time
              </p>
            </div>
          </div>
        </div>

        {/* Trade-Ins This Month */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
          <SectionHeader sub="Incoming inventory via trade-ins">Trade-Ins This Month</SectionHeader>
          <div className="mt-4 space-y-2.5 text-sm">
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
              <span className="text-zinc-300 tabular-nums">
                {data.trade_ins.cash_payouts} / {data.trade_ins.credit_payouts}
              </span>
            </div>
          </div>
        </div>

        {/* Returns This Month */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm">
          <SectionHeader sub="Refunds and restocking">Returns This Month</SectionHeader>
          <div className="mt-4 space-y-2.5 text-sm">
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
              <span className="text-green-400 tabular-nums">{formatCents(data.returns.restocking_fees_collected_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Cash / Credit</span>
              <span className="text-zinc-300 tabular-nums">
                {data.returns.cash_refunds} / {data.returns.credit_refunds}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- LIABILITIES ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding Store Credit"
          value={formatCents(data.outstanding_credit.total_cents)}
          sub={`${data.outstanding_credit.customer_count} customers with balances`}
          accent="yellow"
        />
        <StatCard
          label="Potential Margin (if all sold)"
          value={formatCents(data.inventory.potential_margin_cents)}
          sub={`Retail ${formatCents(data.inventory.retail_value_cents)} - Cost ${formatCents(data.inventory.cost_basis_cents)}`}
          accent="green"
        />
        <StatCard
          label="Out of Stock Items"
          value={`${data.inventory.zero_stock_count}`}
          sub={`of ${data.inventory.total_skus} total SKUs need reordering`}
          accent={data.inventory.zero_stock_count > 0 ? 'red' : 'default'}
        />
      </div>

      {/* ---- AI INSIGHTS ---- */}
      <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-6 shadow-lg">
        <h3 className="font-semibold text-indigo-300">AI Insights</h3>
        <div className="mt-3 space-y-2 text-sm text-zinc-400">
          {data.dead_stock.length > 0 && totalDeadStockValue > 0 && (
            <p>
              You have {formatCents(totalDeadStockValue)} trapped in dead stock.
              A 15% markdown could free up to {formatCents(Math.round(totalDeadStockValue * 0.85))} in cash.
            </p>
          )}
          {data.fast_movers.length > 0 && data.fast_movers[0].days_of_stock !== null && data.fast_movers[0].days_of_stock <= 7 && (
            <p>
              Your top seller &quot;{data.fast_movers[0].name}&quot; has only {data.fast_movers[0].days_of_stock} days
              of stock left at current velocity. Reorder now to avoid stockout.
            </p>
          )}
          {data.outstanding_credit.total_cents > 0 && (
            <p>
              {formatCents(data.outstanding_credit.total_cents)} in outstanding store credit is a liability.
              Consider loyalty promotions to convert credit balances into sales.
            </p>
          )}
          <p className="text-zinc-500 italic">
            More AI-powered recommendations coming soon based on your cash flow patterns.
          </p>
        </div>
      </div>
    </div>
  );
}
