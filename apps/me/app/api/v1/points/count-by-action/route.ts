/**
 * GET /api/v1/points/count-by-action?userId=...&action=...&storeId=...
 *
 * Returns the number of times a user has earned points for a specific
 * action. Used by FU's awardPoints() to enforce PointsAction.maxEarns
 * (e.g., "review this game once → 50 points, never again"). The cap
 * lives in FU's PointsAction catalog; this endpoint provides the
 * cross-source count so FU can decide whether to grant.
 *
 * `storeId` is optional. When omitted, counts across all stores. When
 * present, counts only earns at that store scope. Matches the same
 * scope semantics PointsLedger uses elsewhere.
 *
 * Returns: { userId, action, storeId, count }
 *
 * Scope: read:points
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const action = req.nextUrl.searchParams.get("action")?.trim();
  const storeIdParam = req.nextUrl.searchParams.get("storeId");
  const storeId = storeIdParam && storeIdParam.trim().length > 0 ? storeIdParam.trim() : undefined;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  // amount > 0 ensures we only count grants (positive earns), not the
  // negative reversals/redemptions that might share an action name.
  const count = await prisma.pointsLedger.count({
    where: {
      userId,
      action,
      amount: { gt: 0 },
      ...(storeId !== undefined ? { storeId } : {}),
    },
  });

  return NextResponse.json({
    userId,
    action,
    storeId: storeId ?? null,
    count,
  });
}, "read:points");
