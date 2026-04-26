import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

/**
 * Per-item vendor links — each row says "this inventory item can be
 * reordered from this distributor under this vendor SKU at this case
 * pack and cost." One link per (supplier, item). At most one link per
 * item is `preferred=true`; setting it true on one row clears the flag
 * on the others atomically.
 */

interface VendorLinkBody {
  supplier_id: string;
  vendor_sku?: string | null;
  case_pack?: number | null;
  last_cost_cents?: number | null;
  preferred?: boolean;
  notes?: string | null;
}

/** GET /api/inventory/:id/vendors */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requirePermission("inventory.view");
    const { id } = await params;

    const item = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const links = await db.posVendorItem.findMany({
      where: { inventory_item_id: id, store_id: storeId },
      include: {
        supplier: { select: { id: true, name: true, account_number: true } },
      },
      orderBy: [{ preferred: "desc" }, { created_at: "asc" }],
    });

    return NextResponse.json(links);
  } catch (error) {
    return handleAuthError(error);
  }
}

/** POST /api/inventory/:id/vendors — add or upsert a vendor link */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");
    const { id } = await params;

    let body: VendorLinkBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.supplier_id) {
      return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
    }

    const item = await db.posInventoryItem.findFirst({
      where: { id, store_id: storeId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    const supplier = await db.posSupplier.findFirst({
      where: { id: body.supplier_id, store_id: storeId },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // If marking this one preferred, clear preferred on all other links for the item.
    if (body.preferred) {
      await db.posVendorItem.updateMany({
        where: { inventory_item_id: id, store_id: storeId, preferred: true },
        data: { preferred: false },
      });
    }

    const link = await db.posVendorItem.upsert({
      where: {
        supplier_id_inventory_item_id: {
          supplier_id: body.supplier_id,
          inventory_item_id: id,
        },
      },
      create: {
        store_id: storeId,
        supplier_id: body.supplier_id,
        inventory_item_id: id,
        vendor_sku: body.vendor_sku ?? null,
        case_pack: body.case_pack ?? null,
        last_cost_cents: body.last_cost_cents ?? null,
        preferred: !!body.preferred,
        notes: body.notes ?? null,
      },
      update: {
        vendor_sku: body.vendor_sku ?? null,
        case_pack: body.case_pack ?? null,
        last_cost_cents: body.last_cost_cents ?? null,
        ...(body.preferred !== undefined ? { preferred: body.preferred } : {}),
        notes: body.notes ?? null,
        updated_at: new Date(),
      },
      include: {
        supplier: { select: { id: true, name: true, account_number: true } },
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

/** PATCH /api/inventory/:id/vendors — toggle preferred or update one link */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");
    const { id } = await params;
    const body = (await request.json()) as { link_id: string; preferred?: boolean; vendor_sku?: string; case_pack?: number; last_cost_cents?: number; notes?: string };

    if (!body.link_id) {
      return NextResponse.json({ error: "link_id is required" }, { status: 400 });
    }

    const link = await db.posVendorItem.findFirst({
      where: { id: body.link_id, inventory_item_id: id, store_id: storeId },
    });
    if (!link) {
      return NextResponse.json({ error: "Vendor link not found" }, { status: 404 });
    }

    if (body.preferred === true) {
      await db.posVendorItem.updateMany({
        where: { inventory_item_id: id, store_id: storeId, preferred: true, NOT: { id: body.link_id } },
        data: { preferred: false },
      });
    }

    const updated = await db.posVendorItem.update({
      where: { id: body.link_id },
      data: {
        ...(body.preferred !== undefined ? { preferred: body.preferred } : {}),
        ...(body.vendor_sku !== undefined ? { vendor_sku: body.vendor_sku } : {}),
        ...(body.case_pack !== undefined ? { case_pack: body.case_pack } : {}),
        ...(body.last_cost_cents !== undefined ? { last_cost_cents: body.last_cost_cents } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updated_at: new Date(),
      },
      include: {
        supplier: { select: { id: true, name: true, account_number: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

/** DELETE /api/inventory/:id/vendors?link_id=... */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, storeId } = await requirePermission("inventory.adjust");
    const { id } = await params;
    const linkId = request.nextUrl.searchParams.get("link_id");
    if (!linkId) {
      return NextResponse.json({ error: "link_id is required" }, { status: 400 });
    }
    const result = await db.posVendorItem.deleteMany({
      where: { id: linkId, inventory_item_id: id, store_id: storeId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
