import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/export-data — returns a JSON dump of everything
 * Afterroar knows about the authenticated user.
 *
 * Per the Afterroar Credo tier 1: players own their data.
 * This endpoint is how they exercise that ownership.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, consents, points, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        passportCode: true,
        membershipTier: true,
        identityVerified: true,
        reputationScore: true,
        gameLibrary: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.userConsent.findMany({
      where: { userId },
      select: {
        category: true,
        granted: true,
        grantedAt: true,
        revokedAt: true,
        source: true,
      },
    }),
    prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        amount: true,
        balance: true,
        action: true,
        category: true,
        description: true,
        storeId: true,
        createdAt: true,
      },
    }),
    prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        action: true,
        targetType: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedFrom: 'afterroar.me',
    user: {
      ...user,
      gameLibrary: user?.gameLibrary ? JSON.parse(user.gameLibrary) : null,
    },
    consents,
    recentPoints: points,
    recentActivity: activities,
  };

  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="afterroar-export-${userId.slice(0, 8)}.json"`,
    },
  });
}
