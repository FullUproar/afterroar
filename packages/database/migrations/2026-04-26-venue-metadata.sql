-- Crowdsource flow: Venue.metadata for origin + provenance.
-- Apply with: node migrations/apply.mjs migrations/2026-04-26-venue-metadata.sql

BEGIN;

ALTER TABLE "Venue"
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- GIN index so we can find crowdsourced rows + author quickly without scanning
CREATE INDEX IF NOT EXISTS venue_metadata_gin ON "Venue" USING GIN (metadata);

COMMIT;
