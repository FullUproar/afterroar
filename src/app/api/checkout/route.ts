import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPayment, PaymentMethod } from "@/lib/payment";

interface CheckoutItem {
  inventory_item_id: string;
  quantity: number;
  price_cents: number;
}

interface CheckoutBody {
  items: CheckoutItem[];
  customer_id: string | null;
  payment_method: PaymentMethod;
  amount_tendered_cents: number;
  credit_applied_cents: number;
  event_id: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get staff record
  const { data: staff } = await supabase
    .from("staff")
    .select("id, store_id")
    .eq("user_id", user.id)
    .single();

  if (!staff) {
    return NextResponse.json(
      { error: "No store assignment found" },
      { status: 403 }
    );
  }

  // Parse body
  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    items,
    customer_id,
    payment_method,
    amount_tendered_cents,
    credit_applied_cents,
    event_id,
  } = body;

  if (!items?.length) {
    return NextResponse.json(
      { error: "At least one item is required" },
      { status: 400 }
    );
  }

  // 1. Validate all items exist and have sufficient quantity
  const itemIds = items.map((i) => i.inventory_item_id);
  const { data: invItems, error: invError } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, price_cents")
    .eq("store_id", staff.store_id)
    .in("id", itemIds);

  if (invError) {
    return NextResponse.json({ error: invError.message }, { status: 500 });
  }

  if (!invItems || invItems.length !== itemIds.length) {
    return NextResponse.json(
      { error: "One or more items not found" },
      { status: 400 }
    );
  }

  const invMap = new Map(invItems.map((i) => [i.id, i]));
  for (const item of items) {
    const inv = invMap.get(item.inventory_item_id);
    if (!inv) {
      return NextResponse.json(
        { error: `Item ${item.inventory_item_id} not found` },
        { status: 400 }
      );
    }
    if (inv.quantity < item.quantity) {
      return NextResponse.json(
        {
          error: `Insufficient quantity for "${inv.name}". Available: ${inv.quantity}, requested: ${item.quantity}`,
        },
        { status: 400 }
      );
    }
  }

  // 2. Calculate subtotal
  const subtotal_cents = items.reduce(
    (sum, i) => sum + i.price_cents * i.quantity,
    0
  );

  // 3. Validate store credit if applicable
  const effectiveCreditApplied = credit_applied_cents || 0;

  if (
    (payment_method === "store_credit" || payment_method === "split") &&
    effectiveCreditApplied > 0
  ) {
    if (!customer_id) {
      return NextResponse.json(
        { error: "Customer is required for store credit payments" },
        { status: 400 }
      );
    }
    const { data: customer } = await supabase
      .from("customers")
      .select("credit_balance_cents")
      .eq("id", customer_id)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 400 }
      );
    }
    if (customer.credit_balance_cents < effectiveCreditApplied) {
      return NextResponse.json(
        {
          error: `Insufficient store credit. Balance: ${customer.credit_balance_cents}, required: ${effectiveCreditApplied}`,
        },
        { status: 400 }
      );
    }
  }

  // 4. Process payment
  const cashPortion = subtotal_cents - effectiveCreditApplied;
  const paymentResult = await processPayment(
    payment_method === "store_credit" ? "store_credit" : payment_method,
    cashPortion,
    effectiveCreditApplied > 0 ? effectiveCreditApplied : undefined
  );

  if (!paymentResult.success) {
    return NextResponse.json(
      { error: paymentResult.error || "Payment failed" },
      { status: 400 }
    );
  }

  // 5. Create sale ledger entry
  const itemNames = items
    .map((i) => {
      const inv = invMap.get(i.inventory_item_id);
      return `${inv?.name} x${i.quantity}`;
    })
    .join(", ");

  const { data: ledgerEntry, error: ledgerError } = await supabase
    .from("ledger_entries")
    .insert({
      store_id: staff.store_id,
      type: "sale",
      customer_id,
      staff_id: staff.id,
      event_id,
      amount_cents: subtotal_cents,
      credit_amount_cents: effectiveCreditApplied,
      description: `Sale: ${itemNames}`,
      metadata: {
        items,
        payment_method,
        transaction_id: paymentResult.transaction_id,
        amount_tendered_cents,
      },
    })
    .select("id")
    .single();

  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  // 6. If credit was applied, create credit_redeem ledger entry and update balance
  if (effectiveCreditApplied > 0 && customer_id) {
    await supabase.from("ledger_entries").insert({
      store_id: staff.store_id,
      type: "credit_redeem",
      customer_id,
      staff_id: staff.id,
      event_id: null,
      amount_cents: 0,
      credit_amount_cents: -effectiveCreditApplied,
      description: `Store credit redeemed for sale`,
      metadata: { sale_ledger_entry_id: ledgerEntry.id },
    });

    // Deduct customer credit balance via RPC, with fallback
    const { error: rpcError } = await supabase.rpc(
      "increment_credit_balance",
      {
        p_customer_id: customer_id,
        p_amount: -effectiveCreditApplied,
      }
    );

    if (rpcError) {
      const { data: customer } = await supabase
        .from("customers")
        .select("credit_balance_cents")
        .eq("id", customer_id)
        .single();

      if (customer) {
        await supabase
          .from("customers")
          .update({
            credit_balance_cents:
              (customer.credit_balance_cents || 0) - effectiveCreditApplied,
          })
          .eq("id", customer_id);
      }
    }
  }

  // 7. Deduct inventory quantities
  for (const item of items) {
    const inv = invMap.get(item.inventory_item_id)!;
    await supabase
      .from("inventory_items")
      .update({ quantity: inv.quantity - item.quantity })
      .eq("id", item.inventory_item_id);
  }

  // 8. Return success
  const change_cents =
    payment_method === "cash" || payment_method === "split"
      ? Math.max(0, amount_tendered_cents - (subtotal_cents - effectiveCreditApplied))
      : 0;

  return NextResponse.json(
    {
      success: true,
      ledger_entry_id: ledgerEntry.id,
      change_cents,
      subtotal_cents,
    },
    { status: 201 }
  );
}
