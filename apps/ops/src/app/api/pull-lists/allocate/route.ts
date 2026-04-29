/**
 * POST /api/pull-lists/allocate — bulk-allocate this week's incoming issues
 *                                  to all matching pull lists.
 *
 * Workflow: shop receives the Diamond/Lunar shipment. They paste the
 * series + issue numbers into the receive UI. We match against active
 * pull lists for the same series_title (case-insensitive) and create
 * a PosPullListItem in "pending" state for each matching subscriber.
 *
 * Body shape:
 *   {
 *     "issues": [
 *       { "series_title": "Saga", "issue_number": "67", "variant_label": "Cover B" },
 *       { "series_title": "Batman", "issue_number": "150" }
 *     ],
 *     "expires_in_days": 90        // optional, default 90
 *   }
 *
 * Response shape includes per-issue counts so the UI can surface
 * "Saga #67 → 8 subscribers, 1 already had this issue allocated".
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";

interface AllocateBody {
  issues?: Array<{
    series_title: string;
    issue_number: string;
    variant_label?: string;
  }>;
  expires_in_days?: number;
}

interface AllocationResult {
  series_title: string;
  issue_number: string;
  variant_label: string | null;
  matched_lists: number;
  allocated: number;
  skipped_already_allocated: number;
  list_ids: string[];
}

export async function POST(req: NextRequest) {
  try {
    const { db, storeId } = await requirePermission("customers.edit");

    let body: AllocateBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.issues || !Array.isArray(body.issues) || body.issues.length === 0) {
      return NextResponse.json({ error: "issues array is required" }, { status: 400 });
    }

    const expiresInDays = body.expires_in_days ?? 90;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const results: AllocationResult[] = [];

    for (const issue of body.issues) {
      const series = issue.series_title?.trim();
      const num = issue.issue_number?.trim();
      const variant = issue.variant_label?.trim() || null;
      if (!series || !num) {
        results.push({
          series_title: series ?? "",
          issue_number: num ?? "",
          variant_label: variant,
          matched_lists: 0,
          allocated: 0,
          skipped_already_allocated: 0,
          list_ids: [],
        });
        continue;
      }

      // Find every active pull list matching this series. If wants_variants
      // is false, we still allocate the main copy regardless of the
      // variant_label — the variant rule applies to *additional* variant
      // copies the customer wants, not whether they get the issue at all.
      const lists = await db.posPullList.findMany({
        where: {
          store_id: storeId,
          status: "active",
          series_title: { equals: series, mode: "insensitive" },
        },
        select: { id: true, qty_per_issue: true, wants_variants: true },
      });

      let allocated = 0;
      let skipped = 0;
      const listIds: string[] = [];
      for (const list of lists) {
        // Skip variant-cover allocations for subscribers who don't want them.
        if (variant && !list.wants_variants) continue;

        // Don't double-allocate. Same list + same issue + same variant = dup.
        const existing = await db.posPullListItem.findFirst({
          where: {
            pull_list_id: list.id,
            issue_number: num,
            variant_label: variant,
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        await db.posPullListItem.create({
          data: {
            pull_list_id: list.id,
            issue_number: num,
            variant_label: variant,
            expires_at: expiresAt,
            status: "pending",
          },
        });
        allocated++;
        listIds.push(list.id);
      }

      results.push({
        series_title: series,
        issue_number: num,
        variant_label: variant,
        matched_lists: lists.length,
        allocated,
        skipped_already_allocated: skipped,
        list_ids: listIds,
      });
    }

    const totals = results.reduce(
      (acc, r) => ({
        allocated: acc.allocated + r.allocated,
        skipped: acc.skipped + r.skipped_already_allocated,
        unmatched: acc.unmatched + (r.matched_lists === 0 ? 1 : 0),
      }),
      { allocated: 0, skipped: 0, unmatched: 0 },
    );

    return NextResponse.json({ results, totals }, { status: 200 });
  } catch (error) {
    return handleAuthError(error);
  }
}
