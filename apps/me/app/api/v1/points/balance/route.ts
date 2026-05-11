/**
 * GET /api/v1/points/balance?userId=...&limit=20
 *
 * Federation endpoint for reading a user's Points balance + recent
 * activity. Companion to /api/v1/points/grant. Callers (FU, Connect
 * stores) use this to render balance UIs without keeping their own
 * copy of the ledger.
 *
 * Returns:
 *   {
 *     userId: string,
 *     totalBalance: number,           // sum across all scopes
 *     balances: { storeId: string|null, balance: number }[],
 *     recentTransactions: Array<{ id, amount, balance, action, category, description, storeId, createdAt }>,
 *   }
 *
 * Scope: read:points
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(
    Number.isInteger(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // Per-store balances (sum of amounts per storeId scope).
  const groups = await prisma.$queryRaw<Array<{ storeId: string | null; total: bigint }>>`
    SELECT "storeId", SUM(amount)::bigint AS total
    FROM "PointsLedger"
    WHERE "userId" = ${userId}
    GROUP BY "storeId"
  `;

  const balances = groups.map((g) => ({
    storeId: g.storeId,
    balance: Number(g.total),
  }));
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  const recentTransactions = await prisma.pointsLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      balance: true,
      action: true,
      category: true,
      description: true,
      storeId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    userId,
    totalBalance,
    balances,
    recentTransactions,
  });
}, "read:points");
