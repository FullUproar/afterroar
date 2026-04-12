import { test, expect } from '@playwright/test';

/**
 * Visual QA — screenshot every public page on afterroar.me at each viewport.
 *
 * These tests don't assert pixel-perfect matches. They capture screenshots
 * for human review: layout breaks, overflow, spacing, text readability.
 *
 * Run: npx playwright test --config apps/me/playwright.config.ts
 * Review: open tests/visual/results/ and inspect PNGs
 */

const PUBLIC_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'credo', path: '/credo' },
  { name: 'terms', path: '/terms' },
  { name: 'privacy', path: '/privacy' },
];

for (const { name, path } of PUBLIC_PAGES) {
  test(`${name} — no horizontal overflow`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);

    await page.screenshot({
      path: `tests/visual/results/${name}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

  test(`${name} — text is readable (no clipping)`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const clippedElements = await page.evaluate(() => {
      const results: string[] = [];
      document.querySelectorAll('h1, h2, h3, p, a, button, li, span').forEach((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > window.innerWidth + 2) {
          results.push(`${el.tagName}.${el.className} overflows right by ${Math.round(rect.right - window.innerWidth)}px`);
        }
        if (style.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 2) {
          results.push(`${el.tagName}.${el.className} has hidden overflow (${el.scrollWidth - el.clientWidth}px clipped)`);
        }
      });
      return results;
    });

    if (clippedElements.length > 0) {
      console.warn(`[${name}] Clipped elements:`, clippedElements);
    }
    expect(clippedElements.length).toBe(0);
  });
}

test('authorize page — shows error for direct access', async ({ page }) => {
  await page.goto('/authorize', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const heading = await page.textContent('h1');
  expect(heading).toContain('Invalid Request');

  await page.screenshot({
    path: `tests/visual/results/authorize-error-${test.info().project.name}.png`,
    fullPage: true,
  });
});
