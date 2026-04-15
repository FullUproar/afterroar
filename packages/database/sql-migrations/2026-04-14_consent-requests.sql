-- Consent requests: a store generates a short-lived token + QR; customer scans
-- to approve specific scopes. Tokens are single-use.

CREATE TABLE IF NOT EXISTS "EntityConsentRequest" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "token"           TEXT NOT NULL UNIQUE,
  "entityId"        TEXT NOT NULL REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  "requestedScopes" TEXT[] NOT NULL DEFAULT '{}',
  "createdBy"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "expiresAt"       TIMESTAMP WITH TIME ZONE NOT NULL,
  "claimedAt"       TIMESTAMP WITH TIME ZONE,
  "claimedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "note"            TEXT
);

CREATE INDEX IF NOT EXISTS "EntityConsentRequest_entityId_idx" ON "EntityConsentRequest"("entityId");
CREATE INDEX IF NOT EXISTS "EntityConsentRequest_token_idx" ON "EntityConsentRequest"("token");
CREATE INDEX IF NOT EXISTS "EntityConsentRequest_expiresAt_idx" ON "EntityConsentRequest"("expiresAt");
