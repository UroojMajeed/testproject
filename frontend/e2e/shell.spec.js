import { test, expect } from '@playwright/test';
import { stubApi, UNSORTED } from './apiStub.js';

/**
 * The frame, in a browser.
 *
 * jsdom proves which links exist and which one is marked. What it cannot see is
 * the thing the frame is actually for: that the rail becomes a bar along the
 * bottom on a phone, that the bar does not sit on top of the page, and that a tab
 * is big enough to hit with a thumb.
 */

const sections = (page) => page.getByRole('navigation', { name: /sections/i });

test.describe('the frame', () => {
  test('offers every section, and marks the one you are in', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await expect(sections(page).getByRole('link')).toHaveText(['Your week', 'This week', 'Activities', 'Your rate']);
    await expect(sections(page).getByRole('link', { name: 'Your week' })).toHaveAttribute('aria-current', 'page');
  });

  test('switching sections moves the mark with the page', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await sections(page).getByRole('link', { name: 'This week' }).click();

    await expect(page).toHaveURL(/\/app\/audit$/);
    await expect(sections(page).getByRole('link', { name: 'This week' })).toHaveAttribute('aria-current', 'page');
    // "/app" is a prefix of "/app/audit", so an inexact match would leave the
    // dashboard claiming to be current on every page in the app.
    await expect(sections(page).getByRole('link', { name: 'Your week' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('carries the wordmark and the account controls once, for every page', async ({ page }) => {
    await stubApi(page, { signedIn: true });

    for (const path of ['/app', '/app/audit', '/app/rate']) {
      await page.goto(path);
      await sections(page).waitFor();
      await expect(page.locator('.logo')).toHaveCount(1);
      await expect(page.getByRole('button', { name: /sign out/i })).toHaveCount(1);
    }
  });

  test('is not there during the first run', async ({ page }) => {
    // A sidebar offering three destinations mid-setup invites people out of it.
    await stubApi(page, { signedIn: true, onboarding: { needsRate: true, needsFirstAudit: true, completedAudits: 0 } });
    await page.goto('/app/rate');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(sections(page)).toHaveCount(0);
    // Still branded, though — a bare funnel is not a blank page.
    await expect(page.locator('.logo')).toHaveCount(1);
  });

  test('is not there on the first sort either', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/what matters/i);
    await expect(sections(page)).toHaveCount(0);
  });
});

test.describe('the frame on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('becomes a bar along the bottom, where a thumb reaches', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');
    await sections(page).waitFor();

    const nav = await sections(page).boundingBox();
    const viewport = page.viewportSize();

    // Pinned to the bottom edge and spanning the width — a rail squeezed into a
    // 390px screen would eat a third of it.
    expect(Math.round(nav.y + nav.height)).toBe(viewport.height);
    expect(nav.width).toBe(viewport.width);
  });

  test('every tab is a real target', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');
    await sections(page).waitFor();

    for (const link of await sections(page).getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box.height, `"${(await link.innerText()).trim()}" is ${Math.round(box.height)}px`).toBeGreaterThanOrEqual(44);
    }
  });

  test('does not sit on top of the end of the page', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');
    await sections(page).waitFor();

    const last = page.locator('.rate-footnote');
    await last.scrollIntoViewIfNeeded();

    const gap = await page.evaluate(() => {
      const nav = document.querySelector('.shell__nav').getBoundingClientRect();
      const end = document.querySelector('.rate-footnote').getBoundingClientRect();
      return Math.round(nav.top - end.bottom);
    });

    expect(gap, `the bar covers the last line by ${-gap}px`).toBeGreaterThanOrEqual(0);
  });

  test('nothing overflows sideways with the frame up', async ({ page }) => {
    await stubApi(page, { signedIn: true });

    for (const path of ['/app', '/app/audit', '/app/rate']) {
      await page.goto(path);
      await sections(page).waitFor();
      const over = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${path} overflows by ${over}px`).toBeLessThanOrEqual(0);
    }
  });
});
