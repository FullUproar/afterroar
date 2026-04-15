import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setSession, createTestUser, createTestEntity, grantConsent, cleanup } from './setup';
import { handleOrderPaid, handleRefundCreate, handleAppUninstalled } from '@/lib/shopify-handlers';
import { prisma } from '@/lib/prisma';

const SHOP = 'test-store-vitest.myshopify.com';

let owner: { id: string };
let customer: { id: string; email: string; passportCode: string | null };
let entity: { id: string; slug: string };

async function ensureConnection(opts: { pointsPerDollar?: number; minOrderCents?: number; active?: boolean } = {}) {
  await prisma.shopifyConnection.upsert({
    where: { entityId: entity.id },
    create: {
      entityId: entity.id,
      shopDomain: SHOP,
      accessToken: 'fake-token',
      scopes: 'read_orders,read_customers',
      pointsPerDollar: opts.pointsPerDollar ?? 1,
      minOrderCents: opts.minOrderCents ?? 0,
      active: opts.active ?? true,
    },
    update: {
      pointsPerDollar: opts.pointsPerDollar ?? 1,
      minOrderCents: opts.minOrderCents ?? 0,
      active: opts.active ?? true,
      uninstalledAt: opts.active === false ? new Date() : null,
    },
  });
}

function fakeOrder(opts: { id: number; total: string; email?: string; passportCode?: string; orderNote?: string }) {
  return {
    id: opts.id,
    order_number: opts.id,
    total_price: opts.total,
    subtotal_price: opts.total,
    email: opts.email,
    customer: opts.email ? { id: 1, email: opts.email } : undefined,
    note: opts.orderNote ?? null,
    note_attributes: opts.passportCode ? [{ name: 'passport_code', value: opts.passportCode }] : [],
  };
}

describe('Shopify handlers', () => {
  beforeAll(async () => {
    setSession(null); // handlers don't use auth()
    owner = await createTestUser();
    customer = await createTestUser();
    entity = await createTestEntity(owner.id);
  });

  afterAll(async () => {
    await prisma.shopifyConnection.deleteMany({ where: { entityId: entity.id } });
    await cleanup({ userIds: [owner.id, customer.id], entityIds: [entity.id] });
  });

  beforeEach(async () => {
    // Reset ledger between cases
    await prisma.pointsLedger.deleteMany({ where: { storeId: entity.id } });
  });

  it('skips when connection is inactive', async () => {
    await ensureConnection({ active: false });
    const r = await handleOrderPaid(SHOP, fakeOrder({ id: 1001, total: '20.00', email: customer.email }));
    expect(r.result).toBe('skipped:connection-inactive');
  });

  it('skips when no Passport match found (no email, no code)', async () => {
    await ensureConnection();
    const r = await handleOrderPaid(SHOP, fakeOrder({ id: 1002, total: '20.00', email: 'nobody@nowhere.test' }));
    expect(r.result).toBe('skipped:no-passport-match');
  });

  it('skips when matched user has no points consent', async () => {
    await ensureConnection();
    await grantConsent(customer.id, entity.id, ['identity']); // no points
    const r = await handleOrderPaid(SHOP, fakeOrder({ id: 1003, total: '20.00', email: customer.email }));
    expect(r.result).toBe('skipped:no-consent');
    expect(r.userId).toBe(customer.id);
  });

  it('awards points when consent is granted (email match)', async () => {
    await ensureConnection({ pointsPerDollar: 2 });
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    const r = await handleOrderPaid(SHOP, fakeOrder({ id: 1004, total: '15.00', email: customer.email }));
    expect(r.result).toBe('awarded');
    expect(r.pointsDelta).toBe(30); // 15 * 2
    expect(r.userId).toBe(customer.id);

    const ledger = await prisma.pointsLedger.findFirst({
      where: { userId: customer.id, storeId: entity.id, action: 'earn' },
    });
    expect(ledger?.amount).toBe(30);
    expect(ledger?.balance).toBe(30);
    expect(ledger?.metadata).toContain('"shopifyOrderId":"1004"');
  });

  it('matches by Passport code in note_attributes (overrides email)', async () => {
    await ensureConnection();
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    const other = await createTestUser({ email: 'other@test.afterroar.me' });
    try {
      const r = await handleOrderPaid(SHOP, fakeOrder({
        id: 1005, total: '10.00',
        email: other.email,                        // different user
        passportCode: customer.passportCode!,      // but the code wins
      }));
      expect(r.result).toBe('awarded');
      expect(r.userId).toBe(customer.id);
    } finally {
      await cleanup({ userIds: [other.id] });
    }
  });

  it('is idempotent on the same Shopify order id', async () => {
    await ensureConnection();
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    const order = fakeOrder({ id: 1006, total: '12.00', email: customer.email });
    const r1 = await handleOrderPaid(SHOP, order);
    const r2 = await handleOrderPaid(SHOP, order);
    expect(r1.result).toBe('awarded');
    expect(r2.result).toBe('skipped:already-awarded');
  });

  it('skips orders below the minimum order threshold', async () => {
    await ensureConnection({ minOrderCents: 5000 }); // $50 minimum
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    const r = await handleOrderPaid(SHOP, fakeOrder({ id: 1007, total: '10.00', email: customer.email }));
    expect(r.result).toMatch(/^skipped:below-min/);
  });

  it('reverses points proportionally on refund, capped at original award', async () => {
    await ensureConnection({ pointsPerDollar: 1 });
    await grantConsent(customer.id, entity.id, ['identity', 'points']);
    await handleOrderPaid(SHOP, fakeOrder({ id: 1008, total: '50.00', email: customer.email }));

    // Refund $20 of $50 → reverse 20 of 50 points
    const r = await handleRefundCreate(SHOP, {
      id: 9001,
      order_id: 1008,
      transactions: [{ kind: 'refund', amount: '20.00' }],
    });
    expect(r.result).toBe('reversed');
    expect(r.pointsDelta).toBe(-20);

    const sum = await prisma.pointsLedger.aggregate({
      where: { userId: customer.id, storeId: entity.id },
      _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(30);
  });

  it('handleAppUninstalled deactivates the connection', async () => {
    await ensureConnection();
    const result = await handleAppUninstalled(SHOP);
    expect(result).toBe('uninstalled');
    const conn = await prisma.shopifyConnection.findUnique({ where: { shopDomain: SHOP } });
    expect(conn?.active).toBe(false);
    expect(conn?.uninstalledAt).toBeTruthy();
  });
});
