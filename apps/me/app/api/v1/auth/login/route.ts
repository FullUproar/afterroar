/**
 * POST /api/v1/auth/login
 *
 * Server-to-server email + password verification. Consumer apps (HQ,
 * FU site) call this from their own Credentials provider so users
 * see an app-branded sign-in form, never the Passport-branded OIDC
 * redirect — see project_auth_passport_native_2026_05_20.md.
 *
 * Auth: API key with `auth:verify` scope.
 *
 * Body: {
 *   email: string,
 *   password: string,
 * }
 *
 * Responses:
 *   200 → { user: ProjectedUser, verified: true }
 *   401 → { error: "invalid_credentials" } — bad email or bad password
 *   403 → { error: "email_not_verified" } — credentials valid but email unverified
 *   400 → { error: "..." } — malformed body
 *
 * Note: the consumer app does NOT need to inspect ProjectedUser fields
 * beyond `id`, `email`, `displayName`, `avatarUrl`. The point of this
 * endpoint is "are these credentials good?" — followed by the consumer
 * app minting its own session.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";
import { compare } from "bcryptjs";

const PROJECTION = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  passportCode: true,
  identityVerified: true,
  membershipTier: true,
  emailVerified: true,
  createdAt: true,
} as const;

function projectUser(u: {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  passportCode: string | null;
  identityVerified: boolean;
  membershipTier: string;
  emailVerified: Date | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    username: u.username,
    avatar_url: u.avatarUrl,
    passport_code: u.passportCode,
    identity_verified: u.identityVerified,
    membership_tier: u.membershipTier,
    email_verified: u.emailVerified !== null,
    created_at: u.createdAt.toISOString(),
  };
}

export const POST = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...PROJECTION, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    // No such user, or user signed up via OAuth and has no password.
    // Don't leak which — consumer app shows a generic "invalid credentials"
    // message either way.
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (!user.emailVerified) {
    // Surface as a distinct error so the consumer app can offer "resend
    // verification email" instead of "your password is wrong."
    return NextResponse.json(
      { error: "email_not_verified", code: "email_not_verified" },
      { status: 403 },
    );
  }

  const { passwordHash: _omit, ...projected } = user;
  return NextResponse.json({
    user: projectUser(projected),
    verified: true,
  });
}, "auth:verify");
