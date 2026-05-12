import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';

/**
 * POST /api/settings/unlink-account
 *
 * Removes an OAuth provider link from the signed-in user's Account
 * rows. Refuses to unlink if doing so would lock the user out — i.e.
 * the user has no passwordHash AND this is their only remaining
 * provider. Without that guard a Google-only user could click Unlink
 * and have no path back into their account.
 *
 * Body: { provider: 'google' }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const provider = String(body.provider ?? '').trim().toLowerCase();
  if (provider !== 'google') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const userId = session.user.id;
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
    prisma.account.findMany({ where: { userId }, select: { id: true, provider: true } }),
  ]);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const targetAccounts = accounts.filter((a) => a.provider === provider);
  if (targetAccounts.length === 0) {
    return NextResponse.json({ error: 'Not linked' }, { status: 404 });
  }

  const hasPassword = Boolean(user.passwordHash);
  const otherProviders = accounts.filter((a) => a.provider !== provider);
  if (!hasPassword && otherProviders.length === 0) {
    return NextResponse.json(
      { error: 'Set a password first — unlinking would lock you out.' },
      { status: 409 },
    );
  }

  await prisma.account.deleteMany({
    where: { userId, provider },
  });

  await logUserActivity({
    userId,
    action: 'auth.oauth_unlink',
    metadata: { provider },
  });

  return NextResponse.json({ ok: true });
}
