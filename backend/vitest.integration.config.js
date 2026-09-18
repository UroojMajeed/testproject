import { defineConfig } from 'vitest/config';

/**
 * Integration tests: need a real mongod, supplied either by
 * mongodb-memory-server or by MONGODB_TEST_URI pointing at a live instance.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
