# Afterroar Connect — Security & Data Handling Policy

**Owner:** Shawn Pollock, Full Uproar Games Inc.
**Last updated:** 2026-04-14
**Review cadence:** quarterly, or after any material change to data flows

This document is the source of truth for how Afterroar handles customer
personal data on behalf of stores using Afterroar Connect. It exists to
answer compliance questionnaires (Shopify App Store, Square App Marketplace,
enterprise customer security reviews) honestly and with working links to
the code that implements each commitment.

## 1. Data we handle

Afterroar Connect processes the following personal data on behalf of
Connect-enabled stores:
- **Email address** — for matching incoming orders to Passport accounts
- **Display name** — shown on merchant dashboards during customer lookup
- **Passport code** — 8-character identifier that the customer controls
- **Loyalty points balance + transaction history** — store-scoped
- **Wishlist + library items** — only if the scope was granted
- **Connection grants (EntityConsent)** — records of which stores can see what

**We do not store:**
- Customer payment methods or card data (Stripe/Shopify handle this)
- Customer addresses or phone numbers
- Shopping behavior beyond what's in a granted scope
- Shopify-side customer records (we match-and-forward, never replicate)

## 2. Retention

| Data | Retention | Enforced by |
|---|---|---|
| User records | Indefinite while active; deleted on customer request within 30 days | `/api/delete-account` |
| Webhook event payloads (raw PII) | **30 days**, then stripped in place | [`/api/cron/retention`](../apps/me/app/api/cron/retention/route.ts) |
| Webhook event metadata (dedupe key, result) | **180 days**, then row deleted | same cron |
| OAuth state nonces (Shopify CSRF) | Deleted 1 day after expiry (10-minute TTL) | same cron |
| Consent request tokens | Deleted 7 days after expiry (15-minute TTL) | same cron |
| Audit logs | **365 days**, then row deleted | scheduled in next cron iteration |
| Stripe webhooks | Handled by Stripe; we store only the subscription status |

Cron runs daily at 07:00 UTC via Vercel Cron ([vercel.json](../apps/me/vercel.json)).

## 3. Encryption

| Layer | Mechanism |
|---|---|
| **At rest** | Neon PostgreSQL encrypts all data with AES-256. [Neon docs](https://neon.tech/docs/security/security-overview). |
| **In transit** | All client-server traffic is HTTPS (Vercel-provisioned TLS). Database connections use `sslmode=require`. |
| **Backups** | Neon's automated point-in-time recovery snapshots are encrypted with the same AES-256 keys as the primary database. |
| **Access tokens (Shopify OAuth)** | Stored in the `ShopifyConnection.accessToken` column. Planned: envelope encryption at rest using a KMS key (phase 2 — current encryption at the column level is provided by Neon's disk-level AES-256). |
| **Audit IP addresses** | We never store raw IPs. Hashed with SHA-256 and an `AUDIT_IP_SALT` before storage. See [lib/audit.ts](../apps/me/lib/audit.ts). |

## 4. Test / production separation

- Production database: Neon main branch, `DATABASE_URL` set in Vercel production environment.
- Test database: a separate Neon branch (`test-api`). Tests refuse to run against production via a safety guard in [tests/api/setup.ts](../apps/me/tests/api/setup.ts) that:
  - Rejects empty `DATABASE_URL`
  - Rejects production-looking URLs (must contain `test`, `dev`, or `staging`)
  - Requires `TEST_DB_OK=1` to explicitly acknowledge a test DB
- No production data is ever copied into a test database. Test data is generated per-test with unique IDs.
- Local development uses each developer's own Neon dev branch.

## 5. Data loss prevention

- **Backups:** Neon provides continuous point-in-time recovery (7 days on free tier, 30+ days on paid). We do not need to manage backups separately.
- **Recovery procedure:** documented in section 10 below.
- **Access controls:** database connection string held only in Vercel environment variables. Neon console access limited to the owner (Shawn). Admin app access limited to the allowlist in [lib/admin.ts](../apps/me/lib/admin.ts).
- **Monitoring:** Vercel access logs capture every request. Every PII-touching action writes to the `AuditLog` table (see section 7).
- **No bulk export endpoints** exist. The only export path is `/api/export-data` which returns data for the *authenticated* user only.
- **Rate limiting:** Vercel provides basic DDoS protection. Application-level rate limiting on sensitive endpoints (points award, customer lookup) is planned when real abuse patterns emerge.

## 6. Access control (staff)

Afterroar is operated by a single founder (Shawn Pollock) at this time. "Staff access" means:

- **Application admin access** (`/admin/entities`) — gated on email allowlist in [lib/admin.ts](../apps/me/lib/admin.ts). Every action is audit-logged (see section 7).
- **Database access** — Neon console access limited to the owner's Google account with 2FA required.
- **Vercel project access** — owner only, with 2FA required.
- **Infrastructure secrets** — all secrets (DATABASE_URL, SHOPIFY_API_SECRET, AUDIT_IP_SALT, CRON_SECRET) live in Vercel environment variables, never in source control.

**Password requirements:** Staff authentication is delegated to Google OAuth (for the owner) and enforced via Google's password policy + mandatory 2FA on all admin accounts. We do not issue application-level passwords for staff. When additional staff join, Google OAuth + 2FA enforcement continues.

**Principle of least privilege:** Additions of staff (future) will follow role-based access — entity owners see their own entity only; platform admins see the admin panel only when their email is on the allowlist.

## 7. Audit logging

Every access to customer personal data is recorded in the `AuditLog` table ([migration](../packages/database/sql-migrations/2026-04-14_audit-log.sql), [helper](../apps/me/lib/audit.ts)).

| Action | What it logs |
|---|---|
| `customer.lookup` | Store member looked up a customer by Passport code |
| `points.earn` / `points.redeem` | Store awarded or redeemed loyalty points |
| `consent.grant` | Customer granted consent to an entity |
| `consent.revoke` | Customer revoked consent |
| `entity.approve` / `entity.suspend` / `entity.reject` / `entity.reopen` | Admin action on an entity application |

Each row records the actor's user id + email + role, the target, the entity scope, the scopes gating the access, and a SHA-256-hashed client IP.

Retention: 365 days.

## 8. Incident response

**Scope:** any event that could result in unauthorized access to personal data, loss of data integrity, or service interruption lasting more than 1 hour.

**Response SLA:**
- P0 (active data breach, data loss, full outage): immediate response, public status update within 2 hours, post-mortem within 72 hours
- P1 (credential exposure, partial data access bug, partial outage): response within 4 hours, mitigation within 24 hours
- P2 (potential vulnerability, no active exploitation): mitigation within 7 days

**Response steps:**
1. **Contain.** Revoke compromised credentials (rotate API keys, OAuth secrets, DB password), disable affected endpoints via Vercel deployment protection if needed.
2. **Assess.** Query `AuditLog` for the affected time window. Identify which customers' data was accessed and what scopes.
3. **Notify.** Email every affected customer within 72 hours with: what happened, what data was involved, what we've done, what they should do.
4. **Notify Shopify/integration partners** if the incident involved their APIs or tokens — per their respective notification terms.
5. **Remediate.** Patch the underlying issue, add a test that would have caught it, update this policy if the response process needs changes.
6. **Post-mortem.** Written write-up within 72 hours covering timeline, root cause, mitigation, prevention. Published internally; summarized to affected customers.

**Reporting path:** incidents can be reported by anyone to `security@afterroar.me` (to be configured before launch). Internal reports: Shawn (primary), AI-assisted incident response for triage.

**Last tabletop:** not yet run — scheduled before first paying customer.

## 9. Third-party security audits / certifications

Current status: **none**.

We have not commissioned third-party security audits, penetration tests, or certifications (SOC 2, ISO 27001, etc.) as of 2026-04-14.

**Why:** at pre-revenue / single-founder scale, certifications cost $15K-$50K+ and months of process, which is disproportionate to current risk exposure. Our customers to date are small businesses ($49/mo subscriptions) selling to consumer end users; no regulated data (HIPAA, PCI at the merchant-of-record level, GDPR large-scale processor thresholds) is involved.

**When this changes:**
- First enterprise customer with a real security questionnaire → informal pentest + SOC 2 Type I
- Revenue / customer count crossing where the cost is rational → SOC 2 Type II
- Regulated data (HIPAA for game therapy use cases, etc.) → independent audit of that specific pathway before processing

Until then: we rely on Neon's SOC 2 Type II, Vercel's SOC 2 Type II, Stripe's PCI DSS Level 1, and Shopify's SOC 2 Type II for infrastructure-layer certifications. Application-layer certifications will follow customer demand.

## 10. Backup & recovery procedure

**Backups:** Neon provides automated point-in-time recovery. No manual backup jobs required.

**Recovery RTO (target):** 1 hour for application availability, 4 hours for full data recovery.
**Recovery RPO (target):** 5 minutes of data loss in worst case (Neon's minimum PITR granularity).

**Procedure:**
1. Identify the target recovery point (in Neon console → Branches → Create branch at point-in-time)
2. Create a recovery branch at that point
3. Test the recovery branch against a staging Vercel deployment
4. Swap `DATABASE_URL` in production to the recovery branch
5. Redeploy Vercel (CLI env changes don't auto-redeploy)
6. Audit `AuditLog` for the interval between RPO and incident detection; notify any affected customers

## 11. Revision log

| Date | Change |
|---|---|
| 2026-04-14 | Initial version. Covers Shopify App Store submission + general launch readiness. |
