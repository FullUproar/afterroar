import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { audit, clientIp } from '@/lib/audit';

/**
 * GET /api/store/customer-lookup?code=XXXXXXXX&entityId=YYY
 *
 * Caller must be signed in and an EntityMember of the requested entity.
 * Returns the consented slice of a Passport holder's data for the entity.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim().toUpperCase();
  const entityId = searchParams.get('entityId')?.trim();

  if (!code || code.length !== 8) {
    return NextResponse.json({ error: 'Passport code must be 8 characters' }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
  }

  const entity = await prisma.afterroarEntity.findUnique({
    where: { id: entityId },
    include: {
      members: { where: { userId: session.user.id as string } },
    },
  });
  if (!entity || entity.members.length === 0) {
    return NextResponse.json({ error: 'Not a member of this entity' }, { status: 403 });
  }
  if (entity.status !== 'approved') {
    return NextResponse.json({ error: 'Entity is not approved' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { passportCode: code } });
  if (!user) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 });
  }

  const consent = await prisma.entityConsent.findUnique({
    where: { userId_entityId: { userId: user.id, entityId: entity.id } },
  });

  if (!consent || consent.revokedAt || (consent.expiresAt && consent.expiresAt < new Date())) {
    return NextResponse.json({
      passportCode: user.passportCode,
      consentGranted: false,
      consentScopes: [],
    });
  }

  const scopes = new Set(consent.scopes);

  audit({
    actorUserId: session.user.id as string,
    actorEmail: session.user.email,
    actorRole: 'entity_member',
    action: 'customer.lookup',
    targetType: 'User',
    targetId: user.id,
    entityId: entity.id,
    scopesUsed: consent.scopes,
    ip: clientIp(request),
  });

  const response: Record<string, unknown> = {
    passportCode: user.passportCode,
    consentGranted: true,
    consentScopes: consent.scopes,
  };

  if (scopes.has('identity')) {
    response.identity = {
      displayName: user.displayName || user.email.split('@')[0],
      email: user.email,
      passportCode: user.passportCode,
      verified: user.identityVerified,
      reputationScore: user.reputationScore,
      memberSince: user.createdAt.toISOString(),
    };
  }

  if (scopes.has('wishlist')) {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: 'asc' }, { addedAt: 'desc' }],
    });
    response.wishlist = items.map((w) => ({
      gameTitle: w.gameTitle,
      priority: w.priority,
      notes: w.notes || undefined,
    }));
  }

  if (scopes.has('library')) {
    response.library = parseLibrary(user.gameLibrary);
  }

  if (scopes.has('badges') || scopes.has('reputation')) {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: user.id, revokedAt: null },
      include: { badge: true },
      orderBy: { issuedAt: 'desc' },
    });
    response.badges = userBadges.map((ub) => ({
      name: ub.badge.name,
      emoji: ub.badge.iconEmoji || '🏅',
      color: ub.badge.color,
      issuerName: ub.badge.issuerName || undefined,
    }));
  }

  if (scopes.has('points')) {
    const entries = await prisma.pointsLedger.findMany({
      where: { userId: user.id, storeId: entity.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const balance = entries[0]?.balance ?? 0;
    response.points = {
      balance,
      recentTransactions: entries.map((e) => ({
        amount: e.amount,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  return NextResponse.json(response);
}

const LIBRARY_PREVIEW_LIMIT = 100;

interface LibraryEntry { title: string; bggId?: number; tags?: string[] }

function parseLibrary(raw: string | null): LibraryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g): g is { title: string; bggId?: number; tags?: string[] } =>
        !!g && typeof g === 'object' && typeof (g as { title?: unknown }).title === 'string')
      .slice(0, LIBRARY_PREVIEW_LIMIT)
      .map((g) => ({ title: g.title, bggId: g.bggId, tags: g.tags }));
  } catch {
    return [];
  }
}
