import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

/**
 * GET /api/admin/invites
 *
 * Admin-only — lists pending + recent invite requests and the most
 * recently minted invite codes.
 *
 *   ?status=pending  → filter requests
 *   ?limit=N (default 50)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50) || 50));

  const [requests, codes, counts] = await Promise.all([
    prisma.inviteRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.inviteRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const statusCounts = counts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {});

  return NextResponse.json({
    requests,
    codes,
    statusCounts,
  });
}

/**
 * POST /api/admin/invites
 *
 * Mint a standalone invite code (not tied to a specific request).
 * Used for campaign blasts, booth handouts, 1:1 invites.
 *
 * Body: {
 *   batch?: string,
 *   maxUses?: number (default 1),
 *   expiresInDays?: number,
 *   notes?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { batch?: string; maxUses?: number; expiresInDays?: number; notes?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const maxUses = Math.max(1, Number(body.maxUses ?? 1) || 1);
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + Number(body.expiresInDays) * 24 * 60 * 60 * 1000)
    : null;

  const code = mintCode();
  const invite = await prisma.inviteCode.create({
    data: {
      code,
      batch: body.batch?.trim() || null,
      maxUses,
      expiresAt,
      notes: body.notes?.trim() || null,
      createdById: session.user.id ?? null,
    },
  });

  return NextResponse.json({ ok: true, invite });
}

/**
 * Generate a friendly invite code, e.g. "AFTERROAR-7XQ4M".
 * Avoids ambiguous chars (O, 0, I, 1, L) for fewer "I typed it wrong"
 * support tickets.
 */
function mintCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `AFTERROAR-${suffix}`;
}
