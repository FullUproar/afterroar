import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings-shared";

/* ------------------------------------------------------------------ */
/*  GET /api/reports/tax-period                                        */
/*                                                                     */
/*  Sales tax aggregation for a state-filing period. FLGS owners file  */
/*  monthly or quarterly; without this, they have no way to produce    */
/*  "tax collected by X" totals from the POS.                          */
/*                                                                     */
/*  Query params:                                                      */
/*    start   YYYY-MM-DD (inclusive, store-local interpreted as UTC)   */
/*    end     YYYY-MM-DD (inclusive, day-end)                           */
/*    format  json (default) | csv                                      */
/*                                                                     */
/*  Excludes:                                                           */
/*    - Training-mode transactions (metadata.training = true)           */
/*    - Returns (returns offset the period totals via separate report;  */
/*      tax on the original sale was already collected and remitted)   */
/*                                                                     */
/*  Single-jurisdiction model: most FLGS operate in one state. The     */
/*  configured tax_state from store settings is the filing state.      */
/*  Multi-state filers will need the Stripe Tax export — outside scope.*/
/* ------------------------------------------------------------------ */

interface TaxRow {
  date: string;
  sales_count: number;
  taxable_subtotal_cents: number;
  tax_collected_cents: number;
  exempt_subtotal_cents: number;
}

export async function GET(req: NextRequest) {
  try {
    const { storeId } = await requirePermission("reports");

    const url = new URL(req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");
    const format = (url.searchParams.get("format") || "json").toLowerCase();

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "start and end (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    const from = new Date(`${startParam}T00:00:00.000Z`);
    const to = new Date(`${endParam}T23:59:59.999Z`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ error: "invalid date range" }, { status: 400 });
    }

    // Pull store-level filing jurisdiction. Falls back to env defaults
    // set by the platform for stores that haven't configured their own.
    const store = await prisma.posStore.findUnique({
      where: { id: storeId },
      select: { name: true, settings: true },
    });
    const settings = getStoreSettings((store?.settings ?? {}) as Record<string, unknown>);
    const jurisdiction = {
      state:
        (settings.tax_state as string | undefined) ||
        process.env.DEFAULT_TAX_STATE ||
        null,
      zip:
        (settings.tax_zip as string | undefined) ||
        process.env.DEFAULT_TAX_ZIP ||
        null,
      defaultRate:
        (settings.tax_rate_percent as number | undefined) ?? 0,
    };

    const sales = await prisma.posLedgerEntry.findMany({
      where: {
        store_id: storeId,
        type: "sale",
        created_at: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount_cents: true,
        metadata: true,
        created_at: true,
      },
      orderBy: { created_at: "asc" },
    });

    const byDay = new Map<string, TaxRow>();
    let totalSales = 0;
    let totalTaxableSubtotal = 0;
    let totalTaxCollected = 0;
    let totalExemptSubtotal = 0;
    let trainingExcluded = 0;

    for (const entry of sales) {
      const meta = (entry.metadata ?? {}) as Record<string, unknown>;
      if (meta.training === true) {
        trainingExcluded += 1;
        continue;
      }

      const taxCents = Number(meta.tax_cents ?? 0);
      const subtotalCents = entry.amount_cents;
      // A sale is "exempt" when there's a recorded subtotal but zero tax
      // on it (tax_exempt customer or zero-rate state). Splits the
      // taxable_subtotal column from the exempt column for line-7-style
      // state form fields.
      const isExempt = taxCents === 0 && subtotalCents > 0;

      const dayKey = entry.created_at.toISOString().slice(0, 10);
      const row = byDay.get(dayKey) ?? {
        date: dayKey,
        sales_count: 0,
        taxable_subtotal_cents: 0,
        tax_collected_cents: 0,
        exempt_subtotal_cents: 0,
      };
      row.sales_count += 1;
      if (isExempt) row.exempt_subtotal_cents += subtotalCents;
      else row.taxable_subtotal_cents += subtotalCents;
      row.tax_collected_cents += taxCents;
      byDay.set(dayKey, row);

      totalSales += 1;
      if (isExempt) totalExemptSubtotal += subtotalCents;
      else totalTaxableSubtotal += subtotalCents;
      totalTaxCollected += taxCents;
    }

    const days = Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    if (format === "csv") {
      const headers = [
        "date",
        "sales_count",
        "taxable_subtotal_dollars",
        "exempt_subtotal_dollars",
        "tax_collected_dollars",
      ];
      const lines = [headers.join(",")];
      for (const d of days) {
        lines.push(
          [
            d.date,
            d.sales_count,
            (d.taxable_subtotal_cents / 100).toFixed(2),
            (d.exempt_subtotal_cents / 100).toFixed(2),
            (d.tax_collected_cents / 100).toFixed(2),
          ].join(","),
        );
      }
      lines.push("");
      lines.push(
        [
          `TOTAL ${startParam}..${endParam}`,
          totalSales,
          (totalTaxableSubtotal / 100).toFixed(2),
          (totalExemptSubtotal / 100).toFixed(2),
          (totalTaxCollected / 100).toFixed(2),
        ].join(","),
      );
      const csv = lines.join("\n");
      const filename = `tax-period-${startParam}-to-${endParam}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      store: store?.name ?? null,
      period: { start: startParam, end: endParam },
      jurisdiction,
      summary: {
        sales_count: totalSales,
        taxable_subtotal_cents: totalTaxableSubtotal,
        exempt_subtotal_cents: totalExemptSubtotal,
        tax_collected_cents: totalTaxCollected,
        effective_rate_percent:
          totalTaxableSubtotal > 0
            ? Number(
                ((totalTaxCollected / totalTaxableSubtotal) * 100).toFixed(4),
              )
            : 0,
      },
      training_excluded: trainingExcluded,
      days,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
