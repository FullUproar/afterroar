import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST   /api/integrations/shopify/settings — update points-per-dollar / min-order
 * DELETE /api/integrations/shopify/settings — disconnect (mark inactive)
 *
 * Caller must be an EntityMember of the entity owning the connection.
 */

async function getEntityForCaller(entitySlug: string, callerId: string) {
  const entity = await prisma.afterroarEntity.findUnique({
    where: { slug: entitySlug },
    include: { members: { where: { userId: callerId } } },
  });
  if (!entity || entity.members.length === 0) return null;
  return entity;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  let body: { entitySlug?: string; pointsPerDollar?: number; minOrderCents?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body.entitySlug) return NextResponse.json({ error: 'entitySlug required' }, { status: 400 });

  const callerId = session.user!.id as string;
  const entity = await getEntityForCaller(body.entitySlug, callerId);
  if (!entity) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const pointsPerDollar = clampInt(body.pointsPerDollar, 0, 1000, 1);
  const minOrderCents = clampInt(body.minOrderCents, 0, 1_000_000, 0);

  const updated = await prisma.shopifyConnection.update({
    where: { entityId: entity.id },
    data: { pointsPerDollar, minOrderCents },
    select: { pointsPerDollar: true, minOrderCents: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  let body: { entitySlug?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!body.entitySlug) return NextResponse.json({ error: 'entitySlug required' }, { status: 400 });

  const callerId = session.user!.id as string;
  const entity = await getEntityForCaller(body.entitySlug, callerId);
  if (!entity) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  await prisma.shopifyConnection.updateMany({
    where: { entityId: entity.id },
    data: { active: false, uninstalledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
