import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";
import { excludeTraining } from "@/lib/training-filter";

/* ------------------------------------------------------------------ */
/*  GET /api/sales/export — CSV of sale ledger entries in a date      */
/*  range. Data-portability counterpart to inventory + customers      */
/*  exports — a store can keep its full transaction history if they    */
/*  ever leave the platform.                                          */
/*                                                                     */
/*  Query params (both required, YYYY-MM-DD):                         */
/*    start                                                            */
/*    end                                                              */
/*                                                                     */
/*  Excludes training-mode transactions by default. Pass               */
/*  `include_training=true` to include them (useful for QA).          */
/* ------------------------------------------------------------------ */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await requirePermission("reports");

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const includeTraining = url.searchParams.get("include_training") === "true";

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    const from = new Date(`${start}T00:00:00.000Z`);
    const to = new Date(`${end}T23:59:59.999Z`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ error: "invalid date range" }, { status: 400 });
    }

    const rawSales = await db.posLedgerEntry.findMany({
      where: {
        type: "sale",
        created_at: { gte: from, lte: to },
      },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        amount_cents: true,
        tip_cents: true,
        credit_amount_cents: true,
        created_at: true,
        metadata: true,
        customer: { select: { name: true, email: true } },
        staff: { select: { name: true } },
      },
    });
    const sales = includeTraining ? rawSales : excludeTraining(rawSales);

    const headers = [
      "transaction_id",
      "date",
      "staff",
      "customer",
      "customer_email",
      "subtotal_dollars",
      "tax_dollars",
      "tip_dollars",
      "credit_applied_dollars",
      "total_dollars",
      "payment_method",
      "discount_dollars",
      "discount_reason",
      "training",
    ];
    const lines = [headers.join(",")];

    for (const s of sales) {
      const meta = (s.metadata ?? {}) as Record<string, unknown>;
      const taxCents = Number(meta.tax_cents ?? 0);
      const discountCents = Number(meta.discount_cents ?? 0);
      const totalCents = s.amount_cents + taxCents + s.tip_cents - s.credit_amount_cents;
      lines.push(
        [
          (meta.transaction_id as string | undefined) ?? s.id,
          s.created_at.toISOString(),
          s.staff?.name ?? "",
          s.customer?.name ?? "",
          s.customer?.email ?? "",
          (s.amount_cents / 100).toFixed(2),
          (taxCents / 100).toFixed(2),
          (s.tip_cents / 100).toFixed(2),
          (s.credit_amount_cents / 100).toFixed(2),
          (totalCents / 100).toFixed(2),
          (meta.payment_method as string | undefined) ?? "",
          (discountCents / 100).toFixed(2),
          (meta.discount_reason as string | undefined) ?? "",
          meta.training === true ? "true" : "false",
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    const csv = lines.join("\n");
    const filename = `sales-${start}-to-${end}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
