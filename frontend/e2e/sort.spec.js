import { test, expect } from '@playwright/test';
import { stubApi, collectConsoleErrors, DASHBOARD, UNSORTED, quadrant } from './apiStub.js';

/**
 * The sort, and the matrix it feeds.
 *
 * jsdom proves the logic; this proves the screen. The two things it can see that
 * jsdom cannot are the gate actually redirecting a fresh account into the sort, and
 * the quadrant blocks laying out without collapsing on a phone — which is where
 * most of these answers will be given.
 */

const answer = (page, name) => page.getByRole('button', { name });

test.describe('sorting what matters', () => {
  test('a first-timer is sent to the sort, and answering works through the deck', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });

    await page.goto('/app');

    // The gate, not a link: the matrix would otherwise be empty on the one visit
    // that decides whether anybody comes back.
    await expect(page).toHaveURL(/\/app\/sort$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/what matters/i);

    await expect(page.getByText('1 of 2')).toBeVisible();
    await expect(page.getByText('Bookkeeping')).toBeVisible();

    await answer(page, /not much, honestly/i).click();

    await expect(page.getByText('2 of 2')).toBeVisible();
    await expect(page.getByText('Social posts')).toBeVisible();
  });

  test('the last answer ends on the dashboard, not on an empty card', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await answer(page, /not much, honestly/i).click();
    await expect(page.getByText('Social posts')).toBeVisible();
    await answer(page, /revenue stops/i).click();

    await expect(page).toHaveURL(/\/app$/);
  });

  test('each answer is a real target, and reachable by keyboard alone', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    const first = answer(page, /revenue stops/i);
    const box = await first.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);

    await first.focus();
    // Focus has to be visible on a card this large, or a keyboard user loses their
    // place between three answers that look alike.
    const ring = await first.evaluate((node) => getComputedStyle(node).boxShadow);
    expect(ring).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page.getByText('Social posts')).toBeVisible();
  });

  test('one question at a time — the other cards are not on the page', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await expect(page.getByText('Bookkeeping')).toBeVisible();
    await expect(page.getByText('Social posts')).toHaveCount(0);
  });
});

test.describe('the matrix on the dashboard', () => {
  test('shows the quadrants that have anything in them, with their totals', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await expect(page.getByRole('heading', { name: /what to do about it/i })).toBeVisible();

    const delegate = page.locator('.quadrant[data-quadrant="delegate"]');
    await expect(delegate.getByRole('heading', { name: 'Delegate' })).toBeVisible();
    await expect(delegate).toContainText('Invoicing');
    // 4h a week at $15 over 50 weeks.
    await expect(delegate).toContainText('$3,000');

    await expect(page.locator('.quadrant[data-quadrant="replace"]')).toHaveCount(0);
  });

  test('the blocks stack rather than squeeze on a phone', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    // evaluateAll does not wait for anything, so without this it measures an empty
    // list and passes or fails on whether the fetch happened to have landed.
    await expect(page.getByRole('heading', { name: /what to do about it/i })).toBeVisible();

    const boxes = await page.locator('.quadrant').evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().width));

    expect(boxes.length).toBeGreaterThan(1);
    // Two 17rem blocks side by side at 390px would be a squeeze or an overflow;
    // auto-fit is supposed to drop them to one column instead.
    for (const width of boxes) expect(width).toBeGreaterThan(260);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  });

  test('says so when nothing is sorted, instead of drawing an empty diagram', async ({ page }) => {
    const console_ = collectConsoleErrors(page);
    await stubApi(page, {
      signedIn: true,
      unsorted: UNSORTED,
      onboarding: { needsFirstSort: false },
      dashboard: {
        ...DASHBOARD,
        activities: DASHBOARD.activities.map((row) => ({ ...row, value: null, quadrant: null })),
        matrix: {
          delegate: quadrant([]), replace: quadrant([]), invest: quadrant([]), produce: quadrant([]),
        },
        unsortedCount: 2,
      },
    });

    await page.goto('/app');

    await expect(page.getByRole('heading', { name: /nothing sorted yet/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sort your activities/i })).toBeVisible();
    // The figures are still there: the matrix is the extra, not the price of entry.
    await expect(page.getByText('$7,500')).toBeVisible();

    expect(console_.errors).toEqual([]);
  });
});
