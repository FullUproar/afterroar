-- Game Tags — shared vocabulary for organizing collections.
-- Some tags are personal, some become community-standard (like hashtags).

CREATE TABLE IF NOT EXISTS "GameTag" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL UNIQUE,
  "type"      TEXT NOT NULL DEFAULT 'custom',
  "useCount"  INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "GameTag_slug_idx" ON "GameTag"("slug");
CREATE INDEX IF NOT EXISTS "GameTag_type_idx" ON "GameTag"("type");
CREATE INDEX IF NOT EXISTS "GameTag_useCount_idx" ON "GameTag"("useCount" DESC);

-- Seed suggested tags
INSERT INTO "GameTag" ("id", "name", "slug", "type", "useCount") VALUES
  (gen_random_uuid()::text, 'Go-To Games', 'goto', 'suggested', 0),
  (gen_random_uuid()::text, 'Shelf of Shame', 'shelf-of-shame', 'suggested', 0),
  (gen_random_uuid()::text, 'Travel Size', 'travel-size', 'suggested', 0),
  (gen_random_uuid()::text, 'Party', 'party', 'suggested', 0),
  (gen_random_uuid()::text, '2-Player', '2-player', 'suggested', 0),
  (gen_random_uuid()::text, 'Solo', 'solo', 'suggested', 0),
  (gen_random_uuid()::text, 'Easy to Teach', 'teach-easy', 'suggested', 0),
  (gen_random_uuid()::text, 'Heavy', 'heavy', 'suggested', 0),
  (gen_random_uuid()::text, 'Display Piece', 'display', 'suggested', 0),
  (gen_random_uuid()::text, 'Basement', 'basement', 'suggested', 0),
  (gen_random_uuid()::text, 'Storage Unit', 'storage-unit', 'suggested', 0),
  (gen_random_uuid()::text, 'Kids', 'kids', 'suggested', 0),
  (gen_random_uuid()::text, 'Campaign', 'campaign', 'suggested', 0),
  (gen_random_uuid()::text, 'Legacy', 'legacy', 'suggested', 0),
  (gen_random_uuid()::text, 'Filler', 'filler', 'suggested', 0)
ON CONFLICT ("slug") DO NOTHING;
