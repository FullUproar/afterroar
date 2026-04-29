/**
 * POST /api/integrations/[id]/test — run a test-connection ping for the
 * named integration and persist the result on PosIntegrationStatus.
 *
 * Auth: session-based, requires `store.settings`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";
import { getIntegration } from "@/lib/integrations/registry";
import { getAdapter } from "@/lib/integrations";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const { db, storeId } = await requirePermission("store.settings");

    const def = getIntegration(id);
    if (!def) {
      return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
    }

    // Adapter availability — some entries in the registry don't have adapters
    // wired yet (TCGPlayer, GW). For those we just persist "untested" with
    // a friendly note.
    const adapter = getAdapter(id);
    const missingEnv = def.requiredEnv.filter((k) => !process.env[k] || process.env[k]?.length === 0);

    let status: "ok" | "degraded" | "down" | "unconfigured" | "untested" = "untested";
    let last_latency_ms: number | null = null;
    let last_error: string | null = null;

    if (missingEnv.length > 0) {
      status = "unconfigured";
      last_error = `Missing env: ${missingEnv.join(", ")}`;
    } else if (!adapter) {
      status = "untested";
      last_error = "Adapter not wired yet";
    } else {
      const result = await adapter.testConnection();
      status = result.status;
      last_latency_ms = result.latency_ms ?? null;
      last_error = result.error ?? null;
    }

    // Persist. Per-store row when configScope=per_store, platform-wide otherwise.
    // We do findFirst+update/create instead of upsert because the unique
    // constraint is on (store_id, integration_id) where store_id can be null,
    // and Prisma's compound-unique upsert doesn't compose cleanly with null.
    const targetStoreId = def.configScope === "per_store" ? storeId : null;
    const existing = await db.posIntegrationStatus.findFirst({
      where: { store_id: targetStoreId, integration_id: id },
      select: { id: true },
    });
    if (existing) {
      await db.posIntegrationStatus.update({
        where: { id: existing.id },
        data: { status, last_tested_at: new Date(), last_latency_ms, last_error },
      });
    } else {
      await db.posIntegrationStatus.create({
        data: {
          store_id: targetStoreId,
          integration_id: id,
          status,
          last_tested_at: new Date(),
          last_latency_ms,
          last_error,
        },
      });
    }

    return NextResponse.json({
      id,
      status,
      last_latency_ms,
      last_error,
      missing_env: missingEnv,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
