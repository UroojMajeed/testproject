import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests. Run them with `npm run e2e`, after `npx playwright install
 * chromium` once — that download is why they are not part of `npm run verify`.
 *
 * Separate from `npm run test` on purpose — those are 150 jsdom
 * tests that run in four seconds and belong in the edit loop; these start a
 * server and a browser, and belong to a slower one.
 *
 * They exist because jsdom cannot see a stylesheet. Two real bugs got past a full
 * green unit suite: a focus ring Bootstrap was overriding at zero width, and a
 * secondary button at 4.37:1. Both needed a browser computing styles to find.
 */
export default defineConfig({
  testDir: './e2e',
  // Each file drives a session through sign up and out; running them at once in
  // one browser would have them fighting over the same stubbed session state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    // Keep the evidence for a failure, and nothing for a pass.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  /**
   * Starts Vite and waits for the port, so `npm run e2e` is one command. An
   * already-running dev server is reused rather than fought with — strictPort
   * means a second one would fail outright.
   */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
