import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

/**
 * POST /api/inventory/break
 *
 * Convert a parent inventory unit into N child units. The classic FLGS use
 * case is "crack a sealed case" → adds individual booster boxes; "crack a
 * booster box" → adds individual packs. Cost is allocated proportionally
 * across the children so margin is preserved on the singles.
 *
 * Body: { recipe_id?: string,                  // pick a saved recipe, OR
 *         parent_inventory_id: string,         // parent SKU
 *         children: [                          // child SKUs + counts
 *           { inventory_id: string, qty: number, allocated_cost_cents?: number }
 *         ],
 *         parent_qty_consumed?: number,        // default 1
 *         note?: string }
 *
 * If `allocated_cost_cents` is not provided per child, the parent's current
 * `cost_cents` × `parent_qty_consumed` is split evenly across the total
 * child unit count. Stores can override to weight more expensive children
 * (e.g. when a case yields one premium box + several plain boxes).
 *
 * Side effects (in a single transaction):
 *   - Decrement parent quantity by `parent_qty_consumed` (rejects if not
 *     enough on hand).
 *   - For each child: increment quantity by qty, update cost_cents +
 *     last_cost_cents (and first_cost_cents if null), write a row to
 *     pos_cost_history with source="break".
 *   - Insert a row into pos_break_events with the children manifest.
 *   - Insert an adjustment ledger entry summarising the break for audit.
 */

interface BreakChild {
  inventory_id: string;
  qty: number;
  allocated_cost_cents?: number;
}

interface BreakBody {
  recipe_id?: string;
  parent_inventory_id?: string;
  children?: BreakChild[];
  parent_qty_consumed?: number;
  note?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { staff, storeId, db } = await requirePermission("inventory.adjust");

    let body: BreakBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parentQtyConsumed = body.parent_qty_consumed ?? 1;
    if (parentQtyConsumed <= 0) {
      return NextResponse.json({ error: "parent_qty_consumed must be > 0" }, { status: 400 });
    }

    // Resolve recipe-derived shape if recipe_id given
    let parentId = body.parent_inventory_id;
    let children = body.children;

    if (body.recipe_id && (!parentId || !children?.length)) {
      const recipe = await db.posBreakRecipe.findFirst({
        where: { id: body.recipe_id, store_id: storeId, active: true },
      });
      if (!recipe) {
        return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
      }
      parentId = recipe.parent_inventory_id;
      children = [
        {
          inventory_id: recipe.child_inventory_id,
          qty: recipe.child_qty_per_parent * parentQtyConsumed,
        },
      ];
    }

    if (!parentId) {
      return NextResponse.json({ error: "parent_inventory_id is required" }, { status: 400 });
    }
    if (!children?.length) {
      return NextResponse.json({ error: "children[] is required" }, { status: 400 });
    }
    if (children.some((c) => !c.inventory_id || c.qty <= 0)) {
      return NextResponse.json({ error: "Each child needs inventory_id + qty > 0" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const parent = await tx.posInventoryItem.findFirst({
        where: { id: parentId, store_id: storeId },
      });
      if (!parent) {
        throw new HttpError(404, "Parent item not found");
      }
      if (parent.quantity < parentQtyConsumed) {
        throw new HttpError(
          422,
          `Not enough on hand to break (have ${parent.quantity}, need ${parentQtyConsumed})`,
        );
      }

      // Cost allocation
      const totalChildUnits = children!.reduce((s, c) => s + c.qty, 0);
      const totalParentCost = parent.cost_cents * parentQtyConsumed;
      const costsProvided = children!.every((c) => typeof c.allocated_cost_cents === "number");
      const flatPerChildUnit =
        totalChildUnits > 0 ? Math.floor(totalParentCost / totalChildUnits) : 0;

      // Decrement parent
      await tx.posInventoryItem.update({
        where: { id: parent.id },
        data: { quantity: { decrement: parentQtyConsumed }, updated_at: new Date() },
      });

      const childManifest: Array<{
        child_inventory_id: string;
        qty_added: number;
        unit_cost_cents: number;
      }> = [];

      // Bump each child + write cost history
      let allocatedSoFar = 0;
      for (let i = 0; i < children!.length; i++) {
        const child = children![i];
        const childItem = await tx.posInventoryItem.findFirst({
          where: { id: child.inventory_id, store_id: storeId },
          select: { id: true, cost_cents: true, first_cost_cents: true },
        });
        if (!childItem) {
          throw new HttpError(404, `Child item ${child.inventory_id} not found`);
        }

        let unitCostCents: number;
        if (costsProvided) {
          unitCostCents = Math.floor((child.allocated_cost_cents ?? 0) / Math.max(1, child.qty));
        } else if (i < children!.length - 1) {
          unitCostCents = flatPerChildUnit;
          allocatedSoFar += unitCostCents * child.qty;
        } else {
          // Last child absorbs rounding crumbs so total matches parent cost
          const remainingCost = totalParentCost - allocatedSoFar;
          unitCostCents = Math.floor(remainingCost / Math.max(1, child.qty));
        }

        const isFirst = childItem.first_cost_cents == null && unitCostCents > 0;
        await tx.posInventoryItem.update({
          where: { id: childItem.id },
          data: {
            quantity: { increment: child.qty },
            ...(unitCostCents > 0
              ? {
                  cost_cents: unitCostCents,
                  last_cost_cents: unitCostCents,
                  ...(isFirst ? { first_cost_cents: unitCostCents } : {}),
                }
              : {}),
            updated_at: new Date(),
          },
        });

        if (unitCostCents > 0 && unitCostCents !== childItem.cost_cents) {
          await tx.posCostHistory.create({
            data: {
              store_id: storeId,
              inventory_item_id: childItem.id,
              cost_cents: unitCostCents,
              source: "break",
              quantity: child.qty,
              note: `Broken from ${parent.name}`,
              staff_id: staff.id,
            },
          });
        }

        childManifest.push({
          child_inventory_id: childItem.id,
          qty_added: child.qty,
          unit_cost_cents: unitCostCents,
        });
      }

      // Audit row
      const breakEvent = await tx.posBreakEvent.create({
        data: {
          store_id: storeId,
          recipe_id: body.recipe_id ?? null,
          parent_inventory_id: parent.id,
          parent_qty_consumed: parentQtyConsumed,
          children: childManifest,
          staff_id: staff.id,
          note: body.note ?? null,
        },
      });

      // Ledger summary so this shows up alongside other inventory ops
      const childSummary = childManifest
        .map((c) => `${c.qty_added}× ${c.child_inventory_id.slice(0, 8)}`)
        .join(", ");
      await tx.posLedgerEntry.create({
        data: {
          store_id: storeId,
          type: "adjustment",
          amount_cents: 0,
          staff_id: staff.id,
          description: `Broke ${parentQtyConsumed}× ${parent.name} → ${childSummary}`,
          metadata: {
            kind: "break",
            break_event_id: breakEvent.id,
            parent_inventory_id: parent.id,
            children: childManifest,
          },
        },
      });

      return { break_event: breakEvent, manifest: childManifest };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleAuthError(error);
  }
}

class HttpError {
  status: number;
  message: string;
  constructor(status: number, message: string) {
    this.status = status;
    this.message = message;
  }
}
