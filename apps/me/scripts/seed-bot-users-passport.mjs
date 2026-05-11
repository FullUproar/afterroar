#!/usr/bin/env node
/**
 * Seed bot user accounts on the Afterroar (Passport) DB so an automated
 * tester can sign in via email/password without going through the
 * verification flow.
 *
 *   bot-admin@afterroar.me  — SUPER_ADMIN role, Bot1234!
 *   bot-user@afterroar.me   — regular USER role, Bot1234!
 *
 * Both are created with emailVerified set to NOW and dateOfBirth set
 * to an adult value so the age-gate and email-verification gates pass
 * out of the box.
 *
 * Idempotent — re-running updates password + verification on existing
 * rows. Pass --force to wipe and recreate.
 *
 * Usage:
 *   node --env-file=.env.local apps/me/scripts/seed-bot-users-passport.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const FORCE = process.argv.includes('--force');

const BOT_PASSWORD = 'Bot1234!';
const ADULT_DOB = new Date('1990-01-15T00:00:00Z'); // 36 years old, well past 18

const BOT_ACCOUNTS = [
  {
    email: 'bot-admin@afterroar.me',
    username: 'botadmin',
    displayName: 'Bot Admin',
    membershipTier: 'CONNECT', // gives Pro+Connect features for testing
  },
  {
    email: 'bot-user@afterroar.me',
    username: 'botuser-passport',
    displayName: 'Bot User',
    membershipTier: 'FREE',
  },
];

function genPassportCode() {
  // 8 alphanumeric uppercase chars — matches the @db.VarChar(8) column.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Pull apps/me/.env.local first.');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`Seeding Passport bot users (force=${FORCE})...`);
  const passwordHash = await bcrypt.hash(BOT_PASSWORD, 10);
  const now = new Date();

  try {
    for (const acc of BOT_ACCOUNTS) {
      const existing = await prisma.user.findUnique({ where: { email: acc.email } });

      if (existing && FORCE) {
        console.log(`  Wiping existing ${acc.email}...`);
        await prisma.user.delete({ where: { id: existing.id } });
      }

      const refreshed = !FORCE && existing;

      if (refreshed) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            emailVerified: existing.emailVerified ?? now,
            isFrozen: false,
          },
        });
        console.log(`  ${acc.email} exists — refreshed password + email-verified.`);
        continue;
      }

      await prisma.user.create({
        data: {
          email: acc.email,
          username: acc.username,
          displayName: acc.displayName,
          membershipTier: acc.membershipTier,
          passwordHash,
          emailVerified: now,
          dateOfBirth: ADULT_DOB,
          isMinor: false,
          defaultVisibility: 'public',
          passportCode: genPassportCode(),
        },
      });
      console.log(`  Created ${acc.email} (${acc.membershipTier})`);
    }

    console.log('\nDone. Credentials for Manus on Passport:');
    console.log('  Admin: bot-admin@afterroar.me / Bot1234!');
    console.log('  User:  bot-user@afterroar.me  / Bot1234!');
    console.log('\nBoth accounts are email-verified, adult-age-gated, with public visibility.');
  } catch (err) {
    console.error('\nFailed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
