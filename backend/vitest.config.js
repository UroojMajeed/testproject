import { defineConfig } from 'vitest/config';
import { testEnv } from './vitest.env.js';

/** Unit tests: no database, no network. These run anywhere. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    testTimeout: 10_000,
    // Set before any module loads, so config/env.js validates against these and
    // not against whatever .env happens to be on this machine.
    env: testEnv,
  },
});
