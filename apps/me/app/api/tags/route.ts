import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/tags — List tags, optionally filtered by type or search.
 * POST /api/tags — Create a new custom tag.
 */

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const search = request.nextUrl.searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const tags = await prisma.gameTag.findMany({
    where,
    orderBy: [{ useCount: 'desc' }, { name: 'asc' }],
    take: 50,
    select: { id: true, name: true, slug: true, type: true, useCount: true },
  });

  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { name: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!body.name?.trim() || body.name.trim().length > 30) {
    return NextResponse.json({ error: 'Tag name required (max 30 chars)' }, { status: 400 });
  }

  const name = body.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const tag = await prisma.gameTag.upsert({
    where: { slug },
    create: { name, slug, type: 'custom', createdBy: session.user.id },
    update: {},
  });

  return NextResponse.json(tag, { status: 201 });
}
