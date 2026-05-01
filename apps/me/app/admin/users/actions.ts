'use server';

import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { sendEmail, verifyEmailTemplate } from '@/lib/email';
import { assignPassportCode } from '@/lib/passport-code';
import { logAdminAction, userAuditSnapshot } from '@/lib/admin-audit';

const VERIFY_TOKEN_TTL_HOURS = 24;
const AUDIT_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  membershipTier: true,
  emailVerified: true,
  identityVerified: true,
  isFrozen: true,
  accountStatus: true,
  defaultVisibility: true,
  isMinor: true,
  parentUserId: true,
} as const;

function buildVerifyUrl(token: string, email: string): string {
  const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://afterroar.me';
  const url = new URL('/verify-email', base);
  url.searchParams.set('token', token);
  url.searchParams.set('email', email);
  return url.toString();
}

export async function verifyUser(userId: string) {
  const session = await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!before) return;
  const after = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
    select: AUDIT_USER_SELECT,
  });
  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.verify',
    targetId: userId,
    beforeState: userAuditSnapshot(before),
    afterState: userAuditSnapshot(after),
  });
  revalidatePath('/admin/users');
}

export async function unverifyUser(userId: string) {
  const session = await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!before) return;
  const after = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: null },
    select: AUDIT_USER_SELECT,
  });
  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.unverify',
    targetId: userId,
    beforeState: userAuditSnapshot(before),
    afterState: userAuditSnapshot(after),
  });
  revalidatePath('/admin/users');
}

export async function banUser(userId: string) {
  const session = await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!before) return;
  const after = await prisma.user.update({
    where: { id: userId },
    data: { isFrozen: true, accountStatus: 'suspended' },
    select: AUDIT_USER_SELECT,
  });
  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.ban',
    targetId: userId,
    beforeState: userAuditSnapshot(before),
    afterState: userAuditSnapshot(after),
  });
  revalidatePath('/admin/users');
}

export async function unbanUser(userId: string) {
  const session = await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!before) return;
  const after = await prisma.user.update({
    where: { id: userId },
    data: { isFrozen: false, accountStatus: 'active' },
    select: AUDIT_USER_SELECT,
  });
  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.unban',
    targetId: userId,
    beforeState: userAuditSnapshot(before),
    afterState: userAuditSnapshot(after),
  });
  revalidatePath('/admin/users');
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!user) return;

  await prisma.minorConsentRequest.deleteMany({
    where: { OR: [{ childEmail: user.email! }, { parentEmail: user.email! }] },
  });
  await prisma.verificationToken.deleteMany({ where: { identifier: user.email! } });
  await prisma.user.delete({ where: { id: userId } });
  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.delete',
    targetId: userId,
    beforeState: userAuditSnapshot(user),
    afterState: null,
  });
  // NOTE: FU snapshot User row (full-uproar-site DB) is NOT touched here.
  // Cross-DB cleanup is queued for a future build using the Connect API
  // pattern in the other direction. FU-side orphans are harmless.
  revalidatePath('/admin/users');
}

export async function resendVerificationEmail(userId: string) {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, emailVerified: true },
  });
  if (!user) return { ok: false, error: 'User not found' };
  if (user.emailVerified) return { ok: false, error: 'User is already verified' };

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: user.email,
      NOT: [
        { token: { startsWith: 'pwreset:' } },
        { token: { startsWith: 'signin:' } },
      ],
    },
  });
  await prisma.verificationToken.create({
    data: { identifier: user.email, token, expires },
  });

  const verifyUrl = buildVerifyUrl(token, user.email);
  const tpl = verifyEmailTemplate(verifyUrl, user.displayName);
  const sent = await sendEmail({ to: user.email, ...tpl });

  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.resend_verification',
    targetId: userId,
    afterState: { sent, recipient: user.email },
  });

  return sent
    ? { ok: true }
    : { ok: false, error: 'Email send failed (check Vercel logs for Resend error)' };
}

interface UpdateUserInput {
  displayName?: string | null;
  username?: string | null;
  email?: string;
  membershipTier?: string;
  identityVerified?: boolean;
  isFrozen?: boolean;
  accountStatus?: string;
  defaultVisibility?: string;
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const session = await requireAdmin();
  const before = await prisma.user.findUnique({ where: { id: userId }, select: AUDIT_USER_SELECT });
  if (!before) return { ok: false, error: 'User not found' };

  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName?.trim() || null;
  if (input.username !== undefined) data.username = input.username?.trim() || null;
  if (input.email !== undefined) {
    const e = input.email.trim().toLowerCase();
    if (!e.includes('@')) return { ok: false, error: 'Invalid email' };
    data.email = e;
  }
  if (input.membershipTier !== undefined) data.membershipTier = input.membershipTier;
  if (input.identityVerified !== undefined) data.identityVerified = input.identityVerified;
  if (input.isFrozen !== undefined) data.isFrozen = input.isFrozen;
  if (input.accountStatus !== undefined) data.accountStatus = input.accountStatus;
  if (input.defaultVisibility !== undefined) data.defaultVisibility = input.defaultVisibility;

  let after;
  try {
    after = await prisma.user.update({ where: { id: userId }, data, select: AUDIT_USER_SELECT });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return { ok: false, error: 'Email or username already taken' };
    }
    throw err;
  }

  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.update',
    targetId: userId,
    beforeState: userAuditSnapshot(before),
    afterState: userAuditSnapshot(after),
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

interface CreateUserInput {
  email: string;
  displayName?: string | null;
  password?: string | null;
  membershipTier?: string;
  markVerified?: boolean;
  identityVerified?: boolean;
}

export async function createUser(input: CreateUserInput) {
  const session = await requireAdmin();

  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, error: 'Invalid email' };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: 'A user with that email already exists' };

  const passwordHash = input.password ? await hash(input.password, 12) : null;

  const created = await prisma.user.create({
    data: {
      email,
      displayName: input.displayName?.trim() || null,
      passwordHash,
      emailVerified: input.markVerified ? new Date() : null,
      identityVerified: input.identityVerified ?? false,
      membershipTier: input.membershipTier || 'FREE',
      isMinor: false,
      defaultVisibility: 'public',
    },
    select: AUDIT_USER_SELECT,
  });

  await assignPassportCode(created.id).catch((err) =>
    console.error('[admin/createUser] assignPassportCode failed', err),
  );

  await logAdminAction({
    adminUserId: session.user!.id as string,
    action: 'user.create',
    targetId: created.id,
    beforeState: null,
    afterState: userAuditSnapshot(created),
  });

  revalidatePath('/admin/users');
  return { ok: true, userId: created.id };
}
