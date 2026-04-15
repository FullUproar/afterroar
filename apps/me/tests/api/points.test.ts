import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setSession, createTestUser, createTestEntity, grantConsent, cleanup, makeReq } from './setup';
import { POST as awardPoints } from '@/app/api/store/points/route';

let owner: { id: string };
let customer: { id: string; passportCode: string | null };
let entity: { id: string };

describe('Store points API', () => {
  beforeAll(async () => {
    owner = await createTestUser();
    customer = await createTestUser();
    entity = await createTestEntity(owner.id);
  });

  afterAll(async () => {
    await cleanup({
      userIds: [owner.id, customer.id],
      entityIds: [entity.id],
    });
  });

  function award(body: Record<string, unknown>) {
    return awardPoints(makeReq('/api/store/points', { method: 'POST', body }));
  }

  it('rejects when customer has not granted points scope', async () => {
    await grantConsent(customer.id, entity.id, ['identity']); // no points
    setSession(owner);
    const res = await award({
      entityId: entity.id,
      passportCode: customer.passportCode,
      amount: 10,
      description: 'Test',
    });
    expect(res.status).toBe(403);
  });

  it('rejects amount = 0 and out-of-bounds amounts', async () => {
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    setSession(owner);
    expect((await award({ entityId: entity.id, passportCode: customer.passportCode, amount: 0, description: 'x' })).status).toBe(400);
    expect((await award({ entityId: entity.id, passportCode: customer.passportCode, amount: 999_999, description: 'x' })).status).toBe(400);
  });

  it('accumulates balance across earns and refuses overdraft on redeem', async () => {
    setSession(owner);

    const r1 = await award({ entityId: entity.id, passportCode: customer.passportCode, amount: 25, description: 'Sale' });
    expect(r1.status).toBe(201);
    expect((await r1.json()).balance).toBe(25);

    const r2 = await award({ entityId: entity.id, passportCode: customer.passportCode, amount: 10, description: 'Bonus' });
    expect((await r2.json()).balance).toBe(35);

    // Redeem within balance
    const r3 = await award({
      entityId: entity.id,
      passportCode: customer.passportCode,
      amount: -20,
      description: 'Redemption',
      action: 'redeem',
    });
    expect((await r3.json()).balance).toBe(15);

    // Overdraft refused
    const r4 = await award({
      entityId: entity.id,
      passportCode: customer.passportCode,
      amount: -100,
      description: 'Too much',
      action: 'redeem',
    });
    expect(r4.status).toBe(400);
  });
});
