import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { authenticateApiRequest } from '@/lib/oauth/api-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/library/update — Update the user's game library.
 *
 * Auth: session (Passport UI) OR ServerKey (client apps like HQ).
 * Body: { games: Array<{ title, slug?, bggId?, tags? }> }
 * Replaces the entire library.
 */
export async function POST(request: NextRequest) {
  // Try session auth first (Passport UI), then API auth (HQ/third-party)
  let userId: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    const apiAuth = await authenticateApiRequest(request);
    if (apiAuth) userId = apiAuth.userId;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { games: Array<{ title: string; slug?: string; bggId?: number; tags?: string[] }> };
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
    bggId: g.bggId || undefined,
    tags: g.tags || undefined,
    addedAt: new Date().toISOString(),
  }));

  await prisma.user.update({
    where: { id: userId },
    data: { gameLibrary: JSON.stringify(library) },
  });

  return NextResponse.json({ count: library.length });
}
