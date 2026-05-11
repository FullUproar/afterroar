/**
 * POST /api/v1/points/grant
 *
 * Federation endpoint for writing to a user's Points balance. Used by
 * Full Uproar (and other Connect-tier callers) to grant or redeem
 * points without needing the user's PassportCode — only their
 * Afterroar user id.
 *
 * Body:
 *   {
 *     userId: string,           // Afterroar User.id (use lookup endpoints to resolve)
 *     amount: number,           // positive = earn, negative = redeem
 *     action: string,           // short identifier e.g. 'purchase' | 'referral' | 'redeem_reward'
 *     category: string,         // grouping bucket e.g. 'store' | 'platform'
 *     description: string,      // human-readable; shown in user history
 *     storeId?: string,         // optional store scope (Venue.id); null = platform points
 *     metadata?: string,        // optional JSON-encoded extras
 *   }
 *
 * Returns:
 *   { ok: true, ledger: { id, balance, amount, createdAt } }
 *
 * Scope: write:points
 *
 * Concurrency: wraps the read-current-balance + insert in a transaction
 * so two simultaneous grants can't both compute the same starting
 * balance and produce drift.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

const MAX_ABS_AMOUNT = 1_000_000;

interface GrantBody {
  userId?: unknown;
  amount?: unknown;
  action?: unknown;
  category?: unknown;
  description?: unknown;
  storeId?: unknown;
  metadata?: unknown;
  /** Cap total earned-today (positive amounts only, across all stores).
   *  Mirrors the anti-burst protection FU's local engine enforced. */
  dailyCap?: unknown;
  /** Floor balance after this write. 0 = no negative. Mirrors FU's
   *  minBalance redemption guard. */
  minBalance?: unknown;
}

export const POST = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  let body: GrantBody;
  try {
    body = (await req.json()) as GrantBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const storeId = typeof body.storeId === "string" && body.storeId.trim().length > 0 ? body.storeId.trim() : null;
  const metadata = typeof body.metadata === "string" ? body.metadata : null;
  const dailyCap = typeof body.dailyCap === "number" && body.dailyCap > 0 ? body.dailyCap : null;
  const minBalance = typeof body.minBalance === "number" ? body.minBalance : null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ABS_AMOUNT) {
    return NextResponse.json(
      { error: `amount must be a non-zero integer within +/-${MAX_ABS_AMOUNT}` },
      { status: 400 },
    );
  }
  if (!action || action.length > 64) {
    return NextResponse.json({ error: "action required (<=64 chars)" }, { status: 400 });
  }
  if (!category || category.length > 32) {
    return NextResponse.json({ error: "category required (<=32 chars)" }, { status: 400 });
  }
  if (!description || description.length > 200) {
    return NextResponse.json({ error: "description required (<=200 chars)" }, { status: 400 });
  }

  // Verify the user actually exists before writing. Avoids creating
  // orphaned ledger rows from misrouted FU writes.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Running balance is per-store. Sum prior amounts in the same scope.
        const prior = await tx.pointsLedger.aggregate({
          where: { userId, storeId },
          _sum: { amount: true },
        });
        const startingBalance = prior._sum.amount ?? 0;

        // Enforce daily cap (anti-burst) — only applies to positive grants.
        // Mirrors the cross-store cap FU's local engine enforced. Caps the
        // effective amount; doesn't reject the request outright unless the
        // cap is already fully consumed.
        let effectiveAmount = amount;
        if (dailyCap !== null && amount > 0) {
          const startOfDay = new Date();
          startOfDay.setUTCHours(0, 0, 0, 0);
          const today = await tx.pointsLedger.aggregate({
            where: { userId, amount: { gt: 0 }, createdAt: { gte: startOfDay } },
            _sum: { amount: true },
          });
          const earnedToday = today._sum.amount ?? 0;
          const remaining = dailyCap - earnedToday;
          if (remaining <= 0) {
            throw new Error("DAILY_CAP_REACHED");
          }
          effectiveAmount = Math.min(amount, remaining);
        }

        const newBalance = startingBalance + effectiveAmount;

        // Enforce minimum balance floor (default 0 = no negative balance).
        const floor = minBalance ?? 0;
        if (newBalance < floor) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        return tx.pointsLedger.create({
          data: {
            userId,
            storeId,
            amount: effectiveAmount,
            balance: newBalance,
            action,
            category,
            description,
            metadata,
          },
          select: { id: true, balance: true, amount: true, createdAt: true },
        });
      },
      { isolationLevel: "Serializable", timeout: 10000 },
    );

    return NextResponse.json({ ok: true, ledger: result });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 409 });
      }
      if (err.message === "DAILY_CAP_REACHED") {
        return NextResponse.json({ error: "Daily points cap reached" }, { status: 429 });
      }
    }
    console.error("[v1/points/grant] failed:", err);
    return NextResponse.json({ error: "Grant failed" }, { status: 500 });
  }
}, "write:points");
