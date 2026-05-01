import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushVerifiedCountToSmiirl } from "@/lib/smiirl";

// GET /api/cron/users-audit
//
// Diagnostic. Same Bearer CRON_SECRET as the other cron endpoints.
// Lists the most recent 20 user records with their verified status and
// signup path so we can spot which signups didn't bump the Smiirl
// counter (emailVerified IS NULL → not counted).
//
// POST /api/cron/users-audit
// One-shot backfill: marks all OAuth users (no passwordHash) whose
// emailVerified is null as verified-at-createdAt. Necessary because
// NextAuth v5 strips emailVerified from the profile() return value
// before reaching adapter.createUser, so OAuth signups before the
// adapter-fix landed have null. Pushes the Smiirl after.
//
// Should be removed once the existing OAuth-without-password records
// are cleaned up and the adapter-fix is verified.

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      createdAt: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
      passportCode: true,
    },
  });

  const verifiedCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });
  const totalCount = await prisma.user.count();

  return NextResponse.json({
    totalCount,
    verifiedCount,
    users: users.map((u) => ({
      created: u.createdAt,
      email: u.email,
      verified: u.emailVerified ? u.emailVerified : null,
      path: u.passwordHash ? "credentials" : "oauth",
      passportCode: u.passportCode,
    })),
  });
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Backfill: OAuth users (no password) who completed signup (have a
  // passportCode — assigned by events.createUser) but emailVerified is
  // still null. This filter excludes test, deleted, and incomplete
  // signups that pre-date the passportCode feature.
  const orphans = await prisma.user.findMany({
    where: {
      emailVerified: null,
      passwordHash: null,
      passportCode: { not: null },
    },
    select: { id: true, createdAt: true, email: true },
  });

  await prisma.$transaction(
    orphans.map((u) =>
      prisma.user.update({
        where: { id: u.id },
        data: { emailVerified: u.createdAt },
      })
    )
  );

  const verifiedCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  // Push the new count to the Smiirl. Fire-and-forget would normally
  // suit; here we await so the response includes the result.
  const pushResult = await pushVerifiedCountToSmiirl();

  return NextResponse.json({
    backfilled: orphans.length,
    verifiedCount,
    smiirl: pushResult,
  });
}
