import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

/**
 * Helper for writing admin-action audit rows. Called from every
 * server action that mutates state via /admin/*.
 *
 * Privacy: snapshots are explicit allowlists, NEVER raw user objects.
 * passwordHash, dateOfBirth, and any token/secret field must NEVER
 * appear in beforeState/afterState. Caller is responsible for picking
 * the snapshot fields; this helper just persists what it's given.
 *
 * Best-effort persistence: failures don't block the underlying admin
 * action (log row is missing, action still happened — fail open). Write
 * to console.error so the gap is at least visible in Vercel logs.
 */
export interface AdminAuditEntry {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null;
    const userAgent = h.get('user-agent') || null;

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: entry.adminUserId,
        action: entry.action,
        targetType: entry.targetType ?? 'user',
        targetId: entry.targetId ?? null,
        beforeState: (entry.beforeState as never) ?? null,
        afterState: (entry.afterState as never) ?? null,
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[admin-audit] log write failed:', err);
  }
}

/**
 * Pick a safe subset of User fields for audit snapshots. Explicitly
 * omits passwordHash, dateOfBirth, and anything token-shaped. If a new
 * sensitive field is added to User, this picker must be updated to
 * exclude it. Default-deny is the safer pattern; this is the allowlist.
 */
export function userAuditSnapshot(user: {
  id?: string;
  email?: string | null;
  displayName?: string | null;
  username?: string | null;
  membershipTier?: string;
  emailVerified?: Date | null;
  identityVerified?: boolean;
  isFrozen?: boolean;
  accountStatus?: string;
  defaultVisibility?: string;
  isMinor?: boolean;
  parentUserId?: string | null;
}): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    membershipTier: user.membershipTier,
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
    identityVerified: user.identityVerified,
    isFrozen: user.isFrozen,
    accountStatus: user.accountStatus,
    defaultVisibility: user.defaultVisibility,
    isMinor: user.isMinor,
    parentUserId: user.parentUserId,
  };
}
