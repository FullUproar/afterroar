/**
 * Decrement linked inventory items when a menu item sells.
 *
 * Lookup PosMenuRecipe rows for the menu item, multiply each
 * `quantity_used` by the qty sold, decrement the linked PosInventoryItem.
 *
 * Conflict policy mirrors the register's cash-sale handler: oversold
 * (decrement-into-negative) is allowed but reported, so the operator's
 * reconciliation queue can surface it. We do NOT block the sale.
 *
 * Usage from a sale handler:
 *
 *   await decrementMenuRecipeOnSale(tx, {
 *     menu_item_id: "abc",
 *     quantity_sold: 2,
 *   });
 *
 * If the menu item has no recipe, the call is a no-op (and that's fine —
 * not every menu item has ingredient-level tracking).
 */

import type { Prisma } from "@prisma/client";

export interface RecipeDecrementResult {
  /** Per-ingredient outcome. Empty array if no recipe defined. */
  decremented: Array<{
    inventory_item_id: string;
    inventory_item_name: string;
    quantity_consumed: number;
    quantity_after: number;
    oversold: boolean;
  }>;
}

export async function decrementMenuRecipeOnSale(
  tx: Prisma.TransactionClient,
  input: { menu_item_id: string; quantity_sold: number },
): Promise<RecipeDecrementResult> {
  const recipes = await tx.posMenuRecipe.findMany({
    where: { menu_item_id: input.menu_item_id },
    include: { inventory_item: { select: { id: true, name: true, quantity: true } } },
  });
  if (recipes.length === 0) return { decremented: [] };

  const out: RecipeDecrementResult["decremented"] = [];
  for (const r of recipes) {
    const qToDecrement = Number(r.quantity_used) * input.quantity_sold;
    const newQty = r.inventory_item.quantity - qToDecrement;
    await tx.posInventoryItem.update({
      where: { id: r.inventory_item_id },
      // Decimal multiplication produces floats; round to whole units for the
      // PosInventoryItem.quantity (Int) column. If a recipe needs fractional
      // tracking (e.g. 0.25 of a bottle), the inventory item itself should be
      // measured in fractional units (e.g. ml) at receive time.
      data: { quantity: { decrement: Math.ceil(qToDecrement) } },
    });
    out.push({
      inventory_item_id: r.inventory_item_id,
      inventory_item_name: r.inventory_item.name,
      quantity_consumed: qToDecrement,
      quantity_after: newQty,
      oversold: newQty < 0,
    });
  }
  return { decremented: out };
}
