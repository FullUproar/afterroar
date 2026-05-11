-- Test/bot account flag. Excluded from Smiirl signup counter + future
-- growth dashboards so internal QA accounts don't inflate real-user
-- metrics. Default false; only seed scripts and admin tooling set true.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isTestAccount" BOOLEAN NOT NULL DEFAULT false;

-- Partial index on the small "is test" set keeps the count query cheap
-- (most rows are false; we filter them out).
CREATE INDEX IF NOT EXISTS "User_isTestAccount_idx"
ON "User" ("isTestAccount")
WHERE "isTestAccount" = true;

-- Flag the bot accounts seeded for AI walkthrough testing so the next
-- Smiirl poll naturally excludes them.
UPDATE "User"
SET "isTestAccount" = true
WHERE "email" IN (
  'bot-admin@afterroar.me',
  'bot-user@afterroar.me'
);
