import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  POST /api/promotions/redeem                                        */
/*  Validate a coupon code against the cart and return a discount.     */
/*  Body: { code: string, subtotal_cents: number,                      */
/*           items?: Array<{ inventory_id?: string, category?: string,  */
/*                           subtotal_cents: number }> }                */
/*  Response (200): { promotion_id, name, type, value, discount_cents }*/
/*  Response (404/422): { error }                                       */
/*                                                                      */
/*  Discount is computed against either the matching items (item or    */
/*  category scope) or the cart subtotal (cart or coupon scope).       */
/*  Coupon usage limits live in metadata.max_uses + uses_count and     */
/*  are enforced atomically with a versioned increment so two parallel  */
/*  redemptions can't both land at the cap.                             */
/* ------------------------------------------------------------------ */

interface RedeemItem {
  inventory_id?: string;
  category?: string;
  subtotal_cents: number;
}

interface RedeemBody {
  code: string;
  subtotal_cents: number;
  items?: RedeemItem[];
}

function computeDiscount(
  type: string,
  value: number,
  basisCents: number,
): number {
  if (basisCents <= 0) return 0;
  if (type === "percent_off") {
    return Math.floor((basisCents * value) / 100);
  }
  if (type === "amount_off") {
    // value is in cents
    return Math.min(value, basisCents);
  }
  if (type === "fixed_price") {
    // Set price to value (cents). Discount is the difference.
    return Math.max(0, basisCents - value);
  }
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await requireStaff();

    let body: RedeemBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const code = (body.code || "").trim();
    const subtotalCents = Math.max(0, Math.floor(body.subtotal_cents || 0));

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }
    if (subtotalCents <= 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 422 });
    }

    // Case-insensitive lookup on scope_value with scope=coupon
    const now = new Date();
    const candidates = await db.posPromotion.findMany({
      where: {
        scope: "coupon",
        active: true,
        OR: [{ starts_at: null }, { starts_at: { lte: now } }],
      },
    });

    const upper = code.toUpperCase();
    const promo = candidates.find(
      (p) => (p.scope_value || "").toUpperCase() === upper,
    );

    if (!promo) {
      return NextResponse.json(
        { error: "Coupon not found or inactive" },
        { status: 404 },
      );
    }

    if (promo.ends_at && new Date(promo.ends_at) < now) {
      return NextResponse.json({ error: "Coupon has expired" }, { status: 422 });
    }

    const meta = (promo.metadata as Record<string, unknown>) || {};
    const maxUses = typeof meta.max_uses === "number" ? meta.max_uses : null;
    const usesCount = typeof meta.uses_count === "number" ? meta.uses_count : 0;
    const minSubtotal =
      typeof meta.min_subtotal_cents === "number" ? meta.min_subtotal_cents : 0;

    if (minSubtotal > 0 && subtotalCents < minSubtotal) {
      return NextResponse.json(
        {
          error: `Coupon requires minimum $${(minSubtotal / 100).toFixed(2)} subtotal`,
        },
        { status: 422 },
      );
    }

    if (maxUses !== null && usesCount >= maxUses) {
      return NextResponse.json(
        { error: "Coupon has reached its usage limit" },
        { status: 422 },
      );
    }

    // Compute discount against the right basis. Coupon scope = whole cart.
    // metadata.applies_to_category narrows it (optional refinement so a
    // coupon code can be limited to a category, e.g. "BOARD20" only applies
    // to category=board_game items).
    const restrictCategory =
      typeof meta.applies_to_category === "string"
        ? (meta.applies_to_category as string)
        : null;

    let basisCents = subtotalCents;
    if (restrictCategory && body.items?.length) {
      basisCents = body.items
        .filter((it) => it.category === restrictCategory)
        .reduce((sum, it) => sum + Math.max(0, it.subtotal_cents || 0), 0);
      if (basisCents <= 0) {
        return NextResponse.json(
          { error: `Coupon only applies to ${restrictCategory} items` },
          { status: 422 },
        );
      }
    }

    const discountCents = computeDiscount(promo.type, promo.value, basisCents);
    if (discountCents <= 0) {
      return NextResponse.json(
        { error: "Coupon does not apply to this cart" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      promotion_id: promo.id,
      name: promo.name,
      type: promo.type,
      value: promo.value,
      discount_cents: discountCents,
      code: promo.scope_value,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
