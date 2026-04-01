import { type TenantPrismaClient } from "./tenant-prisma";
import { formatCents } from "./types";

/* ------------------------------------------------------------------ */
/*  Store Intelligence Engine                                          */
/*  Analyzes store data and generates actionable insights.             */
/*  Philosophy: sentences not charts, actions not data.                */
/* ------------------------------------------------------------------ */

export interface Insight {
  id: string;
  type: "action" | "warning" | "opportunity" | "celebration";
  priority: "high" | "medium" | "low";
  icon: string;
  title: string;
  message: string;
  metric?: string;
  action?: { label: string; href: string };
  category: "inventory" | "customers" | "events" | "cash_flow" | "pricing" | "staff";
}

const CATEGORY_LABELS: Record<string, string> = {
  tcg_single: "TCG Singles",
  sealed: "Sealed Product",
  board_game: "Board Games",
  miniature: "Miniatures",
  accessory: "Accessories",
  food_drink: "Cafe / Food",
  other: "Other",
};

function catLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat;
}

export async function generateInsights(
  db: TenantPrismaClient,
  storeId: string,
): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(now);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const lastWeekSameDayStart = new Date(now);
  lastWeekSameDayStart.setDate(lastWeekSameDayStart.getDate() - 8);
  lastWeekSameDayStart.setHours(0, 0, 0, 0);
  const lastWeekSameDayEnd = new Date(now);
  lastWeekSameDayEnd.setDate(lastWeekSameDayEnd.getDate() - 8);
  lastWeekSameDayEnd.setHours(23, 59, 59, 999);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // ---- Run all queries in parallel ----
  const [
    allInventory,
    last30dLedger,
    yesterdayLedger,
    lastWeekSameDayLedger,
    thisWeekLedger,
    lastWeekLedger,
    allCustomers,
    upcomingEvents,
    pastEvents,
    todayTimeEntries,
    customersWithCredit,
    newCustomers,
  ] = await Promise.all([
    // Active inventory
    db.posInventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        category: true,
        price_cents: true,
        cost_cents: true,
        quantity: true,
        low_stock_threshold: true,
        created_at: true,
      },
    }),

    // Last 30 days ledger for velocity
    db.posLedgerEntry.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      select: {
        type: true,
        amount_cents: true,
        credit_amount_cents: true,
        metadata: true,
        created_at: true,
        customer_id: true,
        event_id: true,
      },
    }),

    // Yesterday ledger
    db.posLedgerEntry.findMany({
      where: { created_at: { gte: yesterdayStart, lte: yesterdayEnd } },
      select: { type: true, amount_cents: true },
    }),

    // Same day last week
    db.posLedgerEntry.findMany({
      where: { created_at: { gte: lastWeekSameDayStart, lte: lastWeekSameDayEnd } },
      select: { type: true, amount_cents: true },
    }),

    // This week ledger
    db.posLedgerEntry.findMany({
      where: { created_at: { gte: thisWeekStart } },
      select: { type: true, amount_cents: true },
    }),

    // Last week ledger
    db.posLedgerEntry.findMany({
      where: { created_at: { gte: lastWeekStart, lt: thisWeekStart } },
      select: { type: true, amount_cents: true },
    }),

    // All customers with ledger data
    db.posCustomer.findMany({
      select: {
        id: true,
        name: true,
        credit_balance_cents: true,
        created_at: true,
        ledger_entries: {
          select: { amount_cents: true, created_at: true, type: true },
          orderBy: { created_at: "desc" as const },
        },
      },
    }),

    // Upcoming events (next 7 days)
    db.posEvent.findMany({
      where: { starts_at: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
      select: { id: true, name: true, starts_at: true, entry_fee_cents: true },
    }),

    // Past events (last 60 days) with checkins + ledger
    db.posEvent.findMany({
      where: {
        starts_at: {
          gte: new Date(now.getTime() - 60 * 86400000),
          lt: now,
        },
      },
      select: {
        id: true,
        name: true,
        event_type: true,
        starts_at: true,
        entry_fee_cents: true,
        checkins: { select: { id: true } },
        ledger_entries: { select: { amount_cents: true, type: true } },
      },
    }),

    // Today time entries
    db.posTimeEntry.findMany({
      where: { clock_in: { gte: todayStart } },
      select: { id: true },
    }),

    // Customers with credit balance > $50 sitting for 30+ days
    db.posCustomer.findMany({
      where: { credit_balance_cents: { gt: 5000 } },
      select: { id: true, name: true, credit_balance_cents: true, updated_at: true },
    }),

    // New customers in last 7 days
    db.posCustomer.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      select: { id: true, name: true, created_at: true },
    }),
  ]);

  // ---- Build velocity maps ----
  const itemSalesCount = new Map<string, number>();
  const customerLastPurchase = new Map<string, Date>();
  const customerTotalSpend = new Map<string, number>();

  for (const entry of last30dLedger) {
    if (entry.type === "sale" && entry.customer_id) {
      const existing = customerLastPurchase.get(entry.customer_id);
      if (!existing || entry.created_at > existing) {
        customerLastPurchase.set(entry.customer_id, entry.created_at);
      }
    }

    if (entry.type === "sale") {
      const meta = entry.metadata as Record<string, unknown> | null;
      if (meta?.items) {
        const items = meta.items as Array<{ inventory_item_id: string; quantity: number }>;
        for (const item of items) {
          const prev = itemSalesCount.get(item.inventory_item_id) || 0;
          itemSalesCount.set(item.inventory_item_id, prev + item.quantity);
        }
      }
    }
  }

  // Build lifetime spend from allCustomers
  for (const c of allCustomers) {
    let total = 0;
    for (const le of c.ledger_entries) {
      if (le.type === "sale") total += le.amount_cents;
    }
    customerTotalSpend.set(c.id, total);
  }

  // ---- INVENTORY INSIGHTS ----

  // Reorder Alerts
  const lowStockItems: Array<{
    name: string;
    quantity: number;
    velocity: number;
    daysUntilStockout: number | null;
  }> = [];

  for (const item of allInventory) {
    if (item.quantity >= 900) continue; // perpetual/service items
    if (item.category === "food_drink") continue;

    const sales30d = itemSalesCount.get(item.id) || 0;
    const dailyVelocity = sales30d / 30;
    const weeklyVelocity = dailyVelocity * 7;

    if (item.quantity <= item.low_stock_threshold && item.quantity > 0) {
      const daysUntilStockout = dailyVelocity > 0 ? Math.round(item.quantity / dailyVelocity) : null;
      lowStockItems.push({
        name: item.name,
        quantity: item.quantity,
        velocity: Math.round(weeklyVelocity * 10) / 10,
        daysUntilStockout,
      });
    }
  }

  if (lowStockItems.length > 0) {
    // Sort by urgency (lowest days until stockout first)
    lowStockItems.sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999));
    const top = lowStockItems[0];
    const urgency = top.daysUntilStockout !== null && top.daysUntilStockout <= 7
      ? `Order by ${new Date(now.getTime() + (top.daysUntilStockout - 2) * 86400000).toLocaleDateString("en-US", { weekday: "long" })} to avoid stockout.`
      : "Reorder soon to avoid gaps.";

    insights.push({
      id: "reorder-alert",
      type: "action",
      priority: "high",
      icon: "\u{1F6A8}",
      title: `${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} need${lowStockItems.length === 1 ? "s" : ""} reordering`,
      message: lowStockItems.length === 1
        ? `${top.name}: ${top.quantity} left, you sell ${top.velocity}/week. ${urgency}`
        : `${top.name} is most urgent with ${top.quantity} left (${top.velocity}/week). ${urgency} ${lowStockItems.length - 1} more item${lowStockItems.length > 2 ? "s" : ""} also running low.`,
      metric: `${lowStockItems.length}`,
      action: { label: "View Inventory", href: "/dashboard/inventory" },
      category: "inventory",
    });
  }

  // Dead Stock
  const deadStockItems: Array<{ name: string; costTrapped: number; daysSince: number }> = [];
  for (const item of allInventory) {
    if (item.quantity <= 0 || item.quantity >= 900 || item.category === "food_drink") continue;
    const sales30d = itemSalesCount.get(item.id) || 0;
    if (sales30d > 0) continue;

    const daysSinceCreated = Math.floor((now.getTime() - item.created_at.getTime()) / 86400000);
    if (daysSinceCreated >= 30) {
      deadStockItems.push({
        name: item.name,
        costTrapped: item.cost_cents * item.quantity,
        daysSince: daysSinceCreated,
      });
    }
  }

  if (deadStockItems.length > 0) {
    const totalTrapped = deadStockItems.reduce((s, d) => s + d.costTrapped, 0);
    insights.push({
      id: "dead-stock",
      type: "warning",
      priority: totalTrapped > 50000 ? "high" : "medium",
      icon: "\u{1F4E6}",
      title: `${formatCents(totalTrapped)} tied up in slow-moving inventory`,
      message: `You have ${deadStockItems.length} item${deadStockItems.length > 1 ? "s" : ""} with no sales in 30+ days. Consider a markdown or bundle promotion to free up this cash.`,
      metric: formatCents(totalTrapped),
      action: { label: "View Cash Flow", href: "/dashboard/cash-flow" },
      category: "inventory",
    });
  }

  // Overstock
  const overstockItems: Array<{ name: string; quantity: number; monthlyVelocity: number; monthsOfStock: number }> = [];
  for (const item of allInventory) {
    if (item.quantity <= 0 || item.quantity >= 900 || item.category === "food_drink") continue;
    const sales30d = itemSalesCount.get(item.id) || 0;
    if (sales30d === 0) continue; // handled by dead stock
    const monthlyVelocity = sales30d;
    if (item.quantity > monthlyVelocity * 3) {
      const monthsOfStock = Math.round((item.quantity / monthlyVelocity) * 10) / 10;
      overstockItems.push({
        name: item.name,
        quantity: item.quantity,
        monthlyVelocity,
        monthsOfStock,
      });
    }
  }

  if (overstockItems.length > 0) {
    overstockItems.sort((a, b) => b.monthsOfStock - a.monthsOfStock);
    const top = overstockItems[0];
    insights.push({
      id: "overstock",
      type: "opportunity",
      priority: "low",
      icon: "\u{1F4CA}",
      title: `${overstockItems.length} items are overstocked`,
      message: `You have ${top.quantity} of "${top.name}" but only sell ${top.monthlyVelocity}/month. That's ${top.monthsOfStock} months of stock sitting on the shelf.`,
      action: { label: "View Inventory", href: "/dashboard/inventory" },
      category: "inventory",
    });
  }

  // ---- CUSTOMER INSIGHTS ----

  // Top Customer At Risk
  const atRiskCustomers: Array<{ name: string; lifetimeSpend: number; daysSinceVisit: number }> = [];
  for (const c of allCustomers) {
    const lifetime = customerTotalSpend.get(c.id) || 0;
    if (lifetime < 20000) continue; // $200 minimum

    const lastPurchaseEntries = c.ledger_entries.filter(le => le.type === "sale");
    if (lastPurchaseEntries.length === 0) continue;
    const lastPurchase = lastPurchaseEntries[0]?.created_at;
    if (!lastPurchase) continue;

    const daysSince = Math.floor((now.getTime() - new Date(lastPurchase).getTime()) / 86400000);
    if (daysSince >= 14) {
      atRiskCustomers.push({
        name: c.name,
        lifetimeSpend: lifetime,
        daysSinceVisit: daysSince,
      });
    }
  }

  if (atRiskCustomers.length > 0) {
    atRiskCustomers.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
    const top = atRiskCustomers[0];
    const weeksGone = Math.floor(top.daysSinceVisit / 7);
    insights.push({
      id: "customer-at-risk",
      type: "warning",
      priority: "medium",
      icon: "\u26A0\uFE0F",
      title: `${top.name} hasn't been in for ${weeksGone} week${weeksGone > 1 ? "s" : ""}`,
      message: atRiskCustomers.length === 1
        ? `${top.name} (${formatCents(top.lifetimeSpend)} lifetime) hasn't visited in ${top.daysSinceVisit} days. A personal outreach could bring them back.`
        : `${top.name} (${formatCents(top.lifetimeSpend)} lifetime) and ${atRiskCustomers.length - 1} other valued customer${atRiskCustomers.length > 2 ? "s" : ""} haven't been in recently.`,
      metric: `${atRiskCustomers.length}`,
      action: { label: "View Customers", href: "/dashboard/customers" },
      category: "customers",
    });
  }

  // VIP Alert — hot spender this week
  const weeklySpenders = new Map<string, { name: string; spent: number }>();
  for (const entry of last30dLedger) {
    if (entry.type !== "sale" || !entry.customer_id) continue;
    if (entry.created_at < sevenDaysAgo) continue;
    const customer = allCustomers.find(c => c.id === entry.customer_id);
    if (!customer) continue;
    const existing = weeklySpenders.get(entry.customer_id);
    if (existing) {
      existing.spent += entry.amount_cents;
    } else {
      weeklySpenders.set(entry.customer_id, { name: customer.name, spent: entry.amount_cents });
    }
  }

  const topSpender = [...weeklySpenders.entries()]
    .filter(([, v]) => v.spent >= 10000) // $100+
    .sort(([, a], [, b]) => b.spent - a.spent)[0];

  if (topSpender) {
    const [, spender] = topSpender;
    insights.push({
      id: "vip-alert",
      type: "celebration",
      priority: "low",
      icon: "\u2B50",
      title: `${spender.name} spent ${formatCents(spender.spent)} this week`,
      message: `${spender.name} is on a hot streak. Consider a thank-you or loyalty bonus to keep the momentum going.`,
      metric: formatCents(spender.spent),
      action: { label: "View Customers", href: "/dashboard/customers" },
      category: "customers",
    });
  }

  // New Customers
  const newCustomersWithPurchase = newCustomers.filter(c => {
    const entries = allCustomers.find(ac => ac.id === c.id)?.ledger_entries || [];
    return entries.some(le => le.type === "sale");
  });

  if (newCustomersWithPurchase.length > 0) {
    insights.push({
      id: "new-customers",
      type: "celebration",
      priority: "low",
      icon: "\u{1F389}",
      title: `${newCustomersWithPurchase.length} new customer${newCustomersWithPurchase.length > 1 ? "s" : ""} this week`,
      message: `You gained ${newCustomersWithPurchase.length} new customer${newCustomersWithPurchase.length > 1 ? "s" : ""} who made a purchase. First impressions matter -- make sure they come back.`,
      category: "customers",
    });
  }

  // Credit Balance Sitting
  const creditCustomers = customersWithCredit.filter(c => {
    const daysSinceUpdate = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / 86400000);
    return daysSinceUpdate >= 30;
  });

  if (creditCustomers.length > 0) {
    const totalCredit = creditCustomers.reduce((s, c) => s + c.credit_balance_cents, 0);
    insights.push({
      id: "credit-sitting",
      type: "opportunity",
      priority: "medium",
      icon: "\u{1F4B0}",
      title: `${formatCents(totalCredit)} in unused store credit`,
      message: `${creditCustomers.length} customer${creditCustomers.length > 1 ? "s" : ""} ha${creditCustomers.length > 1 ? "ve" : "s"} credit sitting for 30+ days. That's revenue waiting to happen. Consider a "use your credit" promotion.`,
      metric: formatCents(totalCredit),
      action: { label: "View Customers", href: "/dashboard/customers" },
      category: "customers",
    });
  }

  // ---- EVENT INSIGHTS ----

  // Event ROI Analysis
  if (pastEvents.length > 0) {
    const eventROI = pastEvents.map(e => {
      let totalRevenue = 0;
      for (const le of e.ledger_entries) {
        if (le.type === "sale" || le.type === "event_fee") {
          totalRevenue += le.amount_cents;
        }
      }
      return {
        name: e.name,
        type: e.event_type,
        revenue: totalRevenue,
        attendees: e.checkins.length,
        date: e.starts_at,
      };
    }).filter(e => e.attendees > 0 || e.revenue > 0);

    if (eventROI.length >= 2) {
      eventROI.sort((a, b) => b.revenue - a.revenue);
      const best = eventROI[0];
      const worst = eventROI[eventROI.length - 1];

      if (best.revenue > 0) {
        insights.push({
          id: "best-event",
          type: "celebration",
          priority: "low",
          icon: "\u{1F3C6}",
          title: `${best.name} is your top-performing event`,
          message: `It generated ${formatCents(best.revenue)} with ${best.attendees} attendees. Keep promoting it.`,
          metric: formatCents(best.revenue),
          action: { label: "View Events", href: "/dashboard/events" },
          category: "events",
        });
      }

      if (worst.revenue < best.revenue * 0.5 && worst.revenue > 0) {
        insights.push({
          id: "worst-event",
          type: "opportunity",
          priority: "low",
          icon: "\u{1F4C9}",
          title: `${worst.name} could use a boost`,
          message: `It generated ${formatCents(worst.revenue)} -- less than half of your best event. Consider different timing, format changes, or extra promotion.`,
          action: { label: "View Events", href: "/dashboard/events" },
          category: "events",
        });
      }
    }
  }

  // No Events Scheduled
  if (upcomingEvents.length === 0) {
    insights.push({
      id: "no-events",
      type: "action",
      priority: "medium",
      icon: "\u{1F4C5}",
      title: "No events scheduled this week",
      message: "Events drive 30-40% of game store revenue. FNM, Commander nights, and prereleases bring regulars through the door and boost singles and snack sales. Schedule one now.",
      action: { label: "Create Event", href: "/dashboard/events" },
      category: "events",
    });
  }

  // ---- CASH FLOW INSIGHTS ----

  // Daily Summary
  let yesterdayRevenue = 0;
  let yesterdayPayouts = 0;
  for (const e of yesterdayLedger) {
    if (e.type === "sale" || e.type === "event_fee") yesterdayRevenue += e.amount_cents;
    if (e.type === "trade_in" || e.type === "refund") yesterdayPayouts += Math.abs(e.amount_cents);
  }

  let lastWeekSameDayRevenue = 0;
  for (const e of lastWeekSameDayLedger) {
    if (e.type === "sale" || e.type === "event_fee") lastWeekSameDayRevenue += e.amount_cents;
  }

  if (yesterdayRevenue > 0 || yesterdayPayouts > 0) {
    const net = yesterdayRevenue - yesterdayPayouts;
    let comparison = "";
    if (lastWeekSameDayRevenue > 0) {
      const changePct = Math.round(((yesterdayRevenue - lastWeekSameDayRevenue) / lastWeekSameDayRevenue) * 100);
      comparison = changePct >= 0
        ? ` Up ${changePct}% from the same day last week.`
        : ` Down ${Math.abs(changePct)}% from the same day last week.`;
    }

    insights.push({
      id: "daily-summary",
      type: net >= 0 ? "celebration" : "warning",
      priority: "low",
      icon: net >= 0 ? "\u2600\uFE0F" : "\u{1F327}\uFE0F",
      title: `Yesterday: ${formatCents(net)} net`,
      message: `${formatCents(yesterdayRevenue)} in revenue, ${formatCents(yesterdayPayouts)} in payouts.${comparison}`,
      metric: formatCents(net),
      action: { label: "View Cash Flow", href: "/dashboard/cash-flow" },
      category: "cash_flow",
    });
  }

  // Weekly Revenue Trend
  let thisWeekRevenue = 0;
  for (const e of thisWeekLedger) {
    if (e.type === "sale" || e.type === "event_fee") thisWeekRevenue += e.amount_cents;
  }
  let lastWeekRevenue = 0;
  for (const e of lastWeekLedger) {
    if (e.type === "sale" || e.type === "event_fee") lastWeekRevenue += e.amount_cents;
  }

  if (lastWeekRevenue > 0 && thisWeekRevenue > 0) {
    const changePct = Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100);
    if (changePct > 0) {
      insights.push({
        id: "week-trend",
        type: "celebration",
        priority: "low",
        icon: "\u{1F4C8}",
        title: `Revenue up ${changePct}% vs last week`,
        message: `${formatCents(thisWeekRevenue)} this week vs ${formatCents(lastWeekRevenue)} last week. Keep the momentum going.`,
        category: "cash_flow",
      });
    }
  }

  // Margin Alert
  const totalRevenue30d = last30dLedger
    .filter(e => e.type === "sale")
    .reduce((s, e) => s + e.amount_cents, 0);

  if (totalRevenue30d > 0) {
    let totalCost30d = 0;
    for (const entry of last30dLedger) {
      if (entry.type !== "sale") continue;
      const meta = entry.metadata as Record<string, unknown> | null;
      if (!meta?.items) continue;
      const items = meta.items as Array<{ inventory_item_id: string; quantity: number }>;
      for (const it of items) {
        const inv = allInventory.find(i => i.id === it.inventory_item_id);
        if (inv) totalCost30d += inv.cost_cents * it.quantity;
      }
    }

    const marginPct = Math.round(((totalRevenue30d - totalCost30d) / totalRevenue30d) * 100);
    if (marginPct < 30 && marginPct > 0) {
      // Find lowest margin category
      const catMargins = new Map<string, { rev: number; cost: number }>();
      for (const entry of last30dLedger) {
        if (entry.type !== "sale") continue;
        const meta = entry.metadata as Record<string, unknown> | null;
        if (!meta?.items) continue;
        const items = meta.items as Array<{ inventory_item_id: string; quantity: number; price_cents: number }>;
        for (const it of items) {
          const inv = allInventory.find(i => i.id === it.inventory_item_id);
          if (!inv) continue;
          const cat = inv.category;
          const existing = catMargins.get(cat) || { rev: 0, cost: 0 };
          existing.rev += it.price_cents * it.quantity;
          existing.cost += inv.cost_cents * it.quantity;
          catMargins.set(cat, existing);
        }
      }

      let lowestMarginCat = "";
      let lowestMarginPct = 100;
      for (const [cat, data] of catMargins) {
        if (data.rev > 0) {
          const m = Math.round(((data.rev - data.cost) / data.rev) * 100);
          if (m < lowestMarginPct) {
            lowestMarginPct = m;
            lowestMarginCat = cat;
          }
        }
      }

      insights.push({
        id: "margin-alert",
        type: "warning",
        priority: "high",
        icon: "\u{1F4C9}",
        title: `Your blended margin is ${marginPct}%`,
        message: `Game stores typically need 35%+ to be healthy.${lowestMarginCat ? ` Your ${catLabel(lowestMarginCat)} category at ${lowestMarginPct}% is dragging it down.` : ""}`,
        action: { label: "View Cash Flow", href: "/dashboard/cash-flow" },
        category: "cash_flow",
      });
    }
  }

  // Cash in Inventory
  const totalInventoryCost = allInventory.reduce((s, i) => s + i.cost_cents * i.quantity, 0);
  if (totalInventoryCost > 0) {
    // Find top category
    const catCosts = new Map<string, number>();
    for (const item of allInventory) {
      const cost = item.cost_cents * item.quantity;
      catCosts.set(item.category, (catCosts.get(item.category) || 0) + cost);
    }
    let topCat = "";
    let topCatCost = 0;
    for (const [cat, cost] of catCosts) {
      if (cost > topCatCost) {
        topCat = cat;
        topCatCost = cost;
      }
    }
    const topCatPct = Math.round((topCatCost / totalInventoryCost) * 100);

    insights.push({
      id: "cash-in-inventory",
      type: "opportunity",
      priority: "low",
      icon: "\u{1F4B5}",
      title: `${formatCents(totalInventoryCost)} tied up in inventory`,
      message: `${topCatPct}% of that is in ${catLabel(topCat)}. Make sure your capital allocation matches what actually sells.`,
      action: { label: "View Cash Flow", href: "/dashboard/cash-flow" },
      category: "cash_flow",
    });
  }

  // ---- STAFF INSIGHTS ----

  // No one clocked in (only check during business hours 9am-9pm)
  const hour = now.getHours();
  if (hour >= 9 && hour <= 21 && todayTimeEntries.length === 0) {
    insights.push({
      id: "no-staff-clocked-in",
      type: "warning",
      priority: "high",
      icon: "\u{1F6A8}",
      title: "No staff has clocked in today",
      message: "It's a business day and no one has clocked in. Is the store open? If you don't use time tracking, you can ignore this.",
      action: { label: "Time Clock", href: "/dashboard/timeclock" },
      category: "staff",
    });
  }

  // ---- Sort by priority ----
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}
