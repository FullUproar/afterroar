import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/wishlist/shared?userId=xxx OR ?code=ABCD1234
 *
 * Public wishlist endpoint — no auth required. Returns a user's
 * wishlist if they have one. Used for shareable gift-giving links.
 *
 * Prefer the `code` param — it uses the user's public passport code so
 * the raw cuid never leaks. The legacy `userId` form stays for any
 * internal callers but should be migrated.
 *
 * No PII exposed — just game titles, priority, and notes.
 */
export async function GET(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get('userId');
  const codeParam = request.nextUrl.searchParams.get('code');
  if (!userIdParam && !codeParam) {
    return NextResponse.json({ error: 'userId or code required' }, { status: 400 });
  }

  const user = codeParam
    ? await prisma.user.findFirst({
        where: { passportCode: codeParam.toUpperCase() },
        select: { id: true, displayName: true, passportCode: true },
      })
    : await prisma.user.findUnique({
        where: { id: userIdParam! },
        select: { id: true, displayName: true, passportCode: true },
      });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: [{ priority: 'asc' }, { addedAt: 'desc' }],
    select: {
      gameTitle: true,
      bggId: true,
      priority: true,
      notes: true,
      addedAt: true,
    },
  });

  return NextResponse.json({
    owner: user.displayName || 'A gamer',
    items,
    count: items.length,
  }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
