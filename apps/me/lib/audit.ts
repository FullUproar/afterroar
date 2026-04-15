/**
 * Audit log helper — writes to the AuditLog table for any PII access or
 * privileged action. Fire-and-forget: audit failures must never block
 * legitimate user actions, so errors are swallowed and logged to console.
 *
 * Use at the access point (inside the route handler / server action),
 * after authorization has passed, before returning the sensitive data.
 */

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export type AuditRole = 'admin' | 'entity_owner' | 'entity_member' | 'system' | 'webhook' | 'self';

export interface AuditEntry {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole: AuditRole;
  /** Verb.noun, e.g. "customer.lookup", "points.award", "entity.approve". */
  action: string;
  targetType?: string;
  targetId?: string;
  entityId?: string;
  /** Scopes gating the access, if applicable ('identity', 'points', etc.). */
  scopesUsed?: string[];
  /** Safe-to-log metadata. Don't put raw PII here. */
  metadata?: Record<string, unknown>;
  /** Raw IP — will be SHA-256 hashed before storage. */
  ip?: string | null;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorEmail: entry.actorEmail ?? null,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        entityId: entry.entityId ?? null,
        scopesUsed: entry.scopesUsed ?? [],
        metadata: (entry.metadata ?? {}) as object,
        ipHash: entry.ip ? hashIp(entry.ip) : null,
      },
    });
  } catch (err) {
    // Never block the request on audit failures
    console.error('[audit] write failed:', err);
  }
}

function hashIp(ip: string): string {
  const salt = process.env.AUDIT_IP_SALT || 'afterroar-default-salt-rotate-in-prod';
  return createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 32);
}

/** Extract the best-available client IP from a NextRequest. */
export function clientIp(request: { headers: { get(name: string): string | null } }): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}
