import crypto from 'node:crypto';

/**
 * Cross-app check: does this email have an approved BusinessApplication
 * for the given tier on the HQ side?
 *
 * Calls the HQ-side internal endpoint with an HMAC-signed request.
 * Shared secret lives in BUSINESS_APPROVAL_CHECK_SECRET on both
 * Vercel projects.
 *
 * Fails closed: if the network fails, the secret is missing, or the
 * signature can't be verified, we treat it as "not approved" and let
 * the caller refuse the underlying action. Safer than failing open
 * and letting bad actors slip through during an HQ outage.
 *
 * @param email applicant's email (case-insensitive)
 * @param tier 'connect' or 'store_ops'
 */
export interface ApprovalResult {
  approved: boolean;
  applicationId: string | null;
  trialExpiresAt: string | null;
  approvedAt: string | null;
  /** Diagnostic string when approved=false. */
  reason?: string;
}

export async function checkBusinessApproval(
  email: string,
  tier: 'connect' | 'store_ops',
): Promise<ApprovalResult> {
  const root = process.env.BUSINESS_APPROVAL_CHECK_SECRET;
  if (!root) {
    console.warn('[business-approval] BUSINESS_APPROVAL_CHECK_SECRET not configured — failing closed');
    return { approved: false, applicationId: null, trialExpiresAt: null, approvedAt: null, reason: 'secret_missing' };
  }

  const hqBase = process.env.HQ_BASE_URL || 'https://hq.fulluproar.com';
  const normalizedEmail = email.trim().toLowerCase();
  const ts = String(Math.floor(Date.now() / 1000));

  // Derive the same domain-separated key the HQ side computes, then
  // sign the (email|tier|ts) payload.
  const key = crypto.createHmac('sha256', root).update('internal:business-approval-check').digest();
  const sig = crypto.createHmac('sha256', key).update(`${normalizedEmail}|${tier}|${ts}`).digest('hex');

  const url = `${hqBase}/api/internal/business-approval?email=${encodeURIComponent(normalizedEmail)}&tier=${encodeURIComponent(tier)}&ts=${ts}&sig=${sig}`;

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[business-approval] HQ returned ${res.status} for ${normalizedEmail}`);
      return { approved: false, applicationId: null, trialExpiresAt: null, approvedAt: null, reason: `http_${res.status}` };
    }
    const data = await res.json();
    return {
      approved: !!data.approved,
      applicationId: data.applicationId ?? null,
      trialExpiresAt: data.trialExpiresAt ?? null,
      approvedAt: data.approvedAt ?? null,
      reason: data.reason,
    };
  } catch (err) {
    console.warn('[business-approval] HQ fetch failed:', err);
    return { approved: false, applicationId: null, trialExpiresAt: null, approvedAt: null, reason: 'fetch_failed' };
  }
}
