import { defineConfig } from 'vitest/config';
import { testEnv } from './vitest.env.js';

/**
 * Integration tests: need a real mongod, from mongodb-memory-server or from
 * MONGODB_TEST_URI pointing at a live instance.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    env: testEnv,
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
