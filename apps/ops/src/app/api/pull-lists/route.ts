/**
 * GET  /api/pull-lists  — list pull lists (filterable by customer/series/status)
 * POST /api/pull-lists  — create a new pull list (subscriber + series)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

export async function GET(req: NextRequest) {
  try {
    const { db } = await requirePermission("customers.view");
    const customerId = req.nextUrl.searchParams.get("customer_id");
    const seriesQuery = req.nextUrl.searchParams.get("q");
    const status = req.nextUrl.searchParams.get("status") ?? "active";

    const lists = await db.posPullList.findMany({
      where: {
        ...(customerId ? { customer_id: customerId } : {}),
        ...(status === "all" ? {} : { status }),
        ...(seriesQuery ? { series_title: { contains: seriesQuery, mode: "insensitive" as const } } : {}),
      },
      orderBy: { updated_at: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          where: { status: { in: ["pending", "held"] } },
          orderBy: { created_at: "desc" },
          take: 5,
        },
        _count: { select: { items: true } },
      },
      take: 200,
    });

    return NextResponse.json({ pullLists: lists });
  } catch (error) {
    return handleAuthError(error);
  }
}

interface CreateBody {
  customer_id?: string;
  series_title?: string;
  publisher?: string;
  wants_variants?: boolean;
  qty_per_issue?: number;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("customers.edit");

    let body: CreateBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.customer_id || !body.series_title?.trim()) {
      return NextResponse.json(
        { error: "customer_id and series_title are required" },
        { status: 400 },
      );
    }

    // Reject duplicate active pull list for the same customer + series.
    const dup = await db.posPullList.findFirst({
      where: {
        customer_id: body.customer_id,
        series_title: { equals: body.series_title.trim(), mode: "insensitive" },
        status: { in: ["active", "paused"] },
      },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Customer already has an active pull list for this series", existing: dup },
        { status: 409 },
      );
    }

    const list = await db.posPullList.create({
      data: {
        store_id: storeId,
        customer_id: body.customer_id,
        series_title: body.series_title.trim(),
        publisher: body.publisher?.trim() || null,
        wants_variants: body.wants_variants ?? false,
        qty_per_issue: Math.max(1, body.qty_per_issue ?? 1),
        notes: body.notes?.trim() || null,
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ pullList: list }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
