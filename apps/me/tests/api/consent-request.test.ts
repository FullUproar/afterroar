import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setSession, createTestUser, createTestEntity, cleanup, makeReq } from './setup';
import { POST as createConsentRequest } from '@/app/api/store/consent-request/route';
import { GET as previewRequest, POST as acceptRequest } from '@/app/api/consent/request/[token]/route';

let owner: { id: string; email: string };
let outsider: { id: string; email: string };
let customer: { id: string; email: string; passportCode: string | null };
let entity: { id: string; slug: string };

describe('Consent request API', () => {
  beforeAll(async () => {
    owner = await createTestUser();
    outsider = await createTestUser();
    customer = await createTestUser();
    entity = await createTestEntity(owner.id);
  });

  afterAll(async () => {
    await cleanup({
      userIds: [owner.id, outsider.id, customer.id],
      entityIds: [entity.id],
    });
  });

  it('rejects unauthenticated callers', async () => {
    setSession(null);
    const res = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['identity'] },
    }));
    expect(res.status).toBe(401);
  });

  it('rejects callers who are not entity members', async () => {
    setSession(outsider);
    const res = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['identity'] },
    }));
    expect(res.status).toBe(403);
  });

  it('filters out invalid scopes and accepts valid ones', async () => {
    setSession(owner);
    const res = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['identity', 'bogus', 'wishlist'] },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.url).toContain(`/connect/${body.token}`);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 400 if no valid scopes remain after filtering', async () => {
    setSession(owner);
    const res = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['nope', 'fake'] },
    }));
    expect(res.status).toBe(400);
  });

  it('full flow: create → preview → accept creates an EntityConsent', async () => {
    setSession(owner);
    const created = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['identity', 'points'] },
    }));
    const { token } = await created.json();

    // Preview is public — no session needed
    setSession(null);
    const preview = await previewRequest(makeReq(`/api/consent/request/${token}`), { params: Promise.resolve({ token }) });
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.entity.name).toBe(entity.slug.startsWith('test-') ? previewBody.entity.name : entity.slug);
    expect(previewBody.requestedScopes).toEqual(['identity', 'points']);
    expect(previewBody.expired).toBe(false);
    expect(previewBody.claimed).toBe(false);

    // Accept requires sign-in
    const unauth = await acceptRequest(makeReq(`/api/consent/request/${token}`, { method: 'POST' }), { params: Promise.resolve({ token }) });
    expect(unauth.status).toBe(401);

    setSession(customer);
    const accepted = await acceptRequest(makeReq(`/api/consent/request/${token}`, { method: 'POST' }), { params: Promise.resolve({ token }) });
    expect(accepted.status).toBe(200);
    const acceptedBody = await accepted.json();
    expect(acceptedBody.ok).toBe(true);
    expect(acceptedBody.scopes).toEqual(['identity', 'points']);

    // Replay should fail with 409
    const replay = await acceptRequest(makeReq(`/api/consent/request/${token}`, { method: 'POST' }), { params: Promise.resolve({ token }) });
    expect(replay.status).toBe(409);
  });

  it('rejects expired tokens', async () => {
    setSession(owner);
    const created = await createConsentRequest(makeReq('/api/store/consent-request', {
      method: 'POST',
      body: { entityId: entity.id, scopes: ['identity'] },
    }));
    const { token } = await created.json();

    // Force expiry
    const { prisma } = await import('@/lib/prisma');
    await prisma.entityConsentRequest.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    setSession(customer);
    const res = await acceptRequest(makeReq(`/api/consent/request/${token}`, { method: 'POST' }), { params: Promise.resolve({ token }) });
    expect(res.status).toBe(410);
  });
});
