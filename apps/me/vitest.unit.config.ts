/**
 * Vitest config for pure unit tests — no DB, no network, no setup file.
 *
 * Distinct from `vitest.config.ts` (which targets the API integration
 * suite under tests/api/ and gates against running on prod). These
 * tests live under tests/unit/ and mock all I/O, so they can run in
 * CI without DATABASE_URL or any other env state.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // No setupFiles — these tests don't touch external state.
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
