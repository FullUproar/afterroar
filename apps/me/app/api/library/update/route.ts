import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/library/update — Update the user's game library.
 *
 * Body: { games: Array<{ title, slug?, own?, bring?, love?, nope? }> }
 * Replaces the entire library (client sends the full list).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { games: Array<{ title: string; slug?: string; own?: boolean; bring?: boolean; love?: boolean; nope?: boolean }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!Array.isArray(body.games)) {
    return NextResponse.json({ error: 'games must be an array' }, { status: 400 });
  }

  const library = body.games.map((g) => ({
    name: g.title,
    title: g.title,
    slug: g.slug || undefined,
    own: g.own ?? true,
    bring: g.bring ?? false,
    love: g.love ?? false,
    nope: g.nope ?? false,
    addedAt: new Date().toISOString(),
  }));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { gameLibrary: JSON.stringify(library) },
  });

  return NextResponse.json({ count: library.length });
}
