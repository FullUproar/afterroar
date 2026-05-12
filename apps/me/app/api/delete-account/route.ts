import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/delete-account — Begin a 30-day soft-delete of the
 * authenticated user's Passport.
 *
 * Sets `scheduledDeletionAt = now + 30d` and flips accountStatus to
 * "pending_deletion". The user can undo via POST /api/delete-account/undo
 * any time before the timer expires. A daily cron then hard-deletes
 * records whose timestamp has passed.
 *
 * Subscription cancellation lives on FU (it owns Stripe). We just mark
 * the account here; the FU webhook + nightly subscription-cancel job
 * pick up the pending_deletion status and cancel at period-end so the
 * user isn't charged again.
 *
 * Requires the user to confirm by sending their email address in the body.
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
    select: { email: true, scheduledDeletionAt: true },
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

  // Idempotent: if already pending, just return the existing timestamp.
  if (user.scheduledDeletionAt && user.scheduledDeletionAt > new Date()) {
    return NextResponse.json({
      pendingDeletion: true,
      scheduledDeletionAt: user.scheduledDeletionAt.toISOString(),
      message: 'Your account is already scheduled for deletion.',
    });
  }

  const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      scheduledDeletionAt,
      accountStatus: 'pending_deletion',
    },
  });

  return NextResponse.json({
    pendingDeletion: true,
    scheduledDeletionAt: scheduledDeletionAt.toISOString(),
    message: `Your account will be permanently deleted on ${scheduledDeletionAt.toLocaleDateString()}. You can undo this any time before then by signing in.`,
  });
}
