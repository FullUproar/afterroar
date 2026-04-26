import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";
import { allocateLandedCost, type AllocationMethod } from "@/lib/landed-cost";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("inventory.adjust");
    const { id } = await params;

    const po = await db.posPurchaseOrder.findFirst({
      where: { id },
      include: {
        items: {
          include: {
            inventory_item: {
              select: { id: true, name: true, quantity: true },
            },
          },
        },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(po);
  } catch (error) {
    return handleAuthError(error);
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["partially_received", "received", "cancelled"],
  partially_received: ["received", "cancelled"],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("inventory.adjust");
    const { id } = await params;
    const body = await request.json();
    const { status, notes, expected_delivery } = body;

    const po = await db.posPurchaseOrder.findFirst({ where: { id } });
    if (!po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { updated_at: new Date() };

    if (status) {
      const allowed = VALID_TRANSITIONS[po.status];
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from '${po.status}' to '${status}'`,
          },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (notes !== undefined) updateData.notes = notes;
    if (expected_delivery !== undefined) {
      updateData.expected_delivery = expected_delivery
        ? new Date(expected_delivery)
        : null;
    }

    const updated = await db.posPurchaseOrder.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await requirePermission("inventory.adjust");
    const { id } = await params;
    const body = await request.json();

    if (body.action === "receive") {
      const { item_id, quantity_received } = body;

      if (!item_id || typeof quantity_received !== "number" || quantity_received <= 0) {
        return NextResponse.json(
          { error: "item_id and positive quantity_received required" },
          { status: 400 }
        );
      }

      const po = await db.posPurchaseOrder.findFirst({
        where: { id },
        include: { items: true },
      });
      if (!po) {
        return NextResponse.json(
          { error: "Purchase order not found" },
          { status: 404 }
        );
      }

      if (po.status === "cancelled" || po.status === "received") {
        return NextResponse.json(
          { error: `Cannot receive items on a ${po.status} PO` },
          { status: 400 }
        );
      }

      const poItem = po.items.find((i) => i.id === item_id);
      if (!poItem) {
        return NextResponse.json(
          { error: "PO item not found" },
          { status: 404 }
        );
      }

      const newReceived = poItem.quantity_received + quantity_received;

      // Compute landed unit cost for THIS line by allocating PO header fees
      // (freight + tax + other_fees) across all lines proportional to the PO's
      // chosen cost_allocation method. We compute once per receive event using
      // ordered quantities, so partial receives still see the same landed
      // unit cost — the share of freight is decided at PO time, not at
      // receive time, even if items dribble in across multiple shipments.
      const totalFees = (po.freight_cents ?? 0) + (po.tax_cents ?? 0) + (po.other_fees_cents ?? 0);
      const allocMethod = (po.cost_allocation as AllocationMethod) || "by_cost";
      let landedUnitCostCents = poItem.cost_cents;
      let allocatedFeeCents = 0;
      if (totalFees > 0 && po.items.length > 0) {
        // Pull weight_oz only if we need it (avoids an extra fetch on by_cost).
        let weightById: Map<string, number | null> = new Map();
        if (allocMethod === "by_weight") {
          const linkedIds = po.items
            .map((i) => i.inventory_item_id)
            .filter((id): id is string => !!id);
          if (linkedIds.length > 0) {
            const weights = await db.posInventoryItem.findMany({
              where: { id: { in: linkedIds } },
              select: { id: true, weight_oz: true },
            });
            weightById = new Map(weights.map((w) => [w.id, w.weight_oz]));
          }
        }
        const allocations = allocateLandedCost(
          po.items.map((i) => ({
            id: i.id,
            unit_cost_cents: i.cost_cents,
            quantity_ordered: i.quantity_ordered,
            weight_oz: i.inventory_item_id
              ? weightById.get(i.inventory_item_id) ?? null
              : null,
          })),
          totalFees,
          allocMethod,
        );
        const mine = allocations.find((a) => a.id === poItem.id);
        if (mine) {
          landedUnitCostCents = mine.landed_unit_cost_cents;
          allocatedFeeCents = mine.allocated_fee_cents;
        }
      }

      // Update PO item
      await db.posPurchaseOrderItem.update({
        where: { id: item_id },
        data: { quantity_received: newReceived },
      });

      // Update inventory quantity AND cost if linked to an item, then write
      // a row to cost history so the item-history view shows the receive event.
      if (poItem.inventory_item_id) {
        const existing = await db.posInventoryItem.findUnique({
          where: { id: poItem.inventory_item_id },
          select: { first_cost_cents: true, cost_cents: true },
        });
        const isFirstCost = existing?.first_cost_cents == null && landedUnitCostCents > 0;

        await db.posInventoryItem.update({
          where: { id: poItem.inventory_item_id },
          data: {
            quantity: { increment: quantity_received },
            ...(landedUnitCostCents > 0
              ? {
                  cost_cents: landedUnitCostCents,
                  last_cost_cents: landedUnitCostCents,
                  ...(isFirstCost ? { first_cost_cents: landedUnitCostCents } : {}),
                }
              : {}),
            updated_at: new Date(),
          },
        });

        if (landedUnitCostCents > 0 && landedUnitCostCents !== existing?.cost_cents) {
          db.posCostHistory
            .create({
              data: {
                store_id: po.store_id,
                inventory_item_id: poItem.inventory_item_id,
                cost_cents: landedUnitCostCents,
                source: "po",
                purchase_order_id: po.id,
                supplier_id: po.supplier_id ?? null,
                quantity: quantity_received,
                note:
                  allocatedFeeCents > 0
                    ? `Landed (incl. ${(allocatedFeeCents / 100).toFixed(2)} ${allocMethod} fee allocation)`
                    : null,
              },
            })
            .catch((err) => console.error("[cost history] po receive write failed", err));
        }
      }

      // Check if all items are fully received
      const updatedPO = await db.posPurchaseOrder.findFirst({
        where: { id },
        include: { items: true },
      });

      if (updatedPO) {
        const allReceived = updatedPO.items.every(
          (i) => i.quantity_received >= i.quantity_ordered
        );
        const someReceived = updatedPO.items.some(
          (i) => i.quantity_received > 0
        );

        let newStatus = updatedPO.status;
        if (allReceived) {
          newStatus = "received";
        } else if (someReceived && updatedPO.status !== "partially_received") {
          newStatus = "partially_received";
        }

        if (newStatus !== updatedPO.status) {
          await db.posPurchaseOrder.update({
            where: { id },
            data: { status: newStatus, updated_at: new Date() },
          });
        }
      }

      const result = await db.posPurchaseOrder.findFirst({
        where: { id },
        include: {
          items: {
            include: {
              inventory_item: {
                select: { id: true, name: true, quantity: true },
              },
            },
          },
        },
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleAuthError(error);
  }
}
