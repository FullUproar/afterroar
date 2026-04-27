/**
 * GET /api/v1/events/by-afterroar-id/:id/checkins
 *
 * POS check-in data for a Game Night, looked up via PosEvent.afterroar_event_id.
 *
 * Returns:
 *   {
 *     checkedIn: number,           // total count
 *     checkins: [{
 *       customerName: string,
 *       checkedInAt: string,        // ISO
 *       feePaid: boolean,
 *       afterroarUserId: string|null,  // for cross-matching with FU's User table
 *     }]
 *   }
 *
 * Returns { checkedIn: 0, checkins: [] } if no PosEvent is linked — empty
 * rather than 404 because the consumer (FU) treats "no POS link" as a degraded
 * but valid state.
 *
 * Scope: read:events:checkins
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey<{ id: string }>(
  async (_req: NextRequest, { params }) => {
    const { id } = await params;

    const posEvent = await prisma.posEvent.findFirst({
      where: { afterroar_event_id: id },
      select: { id: true },
    });
    if (!posEvent) {
      return NextResponse.json({ checkedIn: 0, checkins: [] });
    }

    const checkins = await prisma.posEventCheckin.findMany({
      where: { event_id: posEvent.id },
      include: { customer: { select: { name: true, afterroar_user_id: true } } },
      orderBy: { checked_in_at: "asc" },
    });

    return NextResponse.json({
      checkedIn: checkins.length,
      checkins: checkins.map((c) => ({
        customerName: c.customer.name,
        checkedInAt: c.checked_in_at.toISOString(),
        feePaid: c.fee_paid,
        afterroarUserId: c.customer.afterroar_user_id,
      })),
    });
  },
  "read:events:checkins",
);
