// One-off diagnostic + fix: ensure the FU storefront's Passport API key
// has the scopes the venue-claim and /api/auth/register flows need.
//
// The original mint-passport-api-key-for-fu.mjs only granted:
//   write:points, read:points, read:users
// but POST /api/v1/users (canonical Passport user creation) requires
// users:create. Result: signup hits "Account service unavailable" with
// a 403 from Passport.
//
// Run from c:/dev/FULL UPROAR PLATFORM/ops-afterroar-store/apps/me:
//   node scripts/patch-fu-api-key-scopes.mjs

import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ME = path.resolve(__dirname, '..');
dotenvConfig({ path: path.join(APP_ME, '.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL found in apps/me/.env.local');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const KEY_NAME = 'FU storefront — Points federation';

const REQUIRED_SCOPES = [
  'write:points',
  'read:points',
  'read:users',
  'users:create', // ← missing, the actual bug
];

const keys = await prisma.apiKey.findMany({
  where: { name: KEY_NAME, revokedAt: null },
  select: { id: true, keyPrefix: true, scopes: true, name: true, createdAt: true },
});

if (keys.length === 0) {
  console.error(`No active key found with name "${KEY_NAME}". Run mint-passport-api-key-for-fu.mjs first.`);
  await prisma.$disconnect();
  process.exit(1);
}

console.log(`Found ${keys.length} active key(s):`);
for (const k of keys) {
  console.log(`  - prefix=${k.keyPrefix} scopes=[${(k.scopes ?? []).join(', ')}] createdAt=${k.createdAt.toISOString()}`);
}

let patched = 0;
for (const k of keys) {
  const current = new Set(k.scopes ?? []);
  const missing = REQUIRED_SCOPES.filter((s) => !current.has(s));
  if (missing.length === 0) {
    console.log(`\n[${k.keyPrefix}] already has all required scopes. Nothing to do.`);
    continue;
  }
  const next = [...new Set([...(k.scopes ?? []), ...REQUIRED_SCOPES])];
  await prisma.apiKey.update({
    where: { id: k.id },
    data: { scopes: next },
  });
  console.log(`\n[${k.keyPrefix}] patched.`);
  console.log(`  added: ${missing.join(', ')}`);
  console.log(`  scopes now: ${next.join(', ')}`);
  patched++;
}

console.log(`\nDone. Patched ${patched} key(s). No Vercel env change needed — key value unchanged.`);
await prisma.$disconnect();
