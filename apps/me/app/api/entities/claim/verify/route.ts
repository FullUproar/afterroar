import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  POST /api/entities/claim/verify                                    */
/*                                                                      */
/*  Body: { token }                                                     */
/*                                                                      */
/*  Consumes a claim token. On success:                                 */
/*    - Flips entity.status → "active"                                  */
/*    - Adds the claimant as EntityMember (role=owner)                  */
/*    - Records the verifiedAt timestamp on the claim                   */
/*    - Optionally writes contactEmail/contactName/contactPhone back   */
/*      onto the entity (if those fields were null at import time —    */
/*      we don't overwrite values supplied by FLGS network DB)         */
/*                                                                      */
/*  All operations are atomic in a single transaction so a partial     */
/*  failure can never leave a verified token + half-claimed entity.    */
/*                                                                      */
/*  Auth: claim verification does NOT require the verifier to be the   */
/*  same Passport account that initiated the claim. The token is the   */
/*  bearer credential — whoever has it can verify (usually the same   */
/*  person logged in on a different device, or the same browser at a  */
/*  different time). The token + email-delivery prove control.         */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  // We DO require auth to flip the entity active — the EntityMember
  // record needs a userId, and we want to credit the actual claimant in
  // case they switched browsers / devices between initiating and verifying.
  // If the signed-in user differs from claimantUserId, we honor whoever's
  // looking at the email — they're who'll get the membership.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to complete the claim.", login_required: true },
      { status: 401 },
    );
  }

  const claim = await prisma.entityClaim.findUnique({
    where: { token },
    include: { entity: true },
  });

  if (!claim) {
    return NextResponse.json(
      { error: "Invalid or already-used claim link." },
      { status: 404 },
    );
  }
  if (claim.status !== "pending") {
    return NextResponse.json(
      { error: `This claim has already been ${claim.status}.` },
      { status: 410 },
    );
  }
  if (claim.expiresAt < new Date()) {
    await prisma.entityClaim
      .update({ where: { id: claim.id }, data: { status: "expired" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "This claim link has expired. Start a new claim from the store page." },
      { status: 410 },
    );
  }

  // Bump the verifying user — the actually-clicking-the-link user — onto
  // the membership. claimantUserId stays for audit.
  const membershipUserId = session.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const updatedClaim = await tx.entityClaim.update({
      where: { id: claim.id },
      data: { status: "verified", verifiedAt: new Date() },
    });

    const updatedEntity = await tx.afterroarEntity.update({
      where: { id: claim.entityId },
      data: {
        status: "active",
        approvedAt: new Date(),
        // Backfill contact info only if the entity didn't already have it
        // from the bulk import — never overwrite curated data.
        ...(claim.entity.contactEmail ? {} : { contactEmail: claim.contactEmail }),
        ...(claim.entity.contactName || !claim.contactName ? {} : { contactName: claim.contactName }),
        ...(claim.entity.contactPhone || !claim.contactPhone ? {} : { contactPhone: claim.contactPhone }),
      },
    });

    // Mirror status to the Venue directory record so /stores/[slug] reflects
    // the new claimed-and-active state without us having to touch the page.
    await tx.venue.updateMany({
      where: { slug: claim.entity.slug },
      data: { status: "active" },
    });

    // Upsert the membership — if for some reason the user already had a
    // member row (e.g. retry of verify), don't blow up.
    await tx.entityMember.upsert({
      where: { entityId_userId: { entityId: claim.entityId, userId: membershipUserId } },
      create: {
        entityId: claim.entityId,
        userId: membershipUserId,
        role: "owner",
        addedBy: "claim_verification",
      },
      update: { role: "owner" },
    });

    return { claim: updatedClaim, entity: updatedEntity };
  });

  return NextResponse.json({
    ok: true,
    entity: {
      id: result.entity.id,
      slug: result.entity.slug,
      name: result.entity.name,
      status: result.entity.status,
    },
  });
}
