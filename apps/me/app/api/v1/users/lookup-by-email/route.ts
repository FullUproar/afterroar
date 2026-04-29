/**
 * POST /api/v1/users/lookup-by-email
 *
 * Companion to /api/v1/users/lookup. Resolves Passport user IDs from a
 * batch of emails. Used by FU's backfill script to figure out which
 * existing local Users already correspond to Passport accounts vs which
 * need a fresh mint.
 *
 * Body: { emails: string[] }  (max 100)
 * Response: { users: { email, id }[] }  — only matches; misses are dropped.
 *
 * Scope: read:users
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiKey } from "@/lib/api-middleware";

const MAX_BATCH = 100;

export const POST = withApiKey<Record<string, never>>(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const emails = (body as { emails?: unknown })?.emails;
  if (!Array.isArray(emails) || !emails.every((e) => typeof e === "string")) {
    return NextResponse.json(
      { error: "Body must be { emails: string[] }" },
      { status: 400 },
    );
  }
  if (emails.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Max ${MAX_BATCH} emails per request` },
      { status: 400 },
    );
  }
  if (emails.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const normalized = (emails as string[]).map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0);
  if (normalized.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const matches = await prisma.user.findMany({
    where: { email: { in: normalized } },
    select: { id: true, email: true },
  });

  return NextResponse.json({
    users: matches.map((u) => ({ email: u.email, id: u.id })),
  });
}, "read:users");
