/**
 * POST /api/v1/auth/google-exchange
 *
 * Server-to-server Google OIDC token exchange. The consumer app (HQ,
 * FU site) handles Google OAuth on its own NextAuth side, then hands
 * Google's id_token to this endpoint. Passport verifies the token,
 * finds-or-creates the canonical user, returns the user. Consumer
 * app mints its own session and never visibly bounces through the
 * Passport-branded sign-in screen — see
 * project_auth_passport_native_2026_05_20.md.
 *
 * Auth: API key with `auth:google-exchange` scope.
 *
 * Body: {
 *   id_token: string,  // The id_token from Google's OAuth response.
 *   source?: string,   // "hq.fulluproar.com" / "fulluproar.com" / etc.
 * }
 *
 * Responses:
 *   200 → { user: ProjectedUser, created: boolean }
 *   400 → { error: "..." } — malformed body or invalid token
 *   401 → { error: "invalid_token" } — Google JWT verification failed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface GoogleExchangeBody {
  id_token?: string;
  source?: string;
}

// Google's standard JWKS endpoint for id_token signatures. Keys rotate
// every few weeks; jose caches them. The audience (your Google OAuth
// client_id) is enforced below.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

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
  let body: GoogleExchangeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id_token) {
    return NextResponse.json({ error: "id_token is required" }, { status: 400 });
  }

  // Verify the Google JWT. We accept any audience from the configured
  // env list — typically there's one Google OAuth client shared across
  // all first-party Afterroar properties, but we allow a comma-separated
  // GOOGLE_AUDIENCES list so each consumer can have its own client if
  // needed. issuer is fixed.
  const audiences = (process.env.GOOGLE_AUDIENCES || process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (audiences.length === 0) {
    console.error("[auth/google-exchange] no GOOGLE_AUDIENCES or GOOGLE_CLIENT_ID configured");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let claims: { email?: string; email_verified?: boolean; name?: string; picture?: string; sub?: string };
  try {
    const { payload } = await jwtVerify(body.id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: audiences,
    });
    claims = payload as typeof claims;
  } catch (err) {
    console.warn("[auth/google-exchange] token verification failed:", err);
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "google_token_missing_email" }, { status: 400 });
  }
  if (!claims.email_verified) {
    // Google's `email_verified: false` means the account was created
    // but the address wasn't confirmed. Don't bind a Passport user to
    // an unverified Google address — that's account-takeover surface.
    return NextResponse.json({ error: "google_email_not_verified" }, { status: 401 });
  }

  // Find or create. Existing Passport user with this email = sign-in.
  // No existing user = mint one. Either way, mark emailVerified since
  // Google has already confirmed the address (saves the verification
  // round-trip on first sign-in).
  const existing = await prisma.user.findUnique({
    where: { email },
    select: PROJECTION,
  });
  if (existing) {
    // Backfill avatar + display name if missing — google has them and we don't.
    const updates: { displayName?: string; avatarUrl?: string; emailVerified?: Date } = {};
    if (!existing.displayName && claims.name) updates.displayName = claims.name;
    if (!existing.avatarUrl && claims.picture) updates.avatarUrl = claims.picture;
    if (!existing.emailVerified) updates.emailVerified = new Date();
    if (Object.keys(updates).length > 0) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: updates,
        select: PROJECTION,
      });
      return NextResponse.json({ user: projectUser(updated), created: false });
    }
    return NextResponse.json({ user: projectUser(existing), created: false });
  }

  const created = await prisma.user.create({
    data: {
      email,
      displayName: claims.name?.trim() || null,
      avatarUrl: claims.picture ?? null,
      emailVerified: new Date(),
      // passwordHash stays null — user is OAuth-only until they set one.
    },
    select: PROJECTION,
  });
  return NextResponse.json({ user: projectUser(created), created: true }, { status: 201 });
}, "auth:google-exchange");
