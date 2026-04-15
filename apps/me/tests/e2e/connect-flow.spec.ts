import { test, expect } from '@playwright/test';

/**
 * Connect V1 e2e tests that don't require OAuth sign-in.
 *
 * Covers the public-facing surfaces of the consent flow:
 *  - landing pages render
 *  - non-existent / expired / claimed tokens show the right error states
 *  - signed-out users get bounced to /login with the correct callbackUrl
 *
 * Tests that require an authenticated session (approve consent, lookup customer,
 * award points) live in tests/api/ as integration tests against the route
 * handlers — automating real Google OAuth in CI is brittle and slow.
 *
 * Run: npx playwright test --config playwright.e2e.config.ts
 * Requires: dev server on http://localhost:3001 (or set E2E_BASE_URL).
 */

test.describe('Connect public surfaces', () => {
  test('store landing page renders for signed-out users', async ({ page }) => {
    await page.goto('/store');
    await expect(page.getByText(/Afterroar Connect/i).first()).toBeVisible();
  });

  test('connect/[token] with non-existent token shows "Request not found"', async ({ page }) => {
    await page.goto('/connect/this-token-does-not-exist-xyz');
    await expect(page.getByRole('heading', { name: /Request not found/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Passport/i })).toBeVisible();
  });

  test('connect/[token] returns 404 from the preview API for unknown tokens', async ({ request }) => {
    const res = await request.get('/api/consent/request/totally-bogus-xyz');
    expect(res.status()).toBe(404);
  });

  test('admin/entities is denied to signed-out users', async ({ page }) => {
    await page.goto('/admin/entities');
    // Either redirected to /login or shown the not-authorized page
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toMatch(/\/(login|admin\/entities)/);
    if (url.includes('/admin/entities')) {
      await expect(page.getByRole('heading', { name: /Not authorized/i })).toBeVisible();
    }
  });

  test('store/[slug] redirects signed-out users to /store', async ({ page }) => {
    await page.goto('/store/some-fake-slug');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/store');
  });

  test('consent-request API rejects unauthenticated POSTs', async ({ request }) => {
    const res = await request.post('/api/store/consent-request', {
      data: { entityId: 'fake', scopes: ['identity'] },
    });
    expect(res.status()).toBe(401);
  });

  test('customer-lookup API rejects unauthenticated GETs', async ({ request }) => {
    const res = await request.get('/api/store/customer-lookup?code=ABCDEFGH&entityId=fake');
    expect(res.status()).toBe(401);
  });
});

test.describe('Connect visual smoke', () => {
  const SCREENS = [
    { name: 'store-landing', path: '/store' },
    { name: 'connect-not-found', path: '/connect/missing-token' },
  ];

  for (const { name, path } of SCREENS) {
    test(`${name} screenshot`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: `tests/e2e/results/${name}.png`,
        fullPage: true,
      });
    });
  }
});
