#!/usr/bin/env node
/**
 * Mint a Passport API key with points-federation scopes and set it on
 * the full-uproar-site Vercel project as PASSPORT_API_KEY (production).
 *
 * One-shot. The full key value never lands in terminal stdout or in a
 * file — it's minted, inserted into Afterroar's ApiKey table, and piped
 * straight into `vercel env add` with no trailing newline.
 *
 * Prereqs:
 *   1. apps/me/.env.local populated with the Afterroar DATABASE_URL
 *      (e.g. `vercel env pull .env.local --environment=production --yes`).
 *   2. `vercel login` already done on this machine.
 *
 * Usage:
 *   npx tsx --env-file=.env.local apps/me/scripts/mint-passport-api-key-for-fu.mjs
 *
 * Output: prefix only (safe to display), plus success/error.
 *
 * Re-run safety: if PASSPORT_API_KEY is already set on FU, Vercel will
 * prompt to overwrite — the spawn passes `--force` to handle that
 * non-interactively.
 */

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FU storefront Vercel project lives at apps/site of the sibling repo.
// The Vercel CLI uses cwd to locate .vercel/project.json which links
// the project. The relative path here is from apps/me/scripts/ →
// ../../../../full-uproar-site/apps/site.
const FU_SITE_DIR = path.resolve(
  __dirname,
  '../../../../full-uproar-site/apps/site',
);

const ENV_NAME = 'PASSPORT_API_KEY';
const TARGET = 'production';
const KEY_NAME = 'FU storefront — Points federation';
// Scopes required by lib/afterroar-points.ts + backfill script +
// /api/auth/register's canonical Passport user-creation call +
// Passport-native auth (2026-05-20):
//   write:points          → grant + redeem federation calls
//   read:points           → balance lookups + count-by-action
//   read:users            → backfill's lookup-by-email batch resolver
//   users:create          → POST /api/v1/users (signup mints Passport user)
//   auth:verify           → POST /api/v1/auth/login (email+pw sign-in)
//   auth:google-exchange  → POST /api/v1/auth/google-exchange (Google id_token → user)
// History: 2026-05-19 users:create was missing → 403 on signup. 2026-05-20
// auth:verify + auth:google-exchange added for the OIDC-to-native auth flip.
// patch-fu-api-key-scopes.mjs backfills live keys without rotating the value.
const SCOPES = [
  'write:points',
  'read:points',
  'read:users',
  'users:create',
  'auth:verify',
  'auth:google-exchange',
];

function mint() {
  const random = randomBytes(24).toString('base64url');
  const fullKey = `ar_live_${random}`;
  const prefix = `ar_live_${random.slice(0, 8)}`;
  const hash = createHash('sha256').update(fullKey).digest('hex');
  return { fullKey, prefix, hash };
}

async function pipeToVercel(value, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('vercel', args, {
      cwd: FU_SITE_DIR,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`vercel exited with code ${code}`));
    });
    // Write the value with no trailing newline. The receiving CLI
    // treats stdin as the raw env value; a stray \n would land in the
    // stored secret and break header construction downstream.
    child.stdin.write(value);
    child.stdin.end();
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Pull apps/me/.env.local first:');
    console.error('  cd apps/me && vercel env pull .env.local --environment=production --yes');
    process.exit(1);
  }

  // Prisma 7 driver-adapter mode: same pattern as apps/me/lib/prisma.ts.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const { fullKey, prefix, hash } = mint();

    // Revoke any existing key with the same name. Prevents a long
    // tail of forgotten rotation keys; this script is the only path
    // that creates "FU storefront — Points federation" keys.
    const revoked = await prisma.apiKey.updateMany({
      where: { name: KEY_NAME, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: 'mint-script' },
    });
    if (revoked.count > 0) {
      console.log(`✓ Revoked ${revoked.count} prior key(s) with the same name.`);
    }

    // Persist before exposing to Vercel — if the env-set fails, the row
    // is already there and we just have to update Vercel manually with
    // a recovery procedure. Avoids the inverse failure mode where
    // Vercel has a key the DB doesn't recognize.
    await prisma.apiKey.create({
      data: {
        keyPrefix: prefix,
        keyHash: hash,
        name: KEY_NAME,
        scopes: SCOPES,
      },
    });
    console.log(`✓ Minted Afterroar API key: ${prefix}`);
    console.log(`  scopes: ${SCOPES.join(', ')}`);

    // Use --no-sensitive so the value is pullable for local scripts
    // (backfill, integration tests). Still encrypted at rest in Vercel;
    // readable only to team members with project access.
    console.log(`\n→ Setting ${ENV_NAME} on full-uproar-site (${TARGET})...`);
    await pipeToVercel(fullKey, [
      'env', 'add', ENV_NAME, TARGET, '--no-sensitive', '--force',
    ]);

    console.log('\n✓ Done.');
    console.log(`  Key prefix (safe to share): ${prefix}`);
    console.log('  Trigger a redeploy of full-uproar-site so the new env takes effect.');
  } catch (err) {
    console.error('\n✗ Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
