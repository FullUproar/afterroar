import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/**
 * Internal upsert: find or create an AfterroarEntity by slug.
 *
 * Called by FU at venue-claim-bind time so every claimed venue on FU
 * has a corresponding identity record on Passport. Cross-DB references
 * are app-level (the FU Venue.afterroarEntityId column FKs to the id
 * returned here).
 *
 * Auth: HMAC over `entity-upsert|<slug>` signed with VENUE_CLAIM_HMAC_SECRET.
 * Same shared secret used by the existing /api/auth/signup venue-claim
 * path so we don't introduce a second cross-system trust channel.
 *
 * Idempotent: if a row already exists for the slug, returns it without
 * mutating. Caller can pass `updateMetadata: true` to refresh fields
 * like name / address / logo when the FU side has fresher data.
 */

interface UpsertBody {
  slug?: string;
  name?: string;
  signature?: string;
  type?: string;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  updateMetadata?: boolean;
}

export async function POST(req: NextRequest) {
  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const slug = String(body.slug ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  if (!slug || !name) {
    return NextResponse.json({ ok: false, error: 'slug and name required' }, { status: 400 });
  }

  const secret = process.env.VENUE_CLAIM_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Server misconfiguration (HMAC secret missing)' },
      { status: 500 },
    );
  }
  const expected = createHmac('sha256', secret)
    .update(`entity-upsert|${slug}`)
    .digest('hex');
  if (body.signature !== expected) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  const existing = await prisma.afterroarEntity.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true },
  });

  if (existing && !body.updateMetadata) {
    return NextResponse.json({
      ok: true,
      created: false,
      entity: existing,
    });
  }

  const data = {
    slug,
    name,
    type: body.type ?? 'store',
    status: 'active' as const,
    contactEmail: body.contactEmail ?? null,
    contactName: body.contactName ?? null,
    contactPhone: body.contactPhone ?? null,
    websiteUrl: body.websiteUrl ?? null,
    logoUrl: body.logoUrl ?? null,
    description: body.description ?? null,
    addressLine1: body.addressLine1 ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    postalCode: body.postalCode ?? null,
    country: body.country ?? 'US',
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    approvedAt: new Date(),
  };

  if (existing) {
    const updated = await prisma.afterroarEntity.update({
      where: { id: existing.id },
      data,
      select: { id: true, slug: true, name: true, status: true },
    });
    return NextResponse.json({ ok: true, created: false, entity: updated });
  }

  const created = await prisma.afterroarEntity.create({
    data,
    select: { id: true, slug: true, name: true, status: true },
  });
  return NextResponse.json({ ok: true, created: true, entity: created });
}
