import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './tests/visual/results',
  timeout: 30000,
  use: {
    baseURL: 'https://www.afterroar.me',
    screenshot: 'on',
    trace: 'off',
    browserName: 'chromium',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'laptop',
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-small',
      use: { viewport: { width: 320, height: 568 } },
    },
  ],
});
