import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, passwordResetTemplate } from '@/lib/email';

const TOKEN_TTL_HOURS = 1; // Short-lived; password resets need fast turnaround
const TOKEN_PREFIX = 'pwreset:'; // Distinguishes reset tokens from email-verify tokens
const SLOW_RESPONSE_MS = 250; // Equalizes response time so attackers can't time-test for valid emails

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function buildResetUrl(token: string, email: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    'https://afterroar.me';
  const url = new URL('/reset-password', base);
  url.searchParams.set('token', token);
  url.searchParams.set('email', email);
  return url.toString();
}

/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * Generates a password-reset token, persists in VerificationToken with a
 * `pwreset:` prefix on the token field so we can distinguish reset tokens
 * from email-verification tokens (same table, different purpose).
 *
 * Always returns 200 with the same generic message regardless of whether
 * the email is registered. This prevents account enumeration: an attacker
 * who probes lots of emails can't tell which ones have accounts.
 *
 * Sleep adds artificial latency so timing-based enumeration is also
 * prevented (otherwise the "send email" path takes longer than the
 * "no-op" path).
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const start = Date.now();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, accounts: { select: { provider: true } } },
  });

  // Only send a reset for users who actually have a password. OAuth-only
  // users (no passwordHash) get the same generic response but no email.
  // The reset would be a no-op for them anyway.
  if (user && user.passwordHash) {
    const token = generateToken();
    const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    // Clear any prior reset tokens for this email so old links die.
    // Email-verify tokens (different identifier prefix) are not affected.
    await prisma.verificationToken.deleteMany({
      where: { identifier: email, token: { startsWith: TOKEN_PREFIX } },
    });
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: TOKEN_PREFIX + token,
        expires,
      },
    });

    const resetUrl = buildResetUrl(token, email);
    const tpl = passwordResetTemplate({ resetUrl, email, expiresHours: TOKEN_TTL_HOURS });
    sendEmail({ to: email, ...tpl }).catch((err) =>
      console.error('[forgot-password] email send failed', err),
    );
  }

  // Equalize response time to prevent timing-based account enumeration.
  const elapsed = Date.now() - start;
  if (elapsed < SLOW_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, SLOW_RESPONSE_MS - elapsed));
  }

  return NextResponse.json({
    ok: true,
    message: 'If an account with that email exists, we sent a reset link.',
  });
}
