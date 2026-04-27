/**
 * GET /api/v1/venues/:id/revenue?period=30
 *
 * POS revenue aggregation for any pos_stores linked to a venue.
 * Linkage: pos_stores.settings.venueId === venueId.
 *
 * Query params:
 *   period: number of days to look back (default 30, max 365).
 *
 * Returns:
 *   {
 *     totalRevenueCents: number,
 *     eventRevenueCents: number,
 *     avgRevenuePerEvent: number,    // 0 if no events with revenue
 *     topRevenueEvents: [{ eventName, revenueCents, date: 'YYYY-MM-DD' }],
 *     storeIds: string[],
 *   }
 *
 * If no linked stores, returns zeros + empty array.
 *
 * Scope: read:venues:revenue
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey<{ id: string }>(
  async (req: NextRequest, { params }) => {
    const { id } = await params;
    const periodRaw = req.nextUrl.searchParams.get("period");
    const period = Math.min(Math.max(parseInt(periodRaw || "30", 10) || 30, 1), 365);
    const periodStart = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const stores = await prisma.posStore.findMany({
      where: { settings: { path: ["venueId"], equals: id } },
      select: { id: true },
    });
    if (stores.length === 0) {
      return NextResponse.json({
        totalRevenueCents: 0,
        eventRevenueCents: 0,
        avgRevenuePerEvent: 0,
        topRevenueEvents: [],
        storeIds: [],
      });
    }
    const storeIds = stores.map((s) => s.id);

    const totalAgg = await prisma.posLedgerEntry.aggregate({
      where: {
        store_id: { in: storeIds },
        created_at: { gte: periodStart },
        amount_cents: { gt: 0 },
      },
      _sum: { amount_cents: true },
    });
    const totalRevenueCents = totalAgg._sum.amount_cents ?? 0;

    const eventAgg = await prisma.posLedgerEntry.aggregate({
      where: {
        store_id: { in: storeIds },
        created_at: { gte: periodStart },
        event_id: { not: null },
        amount_cents: { gt: 0 },
      },
      _sum: { amount_cents: true },
    });
    const eventRevenueCents = eventAgg._sum.amount_cents ?? 0;

    const eventEntries = await prisma.posLedgerEntry.findMany({
      where: {
        store_id: { in: storeIds },
        created_at: { gte: periodStart },
        event_id: { not: null },
        amount_cents: { gt: 0 },
      },
      select: {
        event_id: true,
        amount_cents: true,
        event: { select: { name: true, starts_at: true } },
      },
    });

    const byEvent: Record<string, { name: string; cents: number; date: string }> = {};
    for (const e of eventEntries) {
      if (!e.event_id || !e.event) continue;
      const slot = byEvent[e.event_id] ??= {
        name: e.event.name,
        cents: 0,
        date: e.event.starts_at.toISOString().slice(0, 10),
      };
      slot.cents += e.amount_cents;
    }

    const topRevenueEvents = Object.values(byEvent)
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 5)
      .map((e) => ({ eventName: e.name, revenueCents: e.cents, date: e.date }));

    const eventCount = Object.keys(byEvent).length;
    const avgRevenuePerEvent =
      eventCount > 0 ? Math.round(eventRevenueCents / eventCount) : 0;

    return NextResponse.json({
      totalRevenueCents,
      eventRevenueCents,
      avgRevenuePerEvent,
      topRevenueEvents,
      storeIds,
    });
  },
  "read:venues:revenue",
);
