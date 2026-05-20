/**
 * GET /api/v1/auth/whoami
 *
 * Cross-app session probe. When a user lands on HQ or the FU site
 * without a local session, the consumer app calls this endpoint with
 * credentials: 'include' to check whether the user is already signed
 * in at afterroar.me (different TLD, separate cookie scope). If yes,
 * the consumer app offers a "Continue as Annika" prompt instead of
 * forcing re-auth — see project_auth_passport_native_2026_05_20.md.
 *
 * Auth: uses the user's own NextAuth session cookie. No API key. This
 * is intentional: the endpoint reads the requester's identity from
 * their browser, not from a server-to-server credential. The CORS
 * surface is limited to first-party origins below.
 *
 * Behavior:
 *   - Signed in at afterroar.me → 200 { user: ProjectedUser, signed_in: true }
 *   - Not signed in              → 200 { signed_in: false }
 *
 * Always 200 — consumer apps probe this on every cold load and we
 * don't want a 401 polluting their console.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

const ALLOWED_ORIGINS = new Set([
  "https://www.fulluproar.com",
  "https://fulluproar.com",
  "https://hq.fulluproar.com",
  "https://www.afterroar.store",
  // Local development hosts. NODE_ENV checked below so prod doesn't
  // accidentally accept these.
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    (process.env.NODE_ENV !== "production" || !origin.startsWith("http://localhost"))
      ? ALLOWED_ORIGINS.has(origin)
      : false;
  if (!allowed) {
    return { Vary: "Origin" };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ signed_in: false }, { headers });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      passportCode: true,
      identityVerified: true,
      membershipTier: true,
      emailVerified: true,
    },
  });

  if (!user) {
    // Session points at a deleted user. Treat as signed-out.
    return NextResponse.json({ signed_in: false }, { headers });
  }

  return NextResponse.json(
    {
      signed_in: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        username: user.username,
        avatar_url: user.avatarUrl,
        passport_code: user.passportCode,
        identity_verified: user.identityVerified,
        membership_tier: user.membershipTier,
        email_verified: user.emailVerified !== null,
      },
    },
    { headers },
  );
}
