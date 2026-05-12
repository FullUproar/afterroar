-- 2026-05-12: Passport PWA Web Push subscriptions.
--
-- One row per (user, push endpoint). The endpoint is the browser's
-- push service URL — unique per browser + device. p256dh + auth are
-- the encryption keys the browser hands us when subscribing.
--
-- channel: open-ended tag so we can route different categories of
-- push (e.g. 'hq_events' vs 'fu_orders') to specific subscriptions
-- later if a user wants granular opt-out. Default 'passport_app'.

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "endpoint"   TEXT NOT NULL UNIQUE,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "userAgent"  TEXT,
  "channel"    TEXT NOT NULL DEFAULT 'passport_app',
  "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription" ("userId");
