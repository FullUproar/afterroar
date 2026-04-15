/**
 * Vitest setup for Connect V1 API tests.
 *
 * These hit a real Postgres database. Set DATABASE_URL to a test/dev
 * Neon branch — never production. Each test is responsible for its own
 * cleanup; `cleanup()` deletes by id arrays you collect.
 *
 * Safety guard: we refuse to run if DATABASE_URL looks like production
 * OR if the environment isn't explicitly marked as a test environment.
 * Override ONLY on a known-test Neon branch by setting TEST_DB_OK=1.
 */

// --- Test-DB safety guard ---------------------------------------------------
const dbUrl = process.env.DATABASE_URL || '';
const isExplicitlyOk = process.env.TEST_DB_OK === '1';
const looksProd =
  dbUrl.includes('neon.tech') &&
  !dbUrl.includes('test') &&
  !dbUrl.includes('dev') &&
  !dbUrl.includes('staging');

if (!isExplicitlyOk && (looksProd || !dbUrl)) {
  throw new Error(
    'Refusing to run API tests: DATABASE_URL looks like production or is unset. ' +
    'Point DATABASE_URL at a test Neon branch and set TEST_DB_OK=1 to confirm.',
  );
}

import { vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * Shared mutable session used by the auth() mock below.
 * Tests call setSession() to control who is "signed in".
 */
export const _session: { current: { user: { id: string; email?: string } } | null } = { current: null };

export function setSession(user: { id: string; email?: string } | null) {
  _session.current = user ? { user: { id: user.id, email: user.email } } : null;
}

vi.mock('@/lib/auth-config', () => ({
  auth: async () => _session.current,
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

let counter = 0;
function uid() {
  return `t_${Date.now().toString(36)}_${++counter}_${randomBytes(2).toString('hex')}`;
}

export async function createTestUser(opts: { email?: string; passportCode?: string; identityVerified?: boolean } = {}) {
  const id = uid();
  const code = opts.passportCode || generatePassportCode();
  return prisma.user.create({
    data: {
      id,
      email: opts.email || `${id}@test.afterroar.me`,
      displayName: `Test ${id}`,
      passportCode: code,
      identityVerified: opts.identityVerified ?? false,
    },
  });
}

export async function createTestEntity(ownerUserId: string, opts: { status?: string; name?: string } = {}) {
  const id = uid();
  const slug = `test-${id}`;
  const entity = await prisma.afterroarEntity.create({
    data: {
      id,
      slug,
      name: opts.name || `Test Entity ${id}`,
      type: 'store',
      status: opts.status || 'approved',
      contactEmail: `${id}@test.afterroar.me`,
      approvedAt: opts.status === 'approved' ? new Date() : null,
    },
  });
  await prisma.entityMember.create({
    data: { entityId: entity.id, userId: ownerUserId, role: 'owner' },
  });
  return entity;
}

export async function grantConsent(userId: string, entityId: string, scopes: string[]) {
  return prisma.entityConsent.upsert({
    where: { userId_entityId: { userId, entityId } },
    create: { userId, entityId, scopes, source: 'test' },
    update: { scopes, revokedAt: null, grantedAt: new Date() },
  });
}

export async function createConsentRequest(entityId: string, createdBy: string, scopes: string[], opts: { expired?: boolean; claimedByUserId?: string } = {}) {
  const token = randomBytes(8).toString('base64url');
  const expiresAt = opts.expired ? new Date(Date.now() - 60_000) : new Date(Date.now() + 15 * 60_000);
  return prisma.entityConsentRequest.create({
    data: {
      token,
      entityId,
      createdBy,
      requestedScopes: scopes,
      expiresAt,
      claimedAt: opts.claimedByUserId ? new Date() : null,
      claimedByUserId: opts.claimedByUserId || null,
    },
  });
}

function generatePassportCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function cleanup(opts: { userIds?: string[]; entityIds?: string[] }) {
  if (opts.entityIds?.length) {
    await prisma.entityConsentRequest.deleteMany({ where: { entityId: { in: opts.entityIds } } });
    await prisma.entityConsent.deleteMany({ where: { entityId: { in: opts.entityIds } } });
    await prisma.entityMember.deleteMany({ where: { entityId: { in: opts.entityIds } } });
    await prisma.pointsLedger.deleteMany({ where: { storeId: { in: opts.entityIds } } });
    await prisma.afterroarEntity.deleteMany({ where: { id: { in: opts.entityIds } } });
  }
  if (opts.userIds?.length) {
    await prisma.userBadge.deleteMany({ where: { userId: { in: opts.userIds } } });
    await prisma.wishlistItem.deleteMany({ where: { userId: { in: opts.userIds } } });
    await prisma.pointsLedger.deleteMany({ where: { userId: { in: opts.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: opts.userIds } } });
  }
}

/** Build a minimal NextRequest-shaped object for route handler tests. */
export function makeReq(url: string, init?: { method?: string; body?: unknown }) {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3001${url}`;
  return new Request(fullUrl, {
    method: init?.method || 'GET',
    headers: { 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  }) as unknown as import('next/server').NextRequest;
}
