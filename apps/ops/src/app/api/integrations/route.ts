/**
 * GET /api/integrations
 *
 * List every integration in the registry along with its current health
 * status (last test result + timestamp + latency). Powers the
 * /dashboard/integrations page.
 *
 * Auth: session-based, requires `store.settings`.
 */

import { NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/require-staff";
import { INTEGRATIONS } from "@/lib/integrations/registry";

export async function GET() {
  try {
    const { db, storeId } = await requirePermission("store.settings");

    // Pull both per-store and platform-wide rows. Per-store wins when both exist.
    const rows = await db.posIntegrationStatus.findMany({
      where: {
        OR: [{ store_id: storeId }, { store_id: null }],
      },
    });

    const statusByIntegration = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const existing = statusByIntegration.get(r.integration_id);
      // Prefer per-store row over platform-wide.
      if (!existing || (existing.store_id == null && r.store_id != null)) {
        statusByIntegration.set(r.integration_id, r);
      }
    }

    const augmented = INTEGRATIONS.map((def) => {
      const row = statusByIntegration.get(def.id);
      const missingEnv = def.requiredEnv.filter((k) => !process.env[k] || process.env[k]?.length === 0);
      // Override status to "unconfigured" when env is missing, regardless of last test.
      const effectiveStatus = missingEnv.length > 0 ? "unconfigured" : row?.status ?? "untested";
      return {
        id: def.id,
        name: def.name,
        kind: def.kind,
        categories: def.categories,
        description: def.description,
        docsUrl: def.docsUrl,
        configScope: def.configScope,
        requiredEnv: def.requiredEnv,
        capabilities: def.capabilities,
        active: def.active,
        priority: def.priority,
        status: effectiveStatus,
        last_tested_at: row?.last_tested_at ?? null,
        last_latency_ms: row?.last_latency_ms ?? null,
        last_error: row?.last_error ?? null,
        missing_env: missingEnv,
      };
    });

    return NextResponse.json({ integrations: augmented });
  } catch (error) {
    return handleAuthError(error);
  }
}
