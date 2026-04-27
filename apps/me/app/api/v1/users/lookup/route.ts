/**
 * POST /api/v1/users/lookup
 *
 * Batch user resolution. Body: `{ ids: string[] }` (max 100 per request).
 * Returns: `{ users: PassportUser[] }` — same projection as single-user GET.
 * Missing IDs are silently dropped from the response (no error).
 *
 * Scope: read:users
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

const MAX_BATCH = 100;

export const POST = withApiKey<Record<string, never>>(
  async (req: NextRequest) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const ids = (body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json(
        { error: "Body must be { ids: string[] }" },
        { status: 400 },
      );
    }
    if (ids.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Max ${MAX_BATCH} ids per request` },
        { status: 400 },
      );
    }
    if (ids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids as string[] } },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        passportCode: true,
        identityVerified: true,
        membershipTier: true,
      },
    });
    return NextResponse.json({ users });
  },
  "read:users",
);
