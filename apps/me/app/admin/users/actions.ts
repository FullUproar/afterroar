'use server';

import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { sendEmail, verifyEmailTemplate } from '@/lib/email';
import { assignPassportCode } from '@/lib/passport-code';

const VERIFY_TOKEN_TTL_HOURS = 24;

function buildVerifyUrl(token: string, email: string): string {
  const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://afterroar.me';
  const url = new URL('/verify-email', base);
  url.searchParams.set('token', token);
  url.searchParams.set('email', email);
  return url.toString();
}

export async function verifyUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
  revalidatePath('/admin/users');
}

export async function unverifyUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: null },
  });
  revalidatePath('/admin/users');
}

export async function banUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isFrozen: true, accountStatus: 'suspended' },
  });
  revalidatePath('/admin/users');
}

export async function unbanUser(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isFrozen: false, accountStatus: 'active' },
  });
  revalidatePath('/admin/users');
}

export async function deleteUser(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return;
  // Cascade related rows that aren't FK-cascaded automatically.
  await prisma.minorConsentRequest.deleteMany({
    where: { OR: [{ childEmail: user.email }, { parentEmail: user.email }] },
  });
  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
  await prisma.user.delete({ where: { id: userId } });
  // NOTE: FU snapshot User row (full-uproar-site DB) is NOT touched here.
  // Cross-DB cleanup needs the Connect API key pattern flowing the other
  // direction; queued for a future build. For now, FU-side orphans are
  // harmless (just unused snapshot data).
  revalidatePath('/admin/users');
}

export async function resendVerificationEmail(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, emailVerified: true },
  });
  if (!user) return { ok: false, error: 'User not found' };
  if (user.emailVerified) return { ok: false, error: 'User is already verified' };

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  // Delete prior verify-email tokens for this address (not pwreset:/signin:
  // tokens — those serve different flows).
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
  await requireAdmin();

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

  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return { ok: false, error: 'Email or username already taken' };
    }
    throw err;
  }
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
  await requireAdmin();

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
  });

  await assignPassportCode(created.id).catch((err) =>
    console.error('[admin/createUser] assignPassportCode failed', err),
  );

  revalidatePath('/admin/users');
  return { ok: true, userId: created.id };
}
