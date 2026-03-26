/* ------------------------------------------------------------------ */
/*  Import Execution Engine                                             */
/*  Applies mapped data to pos_* tables with deduplication.             */
/*  Supports dry-run mode (preview without writing).                    */
/* ------------------------------------------------------------------ */

import { prisma } from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenant-prisma";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

interface MappedRow {
  [key: string]: unknown;
}

/** Execute an import job — either dry run or commit */
export async function executeImport(
  storeId: string,
  entityType: "inventory" | "customers",
  rows: MappedRow[],
  dryRun: boolean
): Promise<ImportResult> {
  const db = getTenantClient(storeId);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  if (entityType === "inventory") {
    await executeInventoryImport(db, storeId, rows, dryRun, result);
  } else if (entityType === "customers") {
    await executeCustomerImport(db, storeId, rows, dryRun, result);
  }

  return result;
}

async function executeInventoryImport(
  db: ReturnType<typeof getTenantClient>,
  storeId: string,
  rows: MappedRow[],
  dryRun: boolean,
  result: ImportResult
) {
  // Pre-load existing items for dedup
  const existingItems = await db.posInventoryItem.findMany({
    select: { id: true, sku: true, barcode: true, name: true },
  });

  const skuMap = new Map(existingItems.filter((i) => i.sku).map((i) => [i.sku!, i.id]));
  const barcodeMap = new Map(existingItems.filter((i) => i.barcode).map((i) => [i.barcode!, i.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = String(row.name ?? "").trim();
      if (!name) {
        result.errors.push({ row: i + 1, message: "Missing name" });
        continue;
      }

      // Build attributes from nested fields
      const attributes: Record<string, unknown> = {};
      if (typeof row.attributes === "object" && row.attributes) {
        Object.assign(attributes, row.attributes);
      }

      const data = {
        store_id: storeId,
        name,
        category: String(row.category ?? "other"),
        sku: row.sku ? String(row.sku).trim() : null,
        barcode: row.barcode ? String(row.barcode).trim() : null,
        price_cents: Number(row.price_cents) || 0,
        cost_cents: Number(row.cost_cents) || 0,
        quantity: Math.max(0, Math.round(Number(row.quantity) || 0)),
        attributes,
        external_id: row.external_id ? String(row.external_id) : null,
        active: true,
      };

      // Dedup: match by SKU, then barcode
      let existingId: string | undefined;
      if (data.sku) existingId = skuMap.get(data.sku);
      if (!existingId && data.barcode) existingId = barcodeMap.get(data.barcode);

      if (existingId) {
        // Update existing item
        if (!dryRun) {
          await db.posInventoryItem.update({
            where: { id: existingId },
            data: {
              name: data.name,
              category: data.category,
              price_cents: data.price_cents,
              cost_cents: data.cost_cents,
              quantity: data.quantity,
              attributes: data.attributes,
              barcode: data.barcode,
              external_id: data.external_id,
            },
          });
        }
        result.updated++;
      } else {
        // Create new item
        if (!dryRun) {
          const created = await db.posInventoryItem.create({ data });
          // Update maps for subsequent dedup within same import
          if (data.sku) skuMap.set(data.sku, created.id);
          if (data.barcode) barcodeMap.set(data.barcode, created.id);
        }
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}

async function executeCustomerImport(
  db: ReturnType<typeof getTenantClient>,
  storeId: string,
  rows: MappedRow[],
  dryRun: boolean,
  result: ImportResult
) {
  // Pre-load existing customers for dedup
  const existingCustomers = await db.posCustomer.findMany({
    select: { id: true, email: true, name: true, phone: true },
  });

  const emailMap = new Map(
    existingCustomers.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = String(row.name ?? "").trim();
      if (!name) {
        result.errors.push({ row: i + 1, message: "Missing name" });
        continue;
      }

      const email = row.email ? String(row.email).trim().toLowerCase() : null;
      const phone = row.phone ? String(row.phone).trim() : null;
      const creditBalance = Number(row.credit_balance_cents) || 0;
      const notes = row.notes ? String(row.notes).trim() : null;

      // Dedup: match by email
      let existingId: string | undefined;
      if (email) existingId = emailMap.get(email);

      if (existingId) {
        // Update existing customer
        if (!dryRun) {
          await db.posCustomer.update({
            where: { id: existingId },
            data: {
              name,
              phone,
              notes,
              credit_balance_cents: creditBalance,
            },
          });
        }
        result.updated++;
      } else {
        // Create new customer
        if (!dryRun) {
          const created = await db.posCustomer.create({
            data: {
              store_id: storeId,
              name,
              email,
              phone,
              credit_balance_cents: creditBalance,
              notes,
            },
          });
          if (email) emailMap.set(email, created.id);
        }
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}
