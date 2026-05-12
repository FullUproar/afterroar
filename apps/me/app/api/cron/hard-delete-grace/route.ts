import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Daily hard-delete cron — runs after the 30-day soft-delete window.
 *
 * Finds users with scheduledDeletionAt in the past, anonymizes their
 * points ledger (preserve store accounting, remove the userId link),
 * and deletes the rest of their data + the User row.
 *
 * Idempotent: re-runs are safe because the User row is gone after the
 * first successful pass.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await prisma.user.findMany({
    where: {
      scheduledDeletionAt: { lt: new Date() },
    },
    select: { id: true, email: true },
    take: 200,
  });

  const results: { userId: string; ok: boolean; error?: string }[] = [];
  for (const user of due) {
    try {
      // Anonymize points (preserve store-side accounting, drop user link).
      await prisma.pointsLedger.updateMany({
        where: { userId: user.id },
        data: { userId: null as unknown as string },
      });

      // Drop all per-user content.
      await prisma.userActivity.deleteMany({ where: { userId: user.id } });
      await prisma.userConsent.deleteMany({ where: { userId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.wishlistItem.deleteMany({ where: { userId: user.id } });

      // Finally the User itself.
      await prisma.user.delete({ where: { id: user.id } });

      results.push({ userId: user.id, ok: true });
    } catch (err) {
      results.push({
        userId: user.id,
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    scanned: due.length,
    deleted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    errors: results.filter((r) => !r.ok),
  });
}

export const GET = POST;
