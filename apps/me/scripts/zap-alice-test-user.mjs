// One-off: delete the alicebobtest22@gmail.com Passport account so the
// Crit Hit Games & Cafe venue can be re-tested fresh (or handed off to
// Manus for a walkthrough). Mirrors the pattern in zap-pollock-user.mjs.
//
// Run from c:/dev/FULL UPROAR PLATFORM/ops-afterroar-store/apps/me:
//   node scripts/zap-alice-test-user.mjs

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

// Candidate emails — we've used a couple of variants this session;
// match all of them and report what's there before deletion.
const CANDIDATE_EMAILS = [
  'alicebobtest22@gmail.com',
  'alicebobtest@gmail.com',
  'aliceandbobtest@gmail.com',
  'aliceandbobtest22@gmail.com',
];

const users = await prisma.user.findMany({
  where: { email: { in: CANDIDATE_EMAILS } },
  select: {
    id: true,
    email: true,
    displayName: true,
    createdAt: true,
    emailVerified: true,
  },
});

if (users.length === 0) {
  console.log('No matching alice/bob test users on Passport. Nothing to zap.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`Found ${users.length} candidate user(s):`);
for (const u of users) {
  console.log(`  id=${u.id} email=${u.email} displayName=${u.displayName} emailVerified=${u.emailVerified} createdAt=${u.createdAt.toISOString()}`);
}
console.log('');

const counts = { accounts: 0, userActivity: 0, userBadges: 0, verificationTokens: 0, user: 0 };

for (const user of users) {
  counts.accounts += (await prisma.account.deleteMany({ where: { userId: user.id } })).count;
  counts.userActivity += (await prisma.userActivity.deleteMany({ where: { userId: user.id } })).count;
  counts.userBadges += (await prisma.userBadge.deleteMany({ where: { userId: user.id } })).count;
  counts.verificationTokens += (await prisma.verificationToken.deleteMany({
    where: { identifier: user.email },
  })).count;
  await prisma.user.delete({ where: { id: user.id } });
  counts.user += 1;
  console.log(`Deleted user ${user.email}`);
}

console.log('');
console.log('Totals:');
for (const [key, count] of Object.entries(counts)) {
  console.log(`  ${key}: ${count}`);
}

await prisma.$disconnect();
