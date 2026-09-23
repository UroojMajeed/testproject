import { defineConfig } from 'vitest/config';

/** Unit tests: no database, no network. These run anywhere. */
export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.js'], testTimeout: 10_000 },
});
