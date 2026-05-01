import { auth } from '@/lib/auth-config';
import { redirect } from 'next/navigation';

/**
 * Simple admin allowlist via env var. Comma-separated list of emails.
 *
 *   ADMIN_EMAILS=shawnoah.pollock@gmail.com,info@fulluproar.com
 *
 * Per `feedback_credo_interpretation.md`: a platform super-admin role
 * for running the platform itself is fine; what the Credo prohibits is
 * preferential commercial/data access. Admin tooling for ops use is
 * the former, not the latter.
 *
 * Future hardening: move to a User.role field with multi-tier RBAC
 * once the network outgrows a 2-3 person admin team. For now, env-list
 * is sufficient and avoids schema lock-in before the access patterns
 * settle.
 */

function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAdminSession() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  if (!adminEmailSet().has(email)) return null;
  return session;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/login?callbackUrl=/admin/users');
  }
  return session!;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.toLowerCase());
}
