-- 2026-05-11: 30-day soft-delete grace for Passport accounts.
--
-- When a user clicks "Delete forever", we now set scheduledDeletionAt =
-- now() + 30d and flip accountStatus to "pending_deletion". A daily cron
-- (cron/passport-delete-sweep) hard-deletes records where the timestamp
-- has passed.
--
-- The user can undo via POST /api/delete-account/undo as long as
-- scheduledDeletionAt is still in the future.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "scheduledDeletionAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_scheduledDeletionAt_idx"
  ON "User" ("scheduledDeletionAt")
  WHERE "scheduledDeletionAt" IS NOT NULL;
