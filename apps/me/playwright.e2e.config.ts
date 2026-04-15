import { defineConfig } from '@playwright/test';

/**
 * Local e2e configuration. Run against `npm run dev` on port 3001.
 *
 * Usage:
 *   npm run dev                    # in one terminal
 *   npx playwright test --config playwright.e2e.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/results',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
});
