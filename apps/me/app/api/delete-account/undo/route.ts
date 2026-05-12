import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/delete-account/undo — Reverse a pending soft-delete.
 *
 * Clears scheduledDeletionAt and flips accountStatus back to "active"
 * (or "pending_parent" for kids still waiting on consent). Only works
 * while the original deletion window is still in the future.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { scheduledDeletionAt: true, parentUserId: true, parentVerifiedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!user.scheduledDeletionAt) {
    return NextResponse.json({
      cancelled: false,
      message: 'Your account isn\'t scheduled for deletion.',
    });
  }
  if (user.scheduledDeletionAt <= new Date()) {
    return NextResponse.json(
      { error: 'Deletion already executed.' },
      { status: 410 },
    );
  }

  // A minor account whose parent never finished consent should land back
  // in "pending_parent", not "active".
  const restoredStatus =
    user.parentUserId && !user.parentVerifiedAt ? 'pending_parent' : 'active';

  await prisma.user.update({
    where: { id: userId },
    data: {
      scheduledDeletionAt: null,
      accountStatus: restoredStatus,
    },
  });

  return NextResponse.json({
    cancelled: true,
    message: 'Account restored. Welcome back.',
  });
}
