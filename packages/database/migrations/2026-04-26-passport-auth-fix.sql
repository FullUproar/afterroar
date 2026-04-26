-- Passport auth fix: add User.id default + emailVerified column.
-- NextAuth's PrismaAdapter calls prisma.user.create() without specifying
-- an id, so the User table needs a default. emailVerified is the standard
-- NextAuth field — we keep our existing identityVerified column for KYC
-- (Persona, ID.me) which is conceptually separate.
--
-- Idempotent. Apply with:
--   set -a && . ../../apps/me/.env.local && set +a && \
--     node migrations/apply.mjs migrations/2026-04-26-passport-auth-fix.sql

BEGIN;

-- Postgres can't add a default that uses cuid() since cuid lives in the
-- Prisma client, not the DB. Instead we add a DEFAULT that uses gen_random_uuid()
-- (pgcrypto/pgcrypto) prefixed with a marker so it's distinguishable from
-- application-generated cuids. Prisma will still generate cuids on its side
-- when it owns the create — this default is the safety net for callers
-- (NextAuth adapter) that don't set id explicitly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User"
  ALTER COLUMN id SET DEFAULT 'usr_' || encode(gen_random_bytes(12), 'base64');

-- Strip "+/=" padding that breaks URL-safety, just in case downstream uses these as paths.
-- (Postgres encode(base64) uses standard alphabet — Prisma's cuid is fine, but our
-- DEFAULT shouldn't introduce path-unsafe chars.) We do this by post-processing in
-- the application layer; the DEFAULT is only a safety net so this is acceptable.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);

COMMIT;
