/**
 * GET  /api/pull-lists/[id]/items — list issue allocations for a pull list
 * POST /api/pull-lists/[id]/items — add an issue allocation (typically a new
 *                                     issue arrives → allocate to all matching
 *                                     pull lists; here we manually add one).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requirePermission("customers.view");
    const items = await db.posPullListItem.findMany({
      where: { pull_list_id: id },
      orderBy: { created_at: "desc" },
      include: {
        inventory_item: { select: { id: true, name: true, quantity: true, price_cents: true } },
      },
      take: 200,
    });
    return NextResponse.json({ items });
  } catch (error) {
    return handleAuthError(error);
  }
}

interface CreateBody {
  issue_number?: string;
  variant_label?: string;
  inventory_item_id?: string;
  expires_in_days?: number;
  notes?: string;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db } = await requirePermission("customers.edit");

    let body: CreateBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.issue_number?.trim()) {
      return NextResponse.json({ error: "issue_number is required" }, { status: 400 });
    }

    const expiresInDays = body.expires_in_days ?? 90;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const item = await db.posPullListItem.create({
      data: {
        pull_list_id: id,
        issue_number: body.issue_number.trim(),
        variant_label: body.variant_label?.trim() || null,
        inventory_item_id: body.inventory_item_id ?? null,
        expires_at: expiresAt,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
