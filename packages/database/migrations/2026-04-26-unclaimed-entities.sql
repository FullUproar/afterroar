-- Phase 4: unclaimed FLGS Passport entities + claim flow.
-- Adds the EntityClaim model and makes AfterroarEntity.contactEmail nullable
-- so we can bulk-import FLGS network data even when no public business email
-- is on file. The claim flow asks the claimant for their email and verifies
-- via a 72h-expiring magic link.
--
-- Idempotent. Apply with:
--   set -a && . ../../apps/me/.env.local && set +a && \
--     node migrations/apply.mjs migrations/2026-04-26-unclaimed-entities.sql

BEGIN;

-- AfterroarEntity.contactEmail → nullable
ALTER TABLE "AfterroarEntity"
  ALTER COLUMN "contactEmail" DROP NOT NULL;

-- EntityClaim table
CREATE TABLE IF NOT EXISTS "EntityClaim" (
  id              TEXT PRIMARY KEY,
  "entityId"      TEXT NOT NULL,
  "claimantUserId" TEXT NOT NULL,
  "contactEmail"  TEXT NOT NULL,
  "contactName"   TEXT,
  "contactPhone"  TEXT,
  token           TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending',
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "verifiedAt"    TIMESTAMP(3),
  evidence        JSONB DEFAULT '{}',
  notes           TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_claim_entity_fk FOREIGN KEY ("entityId")
    REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  CONSTRAINT entity_claim_user_fk FOREIGN KEY ("claimantUserId")
    REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_claim_entity_idx ON "EntityClaim"("entityId");
CREATE INDEX IF NOT EXISTS entity_claim_user_idx ON "EntityClaim"("claimantUserId");
CREATE INDEX IF NOT EXISTS entity_claim_status_idx ON "EntityClaim"(status);
CREATE INDEX IF NOT EXISTS entity_claim_token_idx ON "EntityClaim"(token);

COMMIT;
