import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setSession, createTestUser, createTestEntity, grantConsent, cleanup, makeReq } from './setup';
import { GET as customerLookup } from '@/app/api/store/customer-lookup/route';

let owner: { id: string; email: string };
let customer: { id: string; email: string; passportCode: string | null };
let entity: { id: string; slug: string };
let pendingEntity: { id: string };

describe('Customer lookup API', () => {
  beforeAll(async () => {
    owner = await createTestUser();
    customer = await createTestUser();
    entity = await createTestEntity(owner.id);
    pendingEntity = await createTestEntity(owner.id, { status: 'pending' });
  });

  afterAll(async () => {
    await cleanup({
      userIds: [owner.id, customer.id],
      entityIds: [entity.id, pendingEntity.id],
    });
  });

  function lookup(code: string, entityId: string) {
    return customerLookup(makeReq(`/api/store/customer-lookup?code=${code}&entityId=${entityId}`));
  }

  it('rejects unauthenticated callers', async () => {
    setSession(null);
    const res = await lookup(customer.passportCode!, entity.id);
    expect(res.status).toBe(401);
  });

  it('rejects invalid passport codes', async () => {
    setSession(owner);
    const res = await lookup('SHORT', entity.id);
    expect(res.status).toBe(400);
  });

  it('rejects callers who are not entity members', async () => {
    const other = await createTestUser();
    setSession(other);
    const res = await lookup(customer.passportCode!, entity.id);
    expect(res.status).toBe(403);
    await cleanup({ userIds: [other.id] });
  });

  it('rejects unapproved entities', async () => {
    setSession(owner);
    const res = await lookup(customer.passportCode!, pendingEntity.id);
    expect(res.status).toBe(403);
  });

  it('returns consentGranted:false when no consent exists', async () => {
    setSession(owner);
    const res = await lookup(customer.passportCode!, entity.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.consentGranted).toBe(false);
    expect(body.identity).toBeUndefined();
    expect(body.wishlist).toBeUndefined();
  });

  it('only includes scopes the customer has granted', async () => {
    await grantConsent(customer.id, entity.id, ['identity', 'wishlist']);
    setSession(owner);
    const res = await lookup(customer.passportCode!, entity.id);
    const body = await res.json();
    expect(body.consentGranted).toBe(true);
    expect(body.identity).toBeDefined();
    expect(body.identity.passportCode).toBe(customer.passportCode);
    expect(body.wishlist).toEqual([]);
    expect(body.points).toBeUndefined();
    expect(body.badges).toBeUndefined();
    expect(body.library).toBeUndefined();
  });

  it('returns consentGranted:false when consent has been revoked', async () => {
    const { prisma } = await import('@/lib/prisma');
    await prisma.entityConsent.update({
      where: { userId_entityId: { userId: customer.id, entityId: entity.id } },
      data: { revokedAt: new Date() },
    });
    setSession(owner);
    const res = await lookup(customer.passportCode!, entity.id);
    const body = await res.json();
    expect(body.consentGranted).toBe(false);
  });
});
