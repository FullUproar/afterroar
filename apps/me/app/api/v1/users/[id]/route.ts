/**
 * GET /api/v1/users/:id
 *
 * Server-to-server lookup of a single Passport user.
 * Returns the same minimal projection used by the batch lookup endpoint.
 *
 * Scope: read:users
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey<{ id: string }>(
  async (_req: NextRequest, { params }) => {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
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
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  },
  "read:users",
);
