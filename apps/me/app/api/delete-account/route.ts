import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/delete-account — Permanently delete a user's Passport.
 *
 * Deletes: identity, consent grants, points ledger, activity history.
 * Points ledger entries are anonymized (userId set to null) for store
 * accounting integrity, not deleted outright.
 *
 * Requires the user to confirm by sending their email address in the body.
 * This is the "type to confirm" friction pattern — enough to prevent
 * accidental clicks, not enough to feel adversarial.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;

  let body: { confirmEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (body.confirmEmail?.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    return NextResponse.json(
      { error: 'Email does not match. Type your exact email to confirm deletion.' },
      { status: 400 },
    );
  }

  // Anonymize points ledger (preserve store accounting, remove user link)
  await prisma.pointsLedger.updateMany({
    where: { userId },
    data: { userId: null as unknown as string },
  });

  // Delete everything else
  await prisma.userActivity.deleteMany({ where: { userId } });
  await prisma.userConsent.deleteMany({ where: { userId } });

  // Delete auth accounts (OAuth links)
  await prisma.account.deleteMany({ where: { userId } });

  // Delete the user record itself
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ deleted: true });
}
