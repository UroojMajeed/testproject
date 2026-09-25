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


const item = (page, name) => page.locator('.sort-item').filter({ hasText: name });

test.describe('sorting what matters', () => {
  test('a first-timer is sent here, and sees the whole list at once', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app');

    // The gate, not a link: the matrix would otherwise be empty on the one visit
    // that decides whether anybody comes back.
    await expect(page).toHaveURL(/\/app\/sort$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/one more question each/i);

    // One screen, not one screen per activity — this arrives straight after the
    // audit, and a deck of cards there is a gauntlet.
    await expect(page.locator('.sort-item')).toHaveCount(2);
    await expect(page.getByText('0 of 2 answered')).toBeVisible();
  });

  test('answering marks the row and moves the count', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await item(page, 'Bookkeeping').getByRole('button', { name: 'Not much, honestly' }).click();

    await expect(item(page, 'Bookkeeping').getByRole('button', { name: 'Not much, honestly' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 of 2 answered')).toBeVisible();
    // One click must not answer two activities.
    await expect(item(page, 'Social posts').getByRole('button', { name: 'Not much, honestly' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  test('leaving lands on the dashboard whether or not everything was answered', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await item(page, 'Bookkeeping').getByRole('button', { name: 'Revenue stops' }).click();
    await page.getByRole('button', { name: /done for now/i }).click();

    await expect(page).toHaveURL(/\/app$/);
  });

  test('the button says what is left to do', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    await expect(page.getByRole('button', { name: /done for now/i })).toBeVisible();

    for (const name of ['Bookkeeping', 'Social posts']) {
      await item(page, name).getByRole('button', { name: 'Revenue stops' }).click();
    }

    await expect(page.getByRole('button', { name: /see what it costs/i })).toBeVisible();
  });

  test('every answer is a real target, and reachable by keyboard alone', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');

    const first = item(page, 'Bookkeeping').getByRole('button', { name: 'Revenue stops' });
    const box = await first.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);

    await first.focus();
    const ring = await first.evaluate((n) => getComputedStyle(n).boxShadow);
    expect(ring).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  test('the rows stack rather than squeeze on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/sort');
    await page.locator('.sort-item').first().waitFor();

    const name = await item(page, 'Bookkeeping').locator('.sort-item__name').boundingBox();
    const answers = await item(page, 'Bookkeeping').locator('.sort-item__answers').boundingBox();
    expect(answers.y).toBeGreaterThan(name.y + name.height - 2);

    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflows by ${over}px`).toBeLessThanOrEqual(0);
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
