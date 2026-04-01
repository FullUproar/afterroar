import { NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";

/* ------------------------------------------------------------------ */
/*  GET /api/customers/segments — customer list with auto segments     */
/* ------------------------------------------------------------------ */

export type CustomerSegment = "vip" | "regular" | "new" | "at_risk" | "dormant" | "active";

export interface SegmentedCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  credit_balance_cents: number;
  created_at: string;
  segment: CustomerSegment;
  lifetime_spend_cents: number;
  purchases_30d: number;
  last_purchase_date: string | null;
}

export interface SegmentCounts {
  vip: number;
  regular: number;
  new: number;
  at_risk: number;
  dormant: number;
  active: number;
  total: number;
}

export async function GET() {
  try {
    const { db } = await requireStaff();

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const customers = await db.posCustomer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        credit_balance_cents: true,
        created_at: true,
        ledger_entries: {
          where: { type: "sale" },
          select: { amount_cents: true, created_at: true },
          orderBy: { created_at: "desc" as const },
        },
      },
      orderBy: { name: "asc" },
    });

    const segmentCounts: SegmentCounts = {
      vip: 0,
      regular: 0,
      new: 0,
      at_risk: 0,
      dormant: 0,
      active: 0,
      total: customers.length,
    };

    const segmented: SegmentedCustomer[] = customers.map((c) => {
      const lifetimeSpend = c.ledger_entries.reduce((s, e) => s + e.amount_cents, 0);
      const purchases30d = c.ledger_entries.filter(
        (e) => new Date(e.created_at) >= thirtyDaysAgo
      ).length;
      const lastPurchase = c.ledger_entries.length > 0 ? c.ledger_entries[0].created_at : null;
      const lastPurchaseDate = lastPurchase ? new Date(lastPurchase) : null;

      let segment: CustomerSegment;

      if (lifetimeSpend >= 50000) {
        // $500+ lifetime = VIP
        segment = "vip";
      } else if (purchases30d >= 3) {
        // 3+ purchases in 30 days = Regular
        segment = "regular";
      } else if (new Date(c.created_at) >= fourteenDaysAgo) {
        // Created in last 14 days = New
        segment = "new";
      } else if (
        lifetimeSpend >= 10000 &&
        lastPurchaseDate &&
        lastPurchaseDate < thirtyDaysAgo
      ) {
        // $100+ lifetime but no purchase in 30+ days = At Risk
        if (lastPurchaseDate < sixtyDaysAgo) {
          segment = "dormant";
        } else {
          segment = "at_risk";
        }
      } else {
        segment = "active";
      }

      segmentCounts[segment]++;

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        credit_balance_cents: c.credit_balance_cents,
        created_at: c.created_at.toISOString(),
        segment,
        lifetime_spend_cents: lifetimeSpend,
        purchases_30d: purchases30d,
        last_purchase_date: lastPurchase
          ? new Date(lastPurchase).toISOString()
          : null,
      };
    });

    return NextResponse.json({ customers: segmented, counts: segmentCounts });
  } catch (error) {
    return handleAuthError(error);
  }
}
