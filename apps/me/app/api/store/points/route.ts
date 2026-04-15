import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { audit, clientIp } from '@/lib/audit';

const VALID_ACTIONS = new Set(['earn', 'redeem', 'adjust']);
const MAX_ABS_AMOUNT = 100000;

/**
 * POST /api/store/points
 * Body: { entityId, passportCode, amount, description, action?, category? }
 *
 * Caller must be an EntityMember of an approved entity, AND the customer
 * must have granted the `points` scope to this entity. Appends to
 * PointsLedger with running balance scoped to the entity (storeId).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: {
    entityId?: string;
    passportCode?: string;
    amount?: number;
    description?: string;
    action?: string;
    category?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const entityId = body.entityId?.trim();
  const code = body.passportCode?.trim().toUpperCase();
  const amount = Number(body.amount);
  const description = body.description?.trim();
  const action = body.action || (amount >= 0 ? 'earn' : 'redeem');
  const category = body.category?.trim() || 'store';

  if (!entityId || !code || code.length !== 8) {
    return NextResponse.json({ error: 'entityId and 8-char passportCode required' }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ABS_AMOUNT) {
    return NextResponse.json({ error: 'amount must be a non-zero integer within bounds' }, { status: 400 });
  }
  if (!description || description.length > 200) {
    return NextResponse.json({ error: 'description required (≤200 chars)' }, { status: 400 });
  }
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const callerId = session.user.id as string;
  const entity = await prisma.afterroarEntity.findUnique({
    where: { id: entityId },
    include: { members: { where: { userId: callerId } } },
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
  if (
    !consent ||
    consent.revokedAt ||
    (consent.expiresAt && consent.expiresAt < new Date()) ||
    !consent.scopes.includes('points')
  ) {
    return NextResponse.json({ error: 'Customer has not granted points access' }, { status: 403 });
  }

  const entry = await prisma.$transaction(async (tx) => {
    const last = await tx.pointsLedger.findFirst({
      where: { userId: user.id, storeId: entity.id },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    });
    const prevBalance = last?.balance ?? 0;
    const newBalance = prevBalance + amount;

    if (action === 'redeem' && newBalance < 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    return tx.pointsLedger.create({
      data: {
        userId: user.id,
        storeId: entity.id,
        amount,
        balance: newBalance,
        action,
        category,
        description,
        metadata: JSON.stringify({ issuedBy: callerId, entitySlug: entity.slug }),
      },
    });
  }).catch((err: Error) => {
    if (err.message === 'INSUFFICIENT_BALANCE') return null;
    throw err;
  });

  if (!entry) {
    return NextResponse.json({ error: 'Insufficient points balance' }, { status: 400 });
  }

  audit({
    actorUserId: callerId,
    actorEmail: session.user.email,
    actorRole: 'entity_member',
    action: `points.${entry.action}`,
    targetType: 'User',
    targetId: user.id,
    entityId: entity.id,
    scopesUsed: ['points'],
    metadata: { amount: entry.amount, balance: entry.balance },
    ip: clientIp(request),
  });

  return NextResponse.json({
    ok: true,
    transactionId: entry.id,
    amount: entry.amount,
    balance: entry.balance,
    action: entry.action,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  }, { status: 201 });
}
