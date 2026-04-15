import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { filterValidScopes } from '@/lib/connect-scopes';

const TTL_MINUTES = 15;

/**
 * POST /api/store/consent-request
 * Body: { entityId, scopes: string[], note?: string }
 *
 * Caller must be an EntityMember of the entity. Returns a one-time token
 * the customer can scan/visit to approve sharing the requested scopes.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { entityId?: string; scopes?: string[]; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 });
  }

  const scopes = Array.from(new Set(filterValidScopes(body.scopes)));
  if (scopes.length === 0) {
    return NextResponse.json({ error: 'At least one valid scope required' }, { status: 400 });
  }

  const entity = await prisma.afterroarEntity.findUnique({
    where: { id: body.entityId },
    include: { members: { where: { userId: session.user.id as string } } },
  });
  if (!entity || entity.members.length === 0) {
    return NextResponse.json({ error: 'Not a member of this entity' }, { status: 403 });
  }
  if (entity.status !== 'approved') {
    return NextResponse.json({ error: 'Entity is not approved' }, { status: 403 });
  }

  const token = randomBytes(12).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  const req = await prisma.entityConsentRequest.create({
    data: {
      token,
      entityId: entity.id,
      requestedScopes: scopes,
      createdBy: session.user.id as string,
      expiresAt,
      note: body.note?.trim() || null,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://afterroar.me';
  const url = `${baseUrl.replace(/\/$/, '')}/connect/${token}`;

  return NextResponse.json({
    token: req.token,
    url,
    expiresAt: req.expiresAt.toISOString(),
    expiresInSeconds: TTL_MINUTES * 60,
  }, { status: 201 });
}
