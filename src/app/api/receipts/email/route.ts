import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

interface ReceiptItem {
  name: string;
  quantity: number;
  price_cents: number;
  total_cents: number;
}

interface ReceiptData {
  store_name: string;
  date: string;
  items: ReceiptItem[];
  subtotal_cents: number;
  credit_applied_cents: number;
  payment_method: string;
  total_cents: number;
  change_cents: number;
  customer_name: string | null;
}

interface EmailReceiptBody {
  customer_email: string;
  receipt: ReceiptData;
}

export async function POST(request: NextRequest) {
  try {
    await requireStaff();

    let body: EmailReceiptBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { customer_email, receipt } = body;

    if (!customer_email?.trim()) {
      return NextResponse.json(
        { error: "customer_email is required" },
        { status: 400 }
      );
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "receipt data is required" },
        { status: 400 }
      );
    }

    // TODO: integrate with Resend/SendGrid for actual email delivery
    console.log("Receipt email to:", customer_email, receipt);

    return NextResponse.json({
      success: true,
      message: "Receipt queued (email not yet configured)",
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
