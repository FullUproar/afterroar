-- AfterroarEntity — canonical identity for any non-player participant in the network.
-- Stores, publishers, convention organizers, content creators, venues, etc.
-- Other apps (HQ, Store Ops) wrap this with their own metadata tables.

CREATE TABLE IF NOT EXISTS "AfterroarEntity" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "slug"        TEXT NOT NULL UNIQUE,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'store',
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "contactEmail" TEXT NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "websiteUrl"  TEXT,
  "logoUrl"     TEXT,
  "description" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city"        TEXT,
  "state"       TEXT,
  "postalCode"  TEXT,
  "country"     TEXT DEFAULT 'US',
  "latitude"    DOUBLE PRECISION,
  "longitude"   DOUBLE PRECISION,
  "timezone"    TEXT,
  "metadata"    JSONB DEFAULT '{}',
  "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "approvedAt"  TIMESTAMP WITH TIME ZONE,
  "suspendedAt" TIMESTAMP WITH TIME ZONE,
  "notes"       TEXT
);

CREATE INDEX IF NOT EXISTS "AfterroarEntity_type_idx" ON "AfterroarEntity"("type");
CREATE INDEX IF NOT EXISTS "AfterroarEntity_status_idx" ON "AfterroarEntity"("status");
CREATE INDEX IF NOT EXISTS "AfterroarEntity_city_idx" ON "AfterroarEntity"("city");

-- Entity members — which users are authorized to act on behalf of an entity.
CREATE TABLE IF NOT EXISTS "EntityMember" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityId"  TEXT NOT NULL REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "role"      TEXT NOT NULL DEFAULT 'member',
  "addedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "addedBy"   TEXT,
  CONSTRAINT "EntityMember_entity_user_unique" UNIQUE ("entityId", "userId")
);

CREATE INDEX IF NOT EXISTS "EntityMember_entityId_idx" ON "EntityMember"("entityId");
CREATE INDEX IF NOT EXISTS "EntityMember_userId_idx" ON "EntityMember"("userId");

-- Entity consent — which users have granted which entities access to which data categories.
-- Separate from UserConsent (which governs platform-wide consent categories).
CREATE TABLE IF NOT EXISTS "EntityConsent" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "entityId"      TEXT NOT NULL REFERENCES "AfterroarEntity"(id) ON DELETE CASCADE,
  "scopes"        TEXT[] NOT NULL DEFAULT '{}',
  "grantedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "revokedAt"    TIMESTAMP WITH TIME ZONE,
  "expiresAt"    TIMESTAMP WITH TIME ZONE,
  "source"        TEXT,
  CONSTRAINT "EntityConsent_user_entity_unique" UNIQUE ("userId", "entityId")
);

CREATE INDEX IF NOT EXISTS "EntityConsent_userId_idx" ON "EntityConsent"("userId");
CREATE INDEX IF NOT EXISTS "EntityConsent_entityId_idx" ON "EntityConsent"("entityId");
