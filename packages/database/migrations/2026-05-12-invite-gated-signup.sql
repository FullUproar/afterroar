-- 2026-05-12: Invite-only Passport signup gate.
--
-- InviteCode  — codes Shawn / staff hand out via campaigns or 1:1 outreach.
-- InviteRequest — public request submissions from /request-invite.
--
-- Single-use codes (maxUses=1) are the default. Multi-use is for booth /
-- conference scenarios. Consumption tracking on the InviteCode row is
-- light — enough to answer "did someone use this and when?".

CREATE TABLE IF NOT EXISTS "InviteCode" (
  "id"              TEXT PRIMARY KEY,
  "code"            TEXT NOT NULL UNIQUE,
  "batch"           TEXT,
  "maxUses"         INTEGER NOT NULL DEFAULT 1,
  "usedCount"       INTEGER NOT NULL DEFAULT 0,
  "expiresAt"       TIMESTAMP(3),
  "notes"           TEXT,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt"      TIMESTAMP(3),
  "consumedByEmail" TEXT
);

CREATE INDEX IF NOT EXISTS "InviteCode_batch_idx" ON "InviteCode" ("batch");
CREATE INDEX IF NOT EXISTS "InviteCode_expiresAt_idx" ON "InviteCode" ("expiresAt");
CREATE INDEX IF NOT EXISTS "InviteCode_createdAt_idx" ON "InviteCode" ("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "InviteRequest" (
  "id"               TEXT PRIMARY KEY,
  "email"            TEXT NOT NULL,
  "displayName"      TEXT,
  "whyInterested"    TEXT,
  "consents"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "reviewedAt"       TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "inviteCodeId"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InviteRequest_email_idx" ON "InviteRequest" ("email");
CREATE INDEX IF NOT EXISTS "InviteRequest_status_createdAt_idx"
  ON "InviteRequest" ("status", "createdAt" DESC);
