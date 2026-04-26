import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { sendEmail, claimVerifyTemplate } from "@/lib/email";

/* ------------------------------------------------------------------ */
/*  POST /api/entities/[slug]/claim                                    */
/*                                                                      */
/*  Initiate a claim on an unclaimed AfterroarEntity. The signed-in    */
/*  user submits the contact email they own at the store; we send a   */
/*  verification link to that email. Clicking the link consumes the   */
/*  token, flips the entity status to "active", and adds the user as  */
/*  the first EntityMember with role=owner.                            */
/*                                                                      */
/*  Body: { contactEmail, contactName?, contactPhone?, evidence? }    */
/*                                                                      */
/*  Domain match shortcut: if the submitted email's domain matches    */
/*  the entity's websiteUrl host, we still send the email (proof of   */
/*  control) but the email is more trusted — review queue priority.   */
/* ------------------------------------------------------------------ */

const CLAIM_TOKEN_TTL_HOURS = 72;

function makeToken(): string {
  return randomBytes(32).toString("hex");
}

function buildVerifyUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "https://afterroar.me";
  return `${base.replace(/\/$/, "")}/claim/verify?token=${token}`;
}

function emailDomainMatches(email: string, websiteUrl: string | null | undefined): boolean {
  if (!websiteUrl) return false;
  try {
    const emailDomain = email.split("@")[1]?.toLowerCase().trim();
    if (!emailDomain) return false;
    const url = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
    const siteHost = url.hostname.toLowerCase().replace(/^www\./, "");
    return emailDomain === siteHost || emailDomain.endsWith(`.${siteHost}`);
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to claim a store." },
      { status: 401 },
    );
  }

  const { slug } = await params;
  let body: {
    contactEmail?: string;
    contactName?: string;
    contactPhone?: string;
    evidence?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
  if (!contactEmail || !contactEmail.includes("@")) {
    return NextResponse.json(
      { error: "A valid contact email is required." },
      { status: 400 },
    );
  }

  // Lazy-promote: the public /stores/[slug] page reads from the Venue
  // directory table. AfterroarEntity is the canonical identity record we
  // need for membership + claim. If the Venue exists but no Entity does
  // yet, create one mirroring Venue data with status="unclaimed" so the
  // claim flow has something to work against.
  let entity = await prisma.afterroarEntity.findUnique({ where: { slug } });
  if (!entity) {
    const venue = await prisma.venue.findUnique({ where: { slug } });
    if (!venue) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }
    entity = await prisma.afterroarEntity.create({
      data: {
        slug: venue.slug,
        name: venue.name,
        type: "store",
        status: "unclaimed",
        contactEmail: venue.email,
        contactPhone: venue.phone,
        websiteUrl: venue.website,
        addressLine1: venue.address,
        city: venue.city,
        state: venue.state,
        postalCode: venue.zip,
        latitude: venue.lat,
        longitude: venue.lng,
        description: venue.description ?? venue.shortDescription,
        logoUrl: venue.logoUrl,
        metadata: { source: "venue_promotion", venue_id: venue.id, promoted_at: new Date().toISOString() },
      },
    });
  }
  if (entity.status === "active") {
    return NextResponse.json(
      { error: "This store is already claimed. Contact support if you believe this is in error." },
      { status: 409 },
    );
  }
  if (entity.status === "suspended") {
    return NextResponse.json(
      { error: "This store is unavailable. Contact support." },
      { status: 410 },
    );
  }

  // Don't let two users race a claim — invalidate any prior pending claim
  // for the same entity. Only ONE pending claim at a time. The freshly
  // created claim's token is the one that wins.
  await prisma.entityClaim.deleteMany({
    where: { entityId: entity.id, status: "pending" },
  });

  const token = makeToken();
  const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  const domainMatch = emailDomainMatches(contactEmail, entity.websiteUrl);

  const claim = await prisma.entityClaim.create({
    data: {
      entityId: entity.id,
      claimantUserId: session.user.id,
      contactEmail,
      contactName: body.contactName?.trim() || null,
      contactPhone: body.contactPhone?.trim() || null,
      token,
      expiresAt,
      evidence: {
        ...(body.evidence ?? {}),
        domain_match: domainMatch,
        ip_hash: hashRequestSource(request),
      },
    },
  });

  // Move entity to "pending" so the public page reflects an in-flight claim.
  if (entity.status === "unclaimed") {
    await prisma.afterroarEntity.update({
      where: { id: entity.id },
      data: { status: "pending" },
    });
  }

  // Fire-and-forget email
  const verifyUrl = buildVerifyUrl(token);
  const tpl = claimVerifyTemplate({
    storeName: entity.name,
    verifyUrl,
    claimantEmail: session.user.email ?? null,
    expiresHours: CLAIM_TOKEN_TTL_HOURS,
  });
  sendEmail({ to: contactEmail, ...tpl }).catch((err) =>
    console.error("[claim] verification email failed", err),
  );

  return NextResponse.json({
    ok: true,
    message: `Verification link sent to ${contactEmail}. The link expires in ${CLAIM_TOKEN_TTL_HOURS} hours.`,
    claim_id: claim.id,
    domain_match: domainMatch,
    // Surface in dev when no Resend key is set so we can click through.
    ...(process.env.NODE_ENV !== "production" ? { dev_verify_url: verifyUrl } : {}),
  });
}

function hashRequestSource(request: NextRequest): string {
  // Cheap fingerprint for audit — not for security. xff or remote address.
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  return `${xff}|${ua}`.slice(0, 80);
}
