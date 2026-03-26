import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/returns — list returns for store                          */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const { db } = await requirePermission("returns");

    const data = await db.posReturn.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });

    const rows = data.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      customer_name: r.customer?.name ?? "Guest",
      item_count: r._count.items,
      total_refund_cents: r.total_refund_cents,
      refund_method: r.refund_method,
      reason: r.reason,
      status: r.status,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    return handleAuthError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/returns — process a return                               */
/* ------------------------------------------------------------------ */

interface ReturnItemInput {
  inventory_item_id: string;
  name: string;
  category: string | null;
  quantity: number;
  price_cents: number;
  restock: boolean;
}

interface CreateReturnBody {
  original_ledger_entry_id: string;
  items: ReturnItemInput[];
  refund_method: "cash" | "store_credit";
  credit_bonus_percent: number;
  reason: string;
  reason_notes: string | null;
  restocking_fee_percent: number;
  client_tx_id?: string; // Idempotency key for offline queue
}

export async function POST(request: NextRequest) {
  try {
    const { staff, storeId } = await requirePermission("returns");

    let body: CreateReturnBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      original_ledger_entry_id,
      items,
      refund_method,
      credit_bonus_percent,
      reason,
      reason_notes,
      restocking_fee_percent,
      client_tx_id,
    } = body;

    // Idempotency: if this transaction was already processed, return the existing result
    if (client_tx_id) {
      const existing = await prisma.posLedgerEntry.findFirst({
        where: {
          store_id: storeId,
          type: "refund",
          metadata: { path: ["client_tx_id"], equals: client_tx_id },
        },
      });
      if (existing) {
        return NextResponse.json({ id: existing.id, deduplicated: true });
      }
    }

    if (!original_ledger_entry_id || !items?.length || !reason) {
      return NextResponse.json(
        { error: "original_ledger_entry_id, items, and reason are required" },
        { status: 400 }
      );
    }

    // 1. Validate original sale exists and belongs to this store
    const originalSale = await prisma.posLedgerEntry.findFirst({
      where: {
        id: original_ledger_entry_id,
        store_id: storeId,
        type: "sale",
      },
    });
    if (!originalSale) {
      return NextResponse.json(
        { error: "Original sale not found" },
        { status: 400 }
      );
    }

    // 2. Double-return prevention: check already-returned quantities
    const existingReturns = await prisma.posReturn.findMany({
      where: { original_ledger_entry_id },
      include: { items: true },
    });

    const alreadyReturnedMap = new Map<string, number>();
    for (const ret of existingReturns) {
      for (const item of ret.items) {
        const key = item.inventory_item_id ?? item.name;
        alreadyReturnedMap.set(key, (alreadyReturnedMap.get(key) ?? 0) + item.quantity);
      }
    }

    // Validate against original sale items
    const saleMeta = originalSale.metadata as Record<string, unknown>;
    const saleItems = (saleMeta?.items as Array<{
      inventory_item_id: string;
      quantity: number;
      price_cents: number;
    }>) ?? [];
    const saleItemMap = new Map(saleItems.map((si) => [si.inventory_item_id, si]));

    for (const item of items) {
      const originalItem = saleItemMap.get(item.inventory_item_id);
      if (!originalItem) {
        return NextResponse.json(
          { error: `Item "${item.name}" was not part of the original sale` },
          { status: 400 }
        );
      }
      const alreadyReturned = alreadyReturnedMap.get(item.inventory_item_id) ?? 0;
      const maxReturnable = originalItem.quantity - alreadyReturned;
      if (item.quantity > maxReturnable) {
        return NextResponse.json(
          {
            error: `Cannot return ${item.quantity} of "${item.name}". Max returnable: ${maxReturnable}`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Calculate amounts
    const subtotal_cents = items.reduce(
      (sum, i) => sum + i.price_cents * i.quantity,
      0
    );
    const restocking_fee_cents = Math.round(
      subtotal_cents * (restocking_fee_percent || 0) / 100
    );
    const refund_amount_cents = subtotal_cents - restocking_fee_cents;
    const effectiveBonusPercent =
      refund_method === "store_credit" ? (credit_bonus_percent || 0) : 0;
    const total_refund_cents =
      refund_method === "store_credit"
        ? Math.round(refund_amount_cents * (1 + effectiveBonusPercent / 100))
        : refund_amount_cents;

    // 4. Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create return record
      const posReturn = await tx.posReturn.create({
        data: {
          store_id: storeId,
          customer_id: originalSale.customer_id,
          staff_id: staff.id,
          original_ledger_entry_id,
          status: "completed",
          refund_method,
          reason,
          reason_notes: reason_notes || null,
          subtotal_cents,
          restocking_fee_cents,
          refund_amount_cents,
          credit_bonus_percent: effectiveBonusPercent,
          total_refund_cents,
        },
      });

      // Create return items
      await tx.posReturnItem.createMany({
        data: items.map((i) => ({
          return_id: posReturn.id,
          inventory_item_id: i.inventory_item_id,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          price_cents: i.price_cents,
          total_cents: i.price_cents * i.quantity,
          restock: i.restock,
        })),
      });

      // Create refund ledger entry (negative = money going out)
      const ledgerEntry = await tx.posLedgerEntry.create({
        data: {
          store_id: storeId,
          type: "refund",
          customer_id: originalSale.customer_id,
          staff_id: staff.id,
          amount_cents: -total_refund_cents,
          description: `Return: ${items.length} item(s) — ${refund_method === "store_credit" ? "store credit" : "cash"}`,
          metadata: JSON.parse(JSON.stringify({
            original_ledger_entry_id,
            return_id: posReturn.id,
            refund_method,
            reason,
            items: items.map((i) => ({
              inventory_item_id: i.inventory_item_id,
              name: i.name,
              quantity: i.quantity,
              price_cents: i.price_cents,
              restock: i.restock,
            })),
            restocking_fee_cents,
            credit_bonus_percent: effectiveBonusPercent,
            ...(client_tx_id ? { client_tx_id } : {}),
          })),
        },
      });

      // Update return with ledger entry ID
      await tx.posReturn.update({
        where: { id: posReturn.id },
        data: { ledger_entry_id: ledgerEntry.id },
      });

      // If store credit refund, increment customer balance (scoped by store)
      if (refund_method === "store_credit" && originalSale.customer_id) {
        await tx.posCustomer.update({
          where: { id: originalSale.customer_id, store_id: storeId },
          data: {
            credit_balance_cents: { increment: total_refund_cents },
          },
        });
      }

      // Restock inventory for items marked for restock
      for (const item of items) {
        if (item.restock && item.inventory_item_id) {
          await tx.posInventoryItem.update({
            where: { id: item.inventory_item_id },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }

      return { posReturn, ledgerEntry };
    });

    return NextResponse.json(
      {
        id: result.posReturn.id,
        total_refund_cents,
        refund_method,
        ledger_entry_id: result.ledgerEntry.id,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
