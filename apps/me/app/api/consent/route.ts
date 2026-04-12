import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/consent — returns all consent grants for the authenticated user.
 * POST /api/consent — toggles a specific consent category.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consents = await prisma.userConsent.findMany({
    where: { userId: session.user.id },
    select: {
      category: true,
      granted: true,
      grantedAt: true,
      revokedAt: true,
      source: true,
    },
    orderBy: { category: 'asc' },
  });

  return NextResponse.json({ consents });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category, granted } = await request.json();

  if (!category || typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'Missing category or granted field' }, { status: 400 });
  }

  // platform_functional cannot be revoked
  if (category === 'platform_functional' && !granted) {
    return NextResponse.json(
      { error: 'Platform functional consent cannot be revoked — it covers transactional emails required for the platform to work.' },
      { status: 400 }
    );
  }

  const result = await prisma.userConsent.upsert({
    where: { userId_category: { userId: session.user.id, category } },
    create: {
      userId: session.user.id,
      category,
      granted,
      grantedAt: granted ? new Date() : null,
      revokedAt: !granted ? new Date() : null,
      source: 'api',
    },
    update: {
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: !granted ? new Date() : undefined,
    },
  });

  return NextResponse.json({
    category: result.category,
    granted: result.granted,
    updatedAt: granted ? result.grantedAt : result.revokedAt,
  });
}
