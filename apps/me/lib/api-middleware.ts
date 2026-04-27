/**
 * `withApiKey(handler, requiredScope)` — wraps a Next.js route handler with
 * API-key auth + usage logging.
 *
 * Logs every request (success or failure) to ApiUsageLog asynchronously.
 * The endpoint is logged as the URL pathname (no query string, no PII).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractKey, verifyKey, hasScope, bumpUsage } from "./api-key";

type RouteHandler<TParams> = (
  req: NextRequest,
  ctx: { params: Promise<TParams>; apiKey: { id: string; scopes: string[]; name: string; prefix: string } },
) => Promise<NextResponse>;

export function withApiKey<TParams>(
  handler: RouteHandler<TParams>,
  requiredScope: string,
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    const start = Date.now();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const endpoint = new URL(req.url).pathname;
    const method = req.method;

    let apiKeyId: string | null = null;
    let status = 500;
    let errorCode: string | null = null;
    let response: NextResponse;

    try {
      const presented = extractKey(req);
      if (!presented) {
        status = 401;
        errorCode = "missing_key";
        response = NextResponse.json({ error: "Missing X-API-Key header" }, { status });
      } else {
        const verified = await verifyKey(presented);
        if (!verified) {
          status = 401;
          errorCode = "invalid_key";
          response = NextResponse.json({ error: "Invalid or revoked API key" }, { status });
        } else if (!hasScope(verified.scopes, requiredScope)) {
          apiKeyId = verified.id;
          status = 403;
          errorCode = "scope_denied";
          response = NextResponse.json(
            { error: `Missing required scope: ${requiredScope}` },
            { status },
          );
        } else {
          apiKeyId = verified.id;
          bumpUsage(verified.id);
          response = await handler(req, { ...ctx, apiKey: verified });
          status = response.status;
        }
      }
    } catch (err) {
      console.error("[api-middleware] handler threw:", err);
      status = 500;
      errorCode = "handler_error";
      response = NextResponse.json({ error: "Internal server error" }, { status });
    }

    // Fire-and-forget usage log
    const latencyMs = Date.now() - start;
    prisma.apiUsageLog
      .create({
        data: { apiKeyId, endpoint, method, status, latencyMs, ip, errorCode },
      })
      .catch((err) => console.error("[api-middleware] usage log failed:", err));

    // Always set rate-limit-style headers so callers can self-monitor
    response.headers.set("X-API-Latency-Ms", String(latencyMs));
    return response;
  };
}
