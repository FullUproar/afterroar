'use client';

import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/lib/store-context';
import { formatCents } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { IntelligenceFeed } from '@/components/intelligence-feed';

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

/**
 * Category color tokens — operator-console palette.
 * Stays consistent with brand discipline: orange for primary, teal for healthy
 * categories, yellow for noteworthy, plus muted MTG color identities for the rest.
 */
const CATEGORY_COLORS: Record<string, string> = {
  tcg_single: 'bg-orange',
  sealed: 'bg-teal',
  board_game: 'bg-yellow',
  miniature: 'bg-[var(--m-r)]',
  accessory: 'bg-[var(--m-b)]',
  food_drink: 'bg-[var(--m-u)]',
  other: 'bg-ink-faint',
};

type Period = 'today' | 'this_week' | 'this_month' | 'all_time';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  all_time: 'All Time',
};

function catLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-ink-faint';
}

function trendArrow(change: number) {
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '→';
}

function trendColor(change: number, positiveIsGood = true) {
  if (change === 0) return 'text-ink-soft';
  const isPositive = change > 0;
  return (isPositive === positiveIsGood) ? 'text-teal' : 'text-red-fu';
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ---------- KPI Cell (operator console) ---------- */

function KpiCell({
  k,
  v,
  sub,
  primary,
  accent,
}: {
  k: string;
  v: string;
  sub?: string;
  primary?: boolean;
  accent?: 'teal' | 'red' | 'yellow';
}) {
  const accentClass =
    accent === 'teal'
      ? 'text-teal'
      : accent === 'red'
        ? 'text-red-fu'
        : accent === 'yellow'
          ? 'text-yellow'
          : primary
            ? 'text-orange'
            : 'text-ink';
  return (
    <div className="bg-panel-mute p-3 md:p-4 min-h-22 flex flex-col justify-between">
      <div
        className="font-mono uppercase text-ink-faint font-semibold"
        style={{ fontSize: '0.6rem', letterSpacing: '0.24em' }}
      >
        {k}
      </div>
      <div>
        <div
          className={`font-display font-bold leading-none mt-2 ${accentClass}`}
          style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', letterSpacing: '-0.01em' }}
        >
          {v}
        </div>
        {sub ? (
          <div
            className="font-mono text-ink-faint mt-1.5"
            style={{ fontSize: '0.62rem', letterSpacing: '0.04em' }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Collapsible Section (operator zone style) ---------- */

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="ar-zone">
      <button
        onClick={() => setOpen((v) => !v)}
        className="ar-zone-head flex w-full items-center justify-between hover:bg-panel transition-colors"
        type="button"
        style={{ minHeight: 48 }}
      >
        <div className="flex flex-col gap-0.5 text-left">
          <span className="font-mono uppercase font-semibold text-ink-soft" style={{ fontSize: '0.62rem', letterSpacing: '0.28em' }}>
            {title}
          </span>
          {subtitle && (
            <span className="font-mono text-ink-faint normal-case" style={{ fontSize: '0.62rem', letterSpacing: '0.04em' }}>
              {subtitle}
            </span>
          )}
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-4 bg-panel-mute">{children}</div>}
    </div>
  );
}

/* ---------- Stat Row ---------- */

function StatRow({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: 'teal' | 'red' | 'yellow' | 'muted';
  sub?: string;
}) {
  const colorMap = {
    teal: 'text-teal',
    red: 'text-red-fu',
    yellow: 'text-yellow',
    muted: 'text-ink-soft',
  };
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium tabular-nums ${colorMap[accent ?? 'muted'] || 'text-ink'}`}>
          {value}
        </span>
        {sub && <span className="ml-2 text-xs text-ink-faint font-mono">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------- Revenue Chart ---------- */

function RevenueChart({ data }: { data: DailyRevenueRow[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) return null;

  const maxRevenue = Math.max(...data.map(d => Math.max(d.revenue_cents, d.payout_cents)), 1);
  const chartHeight = 200;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-ink">Revenue Flow</h3>
          <p className="text-xs text-ink-soft font-mono">Last 30 days · daily revenue vs payouts</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-orange" />
            <span className="text-ink-soft uppercase tracking-wider" style={{ fontSize: '0.62rem' }}>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 bg-red-fu opacity-70" />
            <span className="text-ink-soft uppercase tracking-wider" style={{ fontSize: '0.62rem' }}>Payouts</span>
          </div>
        </div>
      </div>

      {/* Hovered day tooltip */}
      <div className="h-8 mb-3">
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="bg-panel-hi border border-rule px-3 py-2 text-xs font-mono">
            <span className="font-medium text-ink">{formatDayLabel(data[hoveredIdx].date)}</span>
            <span className="mx-2 text-ink-ghost">|</span>
            <span className="text-orange">Revenue: {formatCents(data[hoveredIdx].revenue_cents)}</span>
            <span className="mx-2 text-ink-ghost">|</span>
            <span className="text-red-fu">Payouts: {formatCents(data[hoveredIdx].payout_cents)}</span>
            <span className="mx-2 text-ink-ghost">|</span>
            <span className={data[hoveredIdx].net_cents >= 0 ? 'text-teal' : 'text-red-fu'}>
              Net: {formatCents(data[hoveredIdx].net_cents)}
            </span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="relative flex items-end gap-px" style={{ height: chartHeight }}>
        {data.map((day, i) => {
          const barArea = chartHeight - 24;
          const revenueH = (day.revenue_cents / maxRevenue) * barArea;
          const payoutH = (day.payout_cents / maxRevenue) * barArea;
          const isWeekend = day.day_of_week === 0 || day.day_of_week === 6;
          const isHovered = hoveredIdx === i;

          const dayDate = new Date(day.date + 'T12:00:00Z');
          const isMonday = dayDate.getUTCDay() === 1;
          const showLabel = isMonday || i === 0 || i === data.length - 1;

          return (
            <div
              key={day.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: chartHeight }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex w-full items-end justify-center gap-px" style={{ height: barArea }}>
                <div
                  className={`flex-1 transition-all ${
                    isHovered
                      ? 'bg-orange'
                      : isWeekend
                        ? 'bg-orange opacity-60'
                        : 'bg-orange opacity-85'
                  }`}
                  style={{ height: Math.max(revenueH, 1) }}
                />
                <div
                  className={`flex-1 transition-all ${
                    isHovered ? 'bg-red-fu' : 'bg-red-fu opacity-60'
                  }`}
                  style={{ height: Math.max(payoutH, 1) }}
                />
              </div>
              <div className="h-4 flex items-center justify-center">
                {showLabel && (
                  <span className="text-[9px] text-ink-faint font-mono tabular-nums whitespace-nowrap">
                    {formatShortDate(day.date)}
                  </span>
                )}
              </div>
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
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-ink truncate">{catLabel(cat.category)}</span>
                <span
                  className="shrink-0 text-[10px] text-ink-faint cursor-default"
                  title={`${cat.item_count.toLocaleString()} SKUs -- ${formatCents(cat.cost_basis_cents)} at cost`}
                >
                  {"ⓘ"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-medium text-ink tabular-nums">{formatCents(cat.cost_basis_cents)}</span>
                <span className="w-10 text-right text-xs font-mono text-ink-soft tabular-nums">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden bg-panel-hi border border-rule-faint">
              <div
                className={`h-full transition-all ${catColor(cat.category)}`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Cash Flow AI Recommendations ---------- */

function CashFlowInsights({ data, totalDeadStockValue }: { data: CashFlowData; totalDeadStockValue: number }) {
  const recommendations: Array<{ icon: string; text: string; tone: 'warn' | 'err' | 'info' | 'ok' }> = [];

  if (data.dead_stock.length > 0 && totalDeadStockValue > 0) {
    recommendations.push({
      icon: '\u{1F4E6}',
      text: `You have ${formatCents(totalDeadStockValue)} trapped in ${data.dead_stock.length} slow-moving items. A 15-20% markdown or a "clearance bin" promotion could free up to ${formatCents(Math.round(totalDeadStockValue * 0.85))} in cash to reinvest in what actually sells.`,
      tone: 'warn',
    });
  }

  const urgentMovers = data.fast_movers.filter(m => m.days_of_stock !== null && m.days_of_stock <= 14);
  if (urgentMovers.length > 0) {
    const top = urgentMovers[0];
    recommendations.push({
      icon: '\u{1F6A8}',
      text: `Your top seller "${top.name}" has only ${top.days_of_stock} days of stock left at current velocity (${top.sales_per_week}/week). Reorder now to avoid losing sales.${urgentMovers.length > 1 ? ` ${urgentMovers.length - 1} more fast-movers are also running low.` : ''}`,
      tone: 'err',
    });
  }

  if (data.outstanding_credit.total_cents > 0) {
    recommendations.push({
      icon: '\u{1F4B0}',
      text: `${formatCents(data.outstanding_credit.total_cents)} in store credit across ${data.outstanding_credit.customer_count} customers is a liability on your books. Run a "use your credit" event or bonus weekend to convert these into sales.`,
      tone: 'warn',
    });
  }

  if (data.margin_analysis.length >= 2) {
    const sorted = [...data.margin_analysis].sort((a, b) => a.margin_percent - b.margin_percent);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    if (lowest.margin_percent < 30 && lowest.revenue_cents > 0) {
      recommendations.push({
        icon: '\u{1F4CA}',
        text: `Your ${catLabel(lowest.category)} margin is only ${lowest.margin_percent}%, while ${catLabel(highest.category)} earns ${highest.margin_percent}%. Consider adjusting pricing or shifting inventory dollars toward higher-margin categories.`,
        tone: 'info',
      });
    }
  }

  if (data.category_breakdown.length > 0) {
    const topCat = data.category_breakdown[0];
    const topCatPct = data.inventory.cost_basis_cents > 0
      ? Math.round((topCat.cost_basis_cents / data.inventory.cost_basis_cents) * 100)
      : 0;
    const topCatSales = data.margin_analysis.find(m => m.category === topCat.category);
    const totalSalesRev = data.margin_analysis.reduce((s, m) => s + m.revenue_cents, 0);
    const topCatSalesPct = topCatSales && totalSalesRev > 0
      ? Math.round((topCatSales.revenue_cents / totalSalesRev) * 100)
      : 0;

    if (topCatPct > 0 && topCatSalesPct > 0 && topCatPct > topCatSalesPct + 15) {
      recommendations.push({
        icon: '\u{1F4B5}',
        text: `${catLabel(topCat.category)} holds ${topCatPct}% of your inventory capital but only generates ${topCatSalesPct}% of revenue. Your money might work harder in a different category.`,
        tone: 'info',
      });
    }
  }

  if (data.trade_in_roi.total_cost_cents > 0) {
    if (data.trade_in_roi.roi_percent > 50) {
      recommendations.push({
        icon: '\u{1F3C6}',
        text: `Your trade-in program is generating ${data.trade_in_roi.roi_percent}% ROI. Trade-ins are one of the best ways to acquire inventory cheaply. Keep pushing credit-based payouts for even better margins.`,
        tone: 'ok',
      });
    } else if (data.trade_in_roi.roi_percent < 0) {
      recommendations.push({
        icon: '⚠️',
        text: `Your trade-in program is currently at ${data.trade_in_roi.roi_percent}% ROI. Review your offer prices -- you may be paying too much for items that aren't selling through.`,
        tone: 'err',
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      icon: '✨',
      text: 'Your cash flow looks healthy. Keep monitoring velocity and margins to stay ahead.',
      tone: 'ok',
    });
  }

  /**
   * Border accent uses operator-console palette: orange = info/insight,
   * yellow = warn-positive (action needed), red = error, teal = healthy.
   */
  function toneBorder(tone: 'warn' | 'err' | 'info' | 'ok'): string {
    return tone === 'warn'
      ? 'border-l-yellow'
      : tone === 'err'
        ? 'border-l-red-fu'
        : tone === 'info'
          ? 'border-l-orange'
          : 'border-l-teal';
  }

  return (
    <div className="space-y-4">
      {/* Sentence-based recommendations */}
      <div className="ar-zone">
        <div className="ar-zone-head">
          <span>Smart Recommendations</span>
          <span className="font-mono text-ink-faint normal-case" style={{ fontSize: '0.62rem', letterSpacing: '0.18em' }}>
            {recommendations.length} {recommendations.length === 1 ? 'tip' : 'tips'}
          </span>
        </div>
        <div className="p-4 bg-panel-mute space-y-3">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className={`border border-rule border-l-4 ${toneBorder(rec.tone)} bg-slate p-4`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg shrink-0" aria-hidden="true">{rec.icon}</span>
                <p className="text-sm text-ink leading-relaxed">{rec.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Intelligence Feed */}
      <div className="ar-zone">
        <div className="ar-zone-head">
          <span>Store Intelligence</span>
          <span className="font-mono text-ink-faint normal-case" style={{ fontSize: '0.62rem', letterSpacing: '0.18em' }}>
            All actionable insights
          </span>
        </div>
        <div className="p-4 bg-panel-mute">
          <IntelligenceFeed />
        </div>
      </div>
    </div>
  );
}

/* ---------- main component ---------- */

export default function CashFlowPage() {
  const { can } = useStore();
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('this_week');

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
        <p className="text-ink-soft">You don&apos;t have permission to view cash flow data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-orange border-t-transparent" />
          <p className="text-ink-soft font-mono uppercase tracking-wider" style={{ fontSize: '0.7rem' }}>
            Loading store intelligence...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-red-fu/40 bg-[var(--red-mute)] p-6 text-red-fu">
        {error || 'Failed to load data'}
      </div>
    );
  }

  const agg = data[period];
  const totalDeadStockValue = data.dead_stock.reduce((s, d) => s + d.cost_trapped_cents, 0);

  return (
    <div className="flex flex-col h-full gap-4 pb-12">
      {/* ---- HEADER + PERIOD SELECTOR ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Store Intelligence"
          crumb="Console · Cash Flow"
          desc="Cash flow, inventory health, and actionable insights."
        />
        <div
          className="flex shrink-0 self-start"
          style={{ border: '1px solid var(--rule)', background: 'var(--panel-mute)' }}
          role="tablist"
          aria-label="Period"
        >
          {(['today', 'this_week', 'this_month', 'all_time'] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                role="tab"
                aria-selected={active}
                className="font-mono uppercase font-semibold transition-colors"
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.22em',
                  padding: '0.7rem 0.9rem',
                  minHeight: 44,
                  color: active ? 'var(--orange)' : 'var(--ink-soft)',
                  background: active ? 'var(--orange-mute)' : 'transparent',
                  borderRight: '1px solid var(--rule)',
                  borderBottom: active ? '2px solid var(--orange)' : '2px solid transparent',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==== KPI STRIP — period summary at-a-glance ==== */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-rule border border-rule">
        <KpiCell
          k="Revenue"
          v={formatCents(agg.gross_revenue_cents)}
          primary
          sub={agg.event_fees_cents > 0 ? `events ${formatCents(agg.event_fees_cents)}` : undefined}
        />
        <KpiCell
          k="Payouts"
          v={`-${formatCents(agg.total_payouts_cents)}`}
          accent="red"
          sub={agg.refunds_cents > 0 ? `refunds ${formatCents(agg.refunds_cents)}` : undefined}
        />
        <KpiCell
          k="Net Cash Flow"
          v={formatCents(agg.net_cash_flow_cents)}
          accent={agg.net_cash_flow_cents >= 0 ? 'teal' : 'red'}
        />
        <KpiCell
          k="Credit Issued"
          v={formatCents(agg.credit_issued_cents)}
          accent="yellow"
          sub={`${formatCents(agg.credit_redeemed_cents)} redeemed`}
        />
        <KpiCell
          k="Inventory Capital"
          v={formatCents(data.inventory.cost_basis_cents)}
          sub={`${data.inventory.total_skus} SKUs`}
        />
      </section>

      {/* Month-trend strip */}
      {data.month_trend.revenue_change_percent !== null && (
        <div
          className="border border-rule bg-panel-mute px-4 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-mono">
            <span
              className="text-ink-soft uppercase font-semibold"
              style={{ fontSize: '0.62rem', letterSpacing: '0.22em' }}
            >
              Month-over-month
            </span>
            <span className={trendColor(data.month_trend.revenue_change_cents)}>
              {trendArrow(data.month_trend.revenue_change_cents)} Revenue{' '}
              {data.month_trend.revenue_change_percent > 0 ? '+' : ''}
              {data.month_trend.revenue_change_percent}%
              <span className="ml-1 text-xs text-ink-faint">
                ({formatCents(Math.abs(data.month_trend.revenue_change_cents))})
              </span>
            </span>
            <span className={trendColor(data.month_trend.payout_change_cents, false)}>
              {trendArrow(data.month_trend.payout_change_cents)} Payouts{' '}
              <span className="text-xs text-ink-faint">{formatCents(Math.abs(data.month_trend.payout_change_cents))}</span>
            </span>
          </div>
        </div>
      )}

      {/* ==== SECTION 1: REVENUE BREAKDOWN (collapsible, default open) ==== */}
      <CollapsibleSection
        title="Revenue Breakdown"
        subtitle="Revenue chart and margin analysis"
        defaultOpen
      >
        {/* Revenue Flow Chart */}
        <RevenueChart data={data.daily_revenue} />

        {/* Margin Analysis Table */}
        {data.margin_analysis.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-display font-semibold text-ink">Margin Analysis by Category</h3>
            <div className="overflow-x-auto scroll-visible border border-rule">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr
                    className="font-mono uppercase text-ink-faint"
                    style={{ fontSize: '0.6rem', letterSpacing: '0.22em' }}
                  >
                    <th className="px-3 py-2.5 font-semibold border-b border-rule">Category</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Units</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Revenue</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Cost</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Profit</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Margin</th>
                    <th className="px-3 py-2.5 font-semibold text-right border-b border-rule">Avg Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.margin_analysis.map((row) => (
                    <tr
                      key={row.category}
                      className="ar-lstripe text-ink hover:bg-panel transition-colors"
                      style={{ borderBottom: '1px solid var(--rule-faint)' }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 ${catColor(row.category)}`} />
                          <span className="font-medium">{catLabel(row.category)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-soft">{row.units_sold}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCents(row.revenue_cents)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-soft">{formatCents(row.cost_cents)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-teal">{formatCents(row.profit_cents)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold ${
                            row.margin_percent >= 40
                              ? 'bg-[var(--teal-mute)] text-teal border border-teal/30'
                              : row.margin_percent >= 20
                                ? 'bg-[var(--yellow-mute)] text-yellow border border-yellow/30'
                                : 'bg-[var(--red-mute)] text-red-fu border border-red-fu/30'
                          }`}
                        >
                          {row.margin_percent}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-ink-faint">
                        {data.avg_days_to_sell[row.category] !== null && data.avg_days_to_sell[row.category] !== undefined
                          ? `${data.avg_days_to_sell[row.category]}d`
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ==== SECTION 2: INVENTORY CAPITAL (collapsible) ==== */}
      <CollapsibleSection
        title="Inventory Capital"
        subtitle={`${formatCents(data.inventory.cost_basis_cents)} locked across ${data.inventory.total_skus} SKUs`}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Category breakdown with bars */}
          <div>
            <h3 className="mb-3 text-sm font-display font-semibold text-ink">By Category</h3>
            <CategoryBars categories={data.category_breakdown} totalCost={data.inventory.cost_basis_cents} />
            <div className="mt-4 space-y-0.5 border-t border-rule pt-3">
              <StatRow label="Total cost basis" value={formatCents(data.inventory.cost_basis_cents)} />
              <StatRow label="Total retail value" value={formatCents(data.inventory.retail_value_cents)} />
              <StatRow label="Potential margin" value={formatCents(data.inventory.potential_margin_cents)} accent="teal" />
              <StatRow
                label="Out of stock"
                value={`${data.inventory.zero_stock_count}`}
                accent={data.inventory.zero_stock_count > 0 ? 'red' : 'muted'}
                sub={`of ${data.inventory.total_skus} SKUs`}
              />
            </div>
          </div>

          {/* Right: Dead stock + fast movers */}
          <div className="space-y-5">
            {/* Dead Stock */}
            <div>
              <h3 className="mb-2 text-sm font-display font-semibold text-ink">Dead Stock</h3>
              {data.dead_stock.length === 0 ? (
                <p className="text-sm text-ink-soft">No dead stock detected. Everything is moving.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs font-mono">
                    <div className="bg-[var(--yellow-mute)] border border-yellow/30 px-2.5 py-1.5 text-yellow">
                      {data.dead_stock_summary.count_30d} items / {formatCents(data.dead_stock_summary.value_30d)} stuck 30d+
                    </div>
                    {data.dead_stock_summary.count_90d > 0 && (
                      <div className="bg-[var(--red-mute)] border border-red-fu/30 px-2.5 py-1.5 text-red-fu">
                        {data.dead_stock_summary.count_90d} items / {formatCents(data.dead_stock_summary.value_90d)} stuck 90d+
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {data.dead_stock.slice(0, 5).map((item, i) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 items-center justify-center bg-[var(--yellow-mute)] border border-yellow/30 font-mono text-xs font-bold text-yellow"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                          <p className="text-xs text-ink-soft font-mono">
                            {catLabel(item.category)} &middot; qty {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-medium text-yellow tabular-nums">{formatCents(item.cost_trapped_cents)}</p>
                          <p className="text-xs text-ink-faint font-mono tabular-nums">
                            {item.days_since_sale !== null
                              ? `${item.days_since_sale}d ago`
                              : 'Never sold'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalDeadStockValue > 0 && (
                    <div className="mt-3 border border-yellow/30 bg-[var(--yellow-mute)] px-3 py-2 text-xs text-yellow">
                      Top {data.dead_stock.length} dead items = {formatCents(totalDeadStockValue)} trapped capital.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fast Movers */}
            <div>
              <h3 className="mb-2 text-sm font-display font-semibold text-ink">Fast Movers</h3>
              {data.fast_movers.length === 0 ? (
                <p className="text-sm text-ink-soft">No sales data yet for velocity analysis.</p>
              ) : (
                <div className="space-y-2">
                  {data.fast_movers.slice(0, 5).map((item, i) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center bg-[var(--teal-mute)] border border-teal/30 font-mono text-xs font-bold text-teal"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-ink-soft font-mono">{catLabel(item.category)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-medium text-teal tabular-nums">{item.sales_per_week}/wk</p>
                        <p className="text-xs text-ink-faint font-mono tabular-nums">
                          {item.current_stock} left
                          {item.days_of_stock !== null && item.days_of_stock <= 14 && (
                            <span className="ml-1 text-yellow">({item.days_of_stock}d)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ==== SECTION 3: CUSTOMER HEALTH (collapsible) ==== */}
      <CollapsibleSection
        title="Customer Health"
        subtitle={`${data.total_customers} total customers`}
      >
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div>
            <StatRow label="Total Customers" value={data.total_customers.toLocaleString()} />
            <StatRow
              label="Outstanding Credit"
              value={formatCents(data.outstanding_credit.total_cents)}
              accent="yellow"
              sub={`${data.outstanding_credit.customer_count} customers`}
            />
          </div>
          <div>
            <StatRow label="Returns This Month" value={`${data.returns.count}`} />
            <StatRow
              label="Refunded"
              value={formatCents(data.returns.total_refunded_cents)}
              accent="red"
              sub={`Cash: ${data.returns.cash_refunds} / Credit: ${data.returns.credit_refunds}`}
            />
            {data.returns.restocking_fees_collected_cents > 0 && (
              <StatRow
                label="Restocking Fees"
                value={formatCents(data.returns.restocking_fees_collected_cents)}
                accent="teal"
              />
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ==== SECTION 4: TRADE-INS (collapsible) ==== */}
      <CollapsibleSection
        title="Trade-Ins"
        subtitle={`ROI: ${data.trade_in_roi.roi_percent > 0 ? '+' : ''}${data.trade_in_roi.roi_percent}% all-time`}
      >
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {/* All-time ROI */}
          <div>
            <h3 className="mb-2 text-sm font-display font-semibold text-ink">All-Time ROI</h3>
            <StatRow label="Spent on trade-ins" value={formatCents(data.trade_in_roi.total_cost_cents)} accent="red" />
            <StatRow label="Sold from trade-ins" value={formatCents(data.trade_in_roi.estimated_revenue_cents)} accent="teal" />
            <StatRow label="Outstanding inventory" value={formatCents(data.trade_in_roi.outstanding_value_cents)} accent="yellow" />
            <div className="border-t border-rule mt-1 pt-1">
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-sm font-medium text-ink-soft">ROI</span>
                <span
                  className={`font-display text-lg font-bold tabular-nums ${
                    data.trade_in_roi.roi_percent >= 0 ? 'text-teal' : 'text-red-fu'
                  }`}
                >
                  {data.trade_in_roi.roi_percent > 0 ? '+' : ''}{data.trade_in_roi.roi_percent}%
                </span>
              </div>
              <p className="text-xs text-ink-faint font-mono">{data.trade_in_roi.total_items_received} items received all-time</p>
            </div>
          </div>

          {/* This month */}
          <div>
            <h3 className="mb-2 text-sm font-display font-semibold text-ink">This Month</h3>
            <StatRow label="Count" value={`${data.trade_ins.count}`} />
            <StatRow label="Total Offer Value" value={formatCents(data.trade_ins.total_offer_cents)} />
            <StatRow label="Total Paid Out" value={formatCents(data.trade_ins.total_payout_cents)} accent="red" />
            <StatRow
              label="Cash / Credit"
              value={`${data.trade_ins.cash_payouts} / ${data.trade_ins.credit_payouts}`}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ==== AI RECOMMENDATIONS + INTELLIGENCE ==== */}
      <CashFlowInsights data={data} totalDeadStockValue={totalDeadStockValue} />
    </div>
  );
}
