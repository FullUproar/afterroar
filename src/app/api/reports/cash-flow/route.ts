import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/reports/cash-flow — Cash Flow Intelligence data           */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const { db, storeId } = await requirePermission("cash_flow");

    const now = new Date();

    // Time boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Run all queries in parallel
    const [
      allInventory,
      allLedger,
      todayLedger,
      weekLedger,
      monthLedger,
      prevMonthLedger,
      tradeInsMonth,
      returnsMonth,
      customerCount,
      customersWithCredit,
    ] = await Promise.all([
      // All inventory for capital analysis
      db.posInventoryItem.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          category: true,
          price_cents: true,
          cost_cents: true,
          quantity: true,
        },
      }),

      // All-time ledger for totals
      db.posLedgerEntry.findMany({
        select: { type: true, amount_cents: true, credit_amount_cents: true },
      }),

      // Today's ledger
      db.posLedgerEntry.findMany({
        where: { created_at: { gte: todayStart } },
        select: { type: true, amount_cents: true, credit_amount_cents: true },
      }),

      // This week's ledger
      db.posLedgerEntry.findMany({
        where: { created_at: { gte: weekStart } },
        select: { type: true, amount_cents: true, credit_amount_cents: true },
      }),

      // This month's ledger
      db.posLedgerEntry.findMany({
        where: { created_at: { gte: monthStart } },
        select: { type: true, amount_cents: true, credit_amount_cents: true },
      }),

      // Previous month's ledger (for trend comparison)
      db.posLedgerEntry.findMany({
        where: {
          created_at: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        select: { type: true, amount_cents: true, credit_amount_cents: true },
      }),

      // Trade-ins this month
      db.posTradeIn.findMany({
        where: { created_at: { gte: monthStart } },
        select: {
          payout_type: true,
          total_offer_cents: true,
          total_payout_cents: true,
        },
      }),

      // Returns this month
      db.posReturn.findMany({
        where: { created_at: { gte: monthStart } },
        select: {
          refund_method: true,
          total_refund_cents: true,
          subtotal_cents: true,
          restocking_fee_cents: true,
        },
      }),

      // Customer counts
      db.posCustomer.count(),

      // Customers with credit balance
      db.posCustomer.aggregate({
        where: { credit_balance_cents: { gt: 0 } },
        _sum: { credit_balance_cents: true },
        _count: true,
      }),
    ]);

    // ---- Inventory Capital Analysis ----
    const inventoryByCategory = new Map<string, {
      category: string;
      item_count: number;
      total_units: number;
      cost_basis_cents: number;
      retail_value_cents: number;
      zero_stock_items: number;
    }>();

    let totalCostBasis = 0;
    let totalRetailValue = 0;
    let totalUnits = 0;
    let zeroStockCount = 0;
    const deadStockItems: Array<{
      id: string;
      name: string;
      category: string;
      quantity: number;
      cost_trapped_cents: number;
      retail_value_cents: number;
    }> = [];

    for (const item of allInventory) {
      const costBasis = item.cost_cents * item.quantity;
      const retailValue = item.price_cents * item.quantity;

      totalCostBasis += costBasis;
      totalRetailValue += retailValue;
      totalUnits += item.quantity;

      if (item.quantity === 0) zeroStockCount++;

      // Dead stock: items with quantity > 0 but low value/high quantity ratio
      // For now, flag items with cost > $50 trapped as potentially dead
      if (item.quantity > 0 && costBasis > 5000) {
        deadStockItems.push({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          cost_trapped_cents: costBasis,
          retail_value_cents: retailValue,
        });
      }

      const cat = item.category;
      const existing = inventoryByCategory.get(cat);
      if (existing) {
        existing.item_count++;
        existing.total_units += item.quantity;
        existing.cost_basis_cents += costBasis;
        existing.retail_value_cents += retailValue;
        if (item.quantity === 0) existing.zero_stock_items++;
      } else {
        inventoryByCategory.set(cat, {
          category: cat,
          item_count: 1,
          total_units: item.quantity,
          cost_basis_cents: costBasis,
          retail_value_cents: retailValue,
          zero_stock_items: item.quantity === 0 ? 1 : 0,
        });
      }
    }

    // Sort dead stock by cost trapped (highest first) - top 10
    deadStockItems.sort((a, b) => b.cost_trapped_cents - a.cost_trapped_cents);
    const topDeadStock = deadStockItems.slice(0, 10);

    // ---- Ledger Aggregation Helper ----
    function aggregateLedger(entries: Array<{ type: string; amount_cents: number; credit_amount_cents: number }>) {
      let salesRevenue = 0;
      let eventFees = 0;
      let tradeInPayouts = 0;
      let refunds = 0;
      let creditIssued = 0;
      let creditRedeemed = 0;

      for (const e of entries) {
        switch (e.type) {
          case "sale":
            salesRevenue += e.amount_cents;
            break;
          case "event_fee":
            eventFees += e.amount_cents;
            break;
          case "trade_in":
            tradeInPayouts += Math.abs(e.amount_cents);
            break;
          case "refund":
            refunds += Math.abs(e.amount_cents);
            break;
          case "credit_issue":
            creditIssued += e.credit_amount_cents;
            break;
          case "credit_redeem":
            creditRedeemed += Math.abs(e.credit_amount_cents);
            break;
        }
      }

      const grossRevenue = salesRevenue + eventFees;
      const totalPayouts = tradeInPayouts + refunds;
      const netCashFlow = grossRevenue - totalPayouts;

      return {
        sales_revenue_cents: salesRevenue,
        event_fees_cents: eventFees,
        gross_revenue_cents: grossRevenue,
        trade_in_payouts_cents: tradeInPayouts,
        refunds_cents: refunds,
        total_payouts_cents: totalPayouts,
        net_cash_flow_cents: netCashFlow,
        credit_issued_cents: creditIssued,
        credit_redeemed_cents: creditRedeemed,
      };
    }

    const todayAgg = aggregateLedger(todayLedger);
    const weekAgg = aggregateLedger(weekLedger);
    const monthAgg = aggregateLedger(monthLedger);
    const prevMonthAgg = aggregateLedger(prevMonthLedger);
    const allTimeAgg = aggregateLedger(allLedger);

    // ---- Trade-In ROI This Month ----
    const tradeInSummary = {
      count: tradeInsMonth.length,
      total_offer_cents: tradeInsMonth.reduce((s, t) => s + t.total_offer_cents, 0),
      total_payout_cents: tradeInsMonth.reduce((s, t) => s + t.total_payout_cents, 0),
      cash_payouts: tradeInsMonth.filter((t) => t.payout_type === "cash").length,
      credit_payouts: tradeInsMonth.filter((t) => t.payout_type === "credit").length,
    };

    // ---- Return Summary This Month ----
    const returnSummary = {
      count: returnsMonth.length,
      total_refunded_cents: returnsMonth.reduce((s, r) => s + r.total_refund_cents, 0),
      restocking_fees_collected_cents: returnsMonth.reduce(
        (s, r) => s + r.restocking_fee_cents,
        0
      ),
      cash_refunds: returnsMonth.filter((r) => r.refund_method === "cash").length,
      credit_refunds: returnsMonth.filter((r) => r.refund_method === "store_credit").length,
    };

    // ---- Outstanding Store Credit (liability) ----
    const outstandingCredit = {
      total_cents: customersWithCredit._sum.credit_balance_cents ?? 0,
      customer_count: customersWithCredit._count,
    };

    // ---- Month-over-month trend ----
    const monthTrend = {
      revenue_change_cents: monthAgg.gross_revenue_cents - prevMonthAgg.gross_revenue_cents,
      revenue_change_percent:
        prevMonthAgg.gross_revenue_cents > 0
          ? Math.round(
              ((monthAgg.gross_revenue_cents - prevMonthAgg.gross_revenue_cents) /
                prevMonthAgg.gross_revenue_cents) *
                100
            )
          : null,
      payout_change_cents: monthAgg.total_payouts_cents - prevMonthAgg.total_payouts_cents,
    };

    // ---- Category breakdown (sorted by cost basis) ----
    const categoryBreakdown = [...inventoryByCategory.values()].sort(
      (a, b) => b.cost_basis_cents - a.cost_basis_cents
    );

    // ---- Potential margin by category ----
    const categoryMargins = categoryBreakdown.map((cat) => ({
      ...cat,
      potential_margin_cents: cat.retail_value_cents - cat.cost_basis_cents,
      margin_percent:
        cat.retail_value_cents > 0
          ? Math.round(
              ((cat.retail_value_cents - cat.cost_basis_cents) / cat.retail_value_cents) * 100
            )
          : 0,
    }));

    return NextResponse.json({
      // Time-based summaries
      today: todayAgg,
      this_week: weekAgg,
      this_month: monthAgg,
      all_time: allTimeAgg,
      month_trend: monthTrend,

      // Inventory capital
      inventory: {
        total_skus: allInventory.length,
        total_units: totalUnits,
        cost_basis_cents: totalCostBasis,
        retail_value_cents: totalRetailValue,
        potential_margin_cents: totalRetailValue - totalCostBasis,
        zero_stock_count: zeroStockCount,
      },

      // Where the money is trapped
      category_breakdown: categoryMargins,
      dead_stock: topDeadStock,

      // Trade-ins & returns this month
      trade_ins: tradeInSummary,
      returns: returnSummary,

      // Liability
      outstanding_credit: outstandingCredit,
      total_customers: customerCount,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
