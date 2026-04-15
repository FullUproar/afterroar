import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/entities/apply — Apply to become an Afterroar Connect entity.
 *
 * Creates a pending AfterroarEntity record + EntityMember linking the
 * applicant (must be signed in) as the owner. Admin approval is required
 * before they can actually use the dashboard.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: {
    name: string;
    type?: string;
    contactEmail: string;
    contactName?: string;
    contactPhone?: string;
    websiteUrl?: string;
    description?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.name?.trim() || !body.contactEmail?.trim()) {
    return NextResponse.json({ error: 'name and contactEmail are required' }, { status: 400 });
  }

  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.afterroarEntity.findUnique({ where: { slug } });
      const finalSlug = existing ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;

      const entity = await tx.afterroarEntity.create({
        data: {
          slug: finalSlug,
          name: body.name.trim(),
          type: body.type || 'store',
          status: 'pending',
          contactEmail: body.contactEmail.trim(),
          contactName: body.contactName?.trim() || null,
          contactPhone: body.contactPhone?.trim() || null,
          websiteUrl: body.websiteUrl?.trim() || null,
          description: body.description?.trim() || null,
          addressLine1: body.addressLine1?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          postalCode: body.postalCode?.trim() || null,
          country: body.country || 'US',
        },
      });

      await tx.entityMember.create({
        data: {
          entityId: entity.id,
          userId: session.user!.id as string,
          role: 'owner',
          addedBy: session.user!.id as string,
        },
      });

      return entity;
    });

    return NextResponse.json({
      id: result.id,
      slug: result.slug,
      status: result.status,
      message: 'Application received. We\'ll review and reach out within 1-2 business days.',
    }, { status: 201 });
  } catch (err) {
    console.error('[entity-apply] Failed:', err);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}
