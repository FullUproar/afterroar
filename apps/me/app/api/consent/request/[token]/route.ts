import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { audit, clientIp } from '@/lib/audit';

/**
 * GET  /api/consent/request/[token] — preview (entity, scopes, status)
 * POST /api/consent/request/[token] — authenticated user accepts
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await prisma.entityConsentRequest.findUnique({ where: { token } });
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const entity = await prisma.afterroarEntity.findUnique({ where: { id: req.entityId } });
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

  const expired = req.expiresAt < new Date();
  const claimed = !!req.claimedAt;

  return NextResponse.json({
    entity: {
      name: entity.name,
      slug: entity.slug,
      type: entity.type,
      city: entity.city,
      state: entity.state,
      logoUrl: entity.logoUrl,
    },
    requestedScopes: req.requestedScopes,
    note: req.note,
    expiresAt: req.expiresAt.toISOString(),
    expired,
    claimed,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const req = await prisma.entityConsentRequest.findUnique({ where: { token } });
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (req.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Request expired' }, { status: 410 });
  }
  if (req.claimedAt) {
    return NextResponse.json({ error: 'Request already used' }, { status: 409 });
  }

  const userId = session.user.id as string;

  const consent = await prisma.$transaction(async (tx) => {
    const result = await tx.entityConsent.upsert({
      where: { userId_entityId: { userId, entityId: req.entityId } },
      create: {
        userId,
        entityId: req.entityId,
        scopes: req.requestedScopes,
        source: `consent-request:${token}`,
      },
      update: {
        scopes: req.requestedScopes,
        revokedAt: null,
        grantedAt: new Date(),
        source: `consent-request:${token}`,
      },
    });

    await tx.entityConsentRequest.update({
      where: { id: req.id },
      data: { claimedAt: new Date(), claimedByUserId: userId },
    });

    return result;
  });

  audit({
    actorUserId: userId,
    actorEmail: session.user.email,
    actorRole: 'self',
    action: 'consent.grant',
    targetType: 'EntityConsent',
    targetId: consent.id,
    entityId: consent.entityId,
    scopesUsed: consent.scopes,
    metadata: { source: `consent-request:${token}` },
    ip: clientIp(request),
  });

  return NextResponse.json({
    ok: true,
    entityId: consent.entityId,
    scopes: consent.scopes,
  });
}
