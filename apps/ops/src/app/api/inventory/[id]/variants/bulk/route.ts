/**
 * POST /api/inventory/[id]/variants/bulk
 *
 * Create N child variants of a parent inventory item in one transaction.
 * Used by the variant-matrix UI on the inventory detail page (apparel
 * size × color, TCG foil × condition, etc.).
 *
 * Each child inherits the parent's category, price_cents, cost_cents,
 * lendable, supplier_id, and active state. The caller provides per-variant
 * `variant_label` and `attributes` (and optionally `sku` overrides).
 *
 * Auth: requires `inventory.create`.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

interface VariantInput {
  variant_label: string;
  /** Merged with parent attributes; child's keys win. */
  attributes?: Record<string, unknown>;
  /** Per-variant SKU override. Default: parent.sku + label-suffix. */
  sku?: string;
  /** Per-variant price override. Default: parent.price_cents. */
  price_cents?: number;
  /** Per-variant initial quantity. Default: 0. */
  quantity?: number;
}

interface Body {
  variants?: VariantInput[];
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: parentId } = await ctx.params;
  try {
    const { storeId, db } = await requirePermission("inventory.create");

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json({ error: "variants array is required" }, { status: 400 });
    }
    if (body.variants.length > 200) {
      return NextResponse.json({ error: "Max 200 variants per call" }, { status: 400 });
    }

    const parent = await db.posInventoryItem.findFirst({
      where: { id: parentId },
      select: {
        id: true,
        store_id: true,
        name: true,
        category: true,
        price_cents: true,
        cost_cents: true,
        sku: true,
        attributes: true,
        lendable: true,
        supplier_id: true,
        parent_id: true,
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent item not found" }, { status: 404 });
    }
    if (parent.parent_id) {
      return NextResponse.json(
        { error: "Cannot create variants of a variant — pick the top-level parent." },
        { status: 400 },
      );
    }

    const parentAttrs = (parent.attributes ?? {}) as Record<string, unknown>;

    const created = await prisma.$transaction(async (tx) => {
      const out: Array<{ id: string; variant_label: string }> = [];
      for (let i = 0; i < body.variants!.length; i++) {
        const v = body.variants![i]!;
        if (!v.variant_label?.trim()) {
          throw new HttpError(400, `variants[${i}] missing variant_label`);
        }
        // Merge parent attributes with per-variant attribute overrides.
        const mergedAttributes: Record<string, unknown> = {
          ...parentAttrs,
          ...(v.attributes ?? {}),
        };
        const skuSuffix = v.variant_label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 32);
        const sku = v.sku ?? (parent.sku ? `${parent.sku}-${skuSuffix}` : null);

        const child = await tx.posInventoryItem.create({
          data: {
            store_id: storeId,
            name: `${parent.name} (${v.variant_label.trim()})`,
            category: parent.category,
            sku,
            price_cents: v.price_cents ?? parent.price_cents,
            cost_cents: parent.cost_cents,
            quantity: v.quantity ?? 0,
            attributes: mergedAttributes as Prisma.InputJsonValue,
            lendable: parent.lendable,
            supplier_id: parent.supplier_id,
            parent_id: parent.id,
            variant_label: v.variant_label.trim(),
          },
          select: { id: true, variant_label: true },
        });
        out.push({ id: child.id, variant_label: child.variant_label ?? v.variant_label });
      }
      return out;
    });

    return NextResponse.json({ created, count: created.length }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleAuthError(error);
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
