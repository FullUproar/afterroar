/**
 * Afterroar API key — server-to-server federation auth.
 *
 * Format: `ar_live_<32 random chars>` (or `ar_test_…` for non-prod).
 * The PREFIX (first 8 chars after `ar_live_`) is what we display in admin UI;
 * full key is shown ONCE at mint time and never again.
 *
 * Storage: only the SHA-256 hash + prefix are persisted. Loss of the full key
 * means revoke + re-mint, never recover.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const KEY_BYTES = 24; // 24 bytes → 32 base64url chars

export interface MintedKey {
  /** The full secret. Show once, never persist. */
  fullKey: string;
  /** First 8 chars of the random part — safe to display anywhere. */
  prefix: string;
  /** SHA-256 of the full key — what's stored. */
  hash: string;
}

export function mintKey(env: "live" | "test" = "live"): MintedKey {
  const random = randomBytes(KEY_BYTES).toString("base64url");
  const fullKey = `ar_${env}_${random}`;
  const prefix = `ar_${env}_${random.slice(0, 8)}`;
  const hash = hashKey(fullKey);
  return { fullKey, prefix, hash };
}

export function hashKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

/** Pull the API key from the request headers. Header name: `X-API-Key`. */
export function extractKey(req: Request): string | null {
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization");
  if (!header) return null;
  // Accept either raw key or "Bearer ar_live_..."
  return header.replace(/^Bearer\s+/i, "").trim() || null;
}

export interface VerifiedKey {
  id: string;
  scopes: string[];
  name: string;
  prefix: string;
}

/**
 * Look up + verify a presented API key.
 * Returns null on any failure (not found, revoked, expired).
 * Never throws — middleware should treat null as "401 Unauthorized."
 */
export async function verifyKey(presentedKey: string): Promise<VerifiedKey | null> {
  if (!presentedKey || !presentedKey.startsWith("ar_")) return null;
  const hash = hashKey(presentedKey);

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, scopes: true, name: true, keyPrefix: true, revokedAt: true, expiresAt: true },
  });
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  return {
    id: row.id,
    scopes: row.scopes,
    name: row.name,
    prefix: row.keyPrefix,
  };
}

/** Bump lastUsedAt + usageCount. Fire-and-forget; failures don't block the request. */
export function bumpUsage(apiKeyId: string): void {
  prisma.apiKey
    .update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    })
    .catch((err) => {
      console.error("[api-key] bumpUsage failed:", err);
    });
}

/** True iff `presented` is a member of `required`, OR holds an "admin" wildcard scope. */
export function hasScope(presented: string[], required: string): boolean {
  if (presented.includes("admin:*")) return true;
  if (presented.includes(required)) return true;
  // Allow `read:venues:*` to satisfy `read:venues:inventory`
  const [verb, resource] = required.split(":");
  if (resource && presented.includes(`${verb}:${resource}:*`)) return true;
  return false;
}
