-- PII access audit log. Every read/write that touches customer personal data
-- gets a row here. Retention: 365 days, then purged by /api/cron/retention.

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "actorUserId"   TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "actorEmail"    TEXT,
  "actorRole"     TEXT,                       -- 'admin' | 'entity_owner' | 'entity_member' | 'system' | 'webhook'
  "action"        TEXT NOT NULL,              -- 'customer.lookup' | 'points.award' | 'entity.approve' | etc.
  "targetType"    TEXT,                       -- 'User' | 'AfterroarEntity' | 'EntityConsent' | etc.
  "targetId"      TEXT,
  "entityId"      TEXT,                       -- scope of the access, if applicable
  "scopesUsed"    TEXT[],                     -- scopes that gated the access
  "metadata"      JSONB DEFAULT '{}',
  "ipHash"        TEXT,                       -- SHA-256 of client IP (we don't log raw IPs)
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_targetId_idx" ON "AuditLog"("targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
