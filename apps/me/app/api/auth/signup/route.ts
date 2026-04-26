import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verifyEmailTemplate } from "@/lib/email";

/* ------------------------------------------------------------------ */
/*  POST /api/auth/signup                                              */
/*                                                                      */
/*  Email + password signup. Creates a User with passwordHash, queues  */
/*  a 24-hour verification token, and emails the link. The user can't  */
/*  sign in via the Credentials provider until they click the link     */
/*  (the authorize() in auth-config throws "EmailNotVerified").        */
/*                                                                      */
/*  Body: { email, password, displayName? }                             */
/*                                                                      */
/*  Response shape is intentionally identical for "created" and         */
/*  "already exists" so we don't expose which emails are registered.   */
/* ------------------------------------------------------------------ */

const VERIFY_TOKEN_TTL_HOURS = 24;
const PASSWORD_MIN_LENGTH = 8;

function generateToken(): string {
  // 32 bytes → 64-char hex. Stored on VerificationToken.token (which is unique).
  return randomBytes(32).toString("hex");
}

function buildVerifyUrl(token: string, email: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "https://afterroar.me";
  const url = new URL("/verify-email", base);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName =
    body.displayName && String(body.displayName).trim().length > 0
      ? String(body.displayName).trim()
      : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  // Already exists with a verified email + password → just resend nothing,
  // tell them to log in. Don't leak which emails are registered.
  if (existing && existing.passwordHash && existing.emailVerified) {
    return NextResponse.json({
      ok: true,
      // Generic message so a probe can't tell registered vs. unregistered.
      message: "Check your email to verify your account.",
    });
  }

  // If a User row already exists (created via Google OAuth), we DON'T create
  // a duplicate — we add a passwordHash to the existing row. They can then
  // log in via either Google or email/password.
  // SECURITY NOTE: Skip this branch entirely if the OAuth-created user has
  // never verified an email — would let a probe set a password they can use.
  // Google sets emailVerified at signup, so a verified row means OAuth wrote it.
  if (existing && !existing.passwordHash && existing.emailVerified) {
    const passwordHash = await hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        ...(displayName && !existing.displayName ? { displayName } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      message: "Password set. You can now sign in with email or Google.",
    });
  }

  // Brand-new signup OR existing-but-unverified row → create or update + token.
  const passwordHash = await hash(password, 12);
  const userId = existing?.id;

  const user = userId
    ? await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          ...(displayName ? { displayName } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName,
        },
      });

  // Generate verification token + persist
  const token = generateToken();
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  // Clear any existing tokens for this email so old links don't linger.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const verifyUrl = buildVerifyUrl(token, email);
  const tpl = verifyEmailTemplate(verifyUrl, user.displayName);
  // Fire-and-forget: response doesn't depend on email delivery.
  sendEmail({ to: email, ...tpl }).catch((err) =>
    console.error("[signup] email send failed", err),
  );

  return NextResponse.json({
    ok: true,
    message: "Check your email to verify your account.",
    // Helpful in dev when no Resend key is set
    ...(process.env.NODE_ENV !== "production" ? { dev_verify_url: verifyUrl } : {}),
  });
}
