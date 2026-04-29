/**
 * GET /api/integrations/[id]/search?q=...
 *
 * Generic search proxy. Routes to the adapter for the named integration.
 * Used by the inventory edit page's per-category lookup UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { getIntegration } from "@/lib/integrations/registry";
import { getAdapter } from "@/lib/integrations";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    await requireStaff();

    const def = getIntegration(id);
    if (!def) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });

    const adapter = getAdapter(id);
    if (!adapter?.search) {
      return NextResponse.json({ error: `${def.name} doesn't support search` }, { status: 400 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ error: "q parameter required" }, { status: 400 });

    const limit = Math.min(20, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10);
    const results = await adapter.search(q, { limit });
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error && /not set/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleAuthError(error);
  }
}
