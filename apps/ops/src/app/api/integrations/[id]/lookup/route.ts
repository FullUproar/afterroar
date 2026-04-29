/**
 * GET /api/integrations/[id]/lookup?ext_id=... | ?barcode=...
 *
 * Generic single-record fetch by source-native id (or barcode where
 * supported). Returns a CatalogRecord ready to merge into a PosInventoryItem.
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
    if (!adapter?.lookup) {
      return NextResponse.json({ error: `${def.name} doesn't support lookup` }, { status: 400 });
    }

    const extId = req.nextUrl.searchParams.get("ext_id");
    const barcode = req.nextUrl.searchParams.get("barcode");
    const target = (extId ?? barcode)?.trim();
    if (!target) {
      return NextResponse.json({ error: "ext_id or barcode required" }, { status: 400 });
    }

    const record = await adapter.lookup(target);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof Error && /not set/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleAuthError(error);
  }
}
