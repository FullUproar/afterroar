"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { formatCents } from "@/lib/types";
import { StatCard, SectionHeader, EmptyState, MonoValue } from "@/components/shared/ui";

/* ------------------------------------------------------------------ */
/*  Sales tax remittance — period totals for state filing.            */
/*                                                                     */
/*  Most FLGS owners file monthly or quarterly. This page gives them   */
/*  one place to pull "tax collected in the period" totals for a       */
/*  given start/end window, with a CSV download for the state form.   */
/* ------------------------------------------------------------------ */

interface TaxDay {
  date: string;
  sales_count: number;
  taxable_subtotal_cents: number;
  exempt_subtotal_cents: number;
  tax_collected_cents: number;
}

interface TaxReport {
  store: string | null;
  period: { start: string; end: string };
  jurisdiction: {
    state: string | null;
    zip: string | null;
    defaultRate: number;
  };
  summary: {
    sales_count: number;
    taxable_subtotal_cents: number;
    exempt_subtotal_cents: number;
    tax_collected_cents: number;
    effective_rate_percent: number;
  };
  training_excluded: number;
  days: TaxDay[];
}

function isoToday(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isoMonthStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

function isoPrevMonthStart(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function isoPrevMonthEnd(): string {
  const d = new Date();
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

function isoQuarterStart(): string {
  const d = new Date();
  const q = Math.floor(d.getUTCMonth() / 3);
  d.setUTCFullYear(d.getUTCFullYear(), q * 3, 1);
  return d.toISOString().slice(0, 10);
}

type Preset = "month" | "last_month" | "quarter" | "custom";

export default function SalesTaxReportPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [start, setStart] = useState<string>(isoMonthStart());
  const [end, setEnd] = useState<string>(isoToday());
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((p: Preset) => {
    setPreset(p);
    if (p === "month") {
      setStart(isoMonthStart());
      setEnd(isoToday());
    } else if (p === "last_month") {
      setStart(isoPrevMonthStart());
      setEnd(isoPrevMonthEnd());
    } else if (p === "quarter") {
      setStart(isoQuarterStart());
      setEnd(isoToday());
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/tax-period?start=${start}&end=${end}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TaxReport;
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadCsv = () => {
    const url = `/api/reports/tax-period?start=${start}&end=${end}&format=csv`;
    window.location.href = url;
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Sales Tax"
        crumb="Console · Reports · Sales Tax"
        desc="Period totals for state sales-tax filing. Excludes training-mode transactions."
      />

      <div className="rounded-2xl border border-card-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(["month", "last_month", "quarter", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p
                  ? "bg-accent text-white"
                  : "bg-card-hover text-muted hover:text-foreground"
              }`}
            >
              {p === "month"
                ? "This month"
                : p === "last_month"
                  ? "Last month"
                  : p === "quarter"
                    ? "This quarter"
                    : "Custom"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center ml-auto">
          <label className="text-xs text-muted">From</label>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => {
              setStart(e.target.value);
              setPreset("custom");
            }}
            className="rounded-xl border border-card-border bg-card-hover px-3 py-1.5 text-sm"
          />
          <label className="text-xs text-muted">To</label>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => {
              setEnd(e.target.value);
              setPreset("custom");
            }}
            className="rounded-xl border border-card-border bg-card-hover px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!report || report.summary.sales_count === 0}
            className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Tax collected"
              value={formatCents(report.summary.tax_collected_cents)}
              trend={`${report.summary.effective_rate_percent.toFixed(2)}% effective`}
            />
            <StatCard
              label="Taxable revenue"
              value={formatCents(report.summary.taxable_subtotal_cents)}
              trend={`${report.summary.sales_count} sales`}
            />
            <StatCard
              label="Exempt revenue"
              value={formatCents(report.summary.exempt_subtotal_cents)}
              trend="Tax-exempt + zero-rate"
            />
            <StatCard
              label="Filing jurisdiction"
              value={report.jurisdiction.state ?? "—"}
              trend={
                report.jurisdiction.defaultRate
                  ? `Rate: ${report.jurisdiction.defaultRate}%`
                  : "Stripe Tax"
              }
            />
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-4">
            <SectionHeader>Daily breakdown</SectionHeader>
            {report.days.length === 0 ? (
              <EmptyState
                icon="\u{1F4CA}"
                title="No sales in this period"
                description="Pick a wider window or run a test sale."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted">
                    <tr className="border-b border-card-border">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-right py-2 px-2">Sales</th>
                      <th className="text-right py-2 px-2">Taxable subtotal</th>
                      <th className="text-right py-2 px-2">Exempt subtotal</th>
                      <th className="text-right py-2 px-2">Tax collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((d) => (
                      <tr key={d.date} className="border-b border-card-border/60">
                        <td className="py-2 px-2 font-mono">{d.date}</td>
                        <td className="py-2 px-2 text-right">{d.sales_count}</td>
                        <td className="py-2 px-2 text-right">
                          <MonoValue>
                            {formatCents(d.taxable_subtotal_cents)}
                          </MonoValue>
                        </td>
                        <td className="py-2 px-2 text-right text-muted">
                          <MonoValue>
                            {formatCents(d.exempt_subtotal_cents)}
                          </MonoValue>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">
                          <MonoValue>
                            {formatCents(d.tax_collected_cents)}
                          </MonoValue>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">
                        {report.summary.sales_count}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatCents(report.summary.taxable_subtotal_cents)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatCents(report.summary.exempt_subtotal_cents)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {formatCents(report.summary.tax_collected_cents)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {report.training_excluded > 0 ? (
            <p className="text-xs text-muted">
              {report.training_excluded} training-mode {report.training_excluded === 1 ? "transaction was" : "transactions were"} excluded from these totals.
            </p>
          ) : null}
        </>
      ) : loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : null}
    </div>
  );
}
