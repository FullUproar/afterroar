import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/passport/lookup?id={userId}
 *
 * Public-facing endpoint for Store Ops to look up a Passport holder.
 * Returns display name, avatar, reputation, and verification status.
 * Never returns email or other PII — stores don't get that without consent.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('id');
  if (!userId) {
    return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
  }

  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      passportCode: true,
      reputationScore: true,
      identityVerified: true,
      membershipTier: true,
    },
  });

  if (!user) {
    // Try by passport code
    const byCode = await prisma.user.findFirst({
      where: { passportCode: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        passportCode: true,
        reputationScore: true,
        identityVerified: true,
        membershipTier: true,
      },
    });
    user = byCode;
  }

  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    passportCode: user.passportCode,
    reputationScore: user.reputationScore,
    identityVerified: user.identityVerified,
    membershipTier: user.membershipTier,
  }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
