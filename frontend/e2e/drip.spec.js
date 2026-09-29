import { test, expect } from '@playwright/test';
import { stubApi, collectConsoleErrors, DASHBOARD, UNSORTED, quadrant } from './apiStub.js';

/**
 * The matrix, and the question that fills it.
 *
 * The value question used to be a screen of its own between the audit and the
 * dashboard — one more thing between a person and the figures they came for. It
 * is asked here now, directly above the grid it feeds, so the reason for asking
 * is on screen while it is being asked.
 */

const cell = (page, name) => page.locator(`.drip__cell[data-quadrant="${name}"]`);

test.describe('the DRIP matrix', () => {
  test('is a real 2x2 with every quadrant drawn', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');

    await expect(page.getByRole('heading', { name: /what to do about it/i })).toBeVisible();

    // A 2x2 missing a corner is not a 2x2, and an empty Replace says something.
    for (const name of ['replace', 'delegate', 'produce', 'invest']) {
      await expect(cell(page, name)).toBeVisible();
    }
    await expect(cell(page, 'replace')).toContainText(/nothing here/i);
  });

  test('labels its axes in the words the questions were asked in', async ({ page }) => {
    // Wide enough for a grid. Below that the axes are dropped on purpose — see the
    // test underneath.
    await page.setViewportSize({ width: 1280, height: 900 });
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    for (const label of ['Matters more', 'Matters less', 'Drains you', 'Energises you']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('the value axis points the way the grid is actually laid out', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    const labels = await page.locator('.drip__axis--y span').evaluateAll((ns) =>
      ns.map((n) => ({ text: n.textContent, y: n.getBoundingClientRect().y })));
    const more = labels.find((l) => /matters more/i.test(l.text));
    const less = labels.find((l) => /matters less/i.test(l.text));

    // The top row is Replace and Produce, the two high-value quadrants. The
    // rotation that makes the text read bottom-to-top also reverses the order, so
    // "matters more" ended up beside the row that matters least — an axis pointing
    // the wrong way is worse than no axis, and nothing about the page looks broken
    // when it happens.
    expect(more.y, 'the high-value label must sit beside the high-value row').toBeLessThan(less.y);

    const replace = await cell(page, 'replace').boundingBox();
    const delegate = await cell(page, 'delegate').boundingBox();
    expect(replace.y).toBeLessThan(delegate.y);
  });

  test('stops being a grid on a phone without stopping making sense', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    // A 2x2 at 390px is unreadable, so it stacks and the axes go. What cannot go
    // is the meaning: each cell has to say in words what its position said.
    await expect(page.getByText('Matters more', { exact: true })).toBeHidden();
    await expect(cell(page, 'delegate')).toContainText(/drains you, and the business would barely notice/i);
    await expect(cell(page, 'produce')).toContainText(/you like it, and it matters/i);
  });

  test('puts each activity in its quadrant, priced', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    await expect(cell(page, 'delegate')).toContainText('Invoicing');
    // 4h a week at $15 over 50 weeks.
    await expect(cell(page, 'delegate')).toContainText('$3,000');
    await expect(cell(page, 'produce')).toContainText('Sales calls');
  });

  test('the grid keeps its shape on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    for (const name of ['replace', 'delegate', 'produce', 'invest']) {
      const box = await cell(page, name).boundingBox();
      expect(box.width, `${name} is ${Math.round(box.width)}px`).toBeGreaterThan(120);
    }

    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflows by ${over}px`).toBeLessThanOrEqual(0);
  });

  test('says it fills in as you answer, rather than showing an empty grid with no way forward', async ({ page }) => {
    const console_ = collectConsoleErrors(page);
    await stubApi(page, {
      signedIn: true,
      dashboard: {
        ...DASHBOARD,
        activities: DASHBOARD.activities.map((row) => ({ ...row, value: null, quadrant: null })),
        matrix: {
          delegate: quadrant([]), replace: quadrant([]), invest: quadrant([]), produce: quadrant([]),
        },
        unsortedCount: 2,
      },
    });
    await page.goto('/app/matrix');

    await expect(page.getByRole('heading', { name: /the matrix fills in as you answer/i })).toBeVisible();
    // The idea is still explained. An empty grid with no explanation teaches
    // nobody what the grid is for, which is the one thing this page owes.
    await expect(page.getByRole('heading', { name: /how an activity gets placed/i })).toBeVisible();
    await expect(page.getByText(/delegate against replace/i)).toBeVisible();

    expect(console_.errors).toEqual([]);
  });
});

test.describe('the question that fills it', () => {
  test('is asked on the dashboard, above the grid, not on a screen of its own', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/matrix');

    // No redirect anywhere: the dashboard is what a finished audit leads to, and
    // the question is asked on the matrix rather than on a screen of its own.
    await expect(page).toHaveURL(/\/app\/matrix$/);
    await expect(page.locator('.needs')).toBeVisible();
    await expect(page.locator('.needs__item')).toHaveCount(2);

    const needs = await page.locator('.needs').boundingBox();
    const grid = await page.locator('.drip, .notice').first().boundingBox();
    expect(needs.y, 'the question has to sit above the grid it feeds').toBeLessThan(grid.y);
  });

  test('answering a row takes it off the list', async ({ page }) => {
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/matrix');
    await page.locator('.needs__item').first().waitFor();

    const row = page.locator('.needs__item').filter({ hasText: 'Bookkeeping' });
    await row.getByRole('button', { name: 'Revenue stops' }).click();

    await expect(page.locator('.needs__item').filter({ hasText: 'Bookkeeping' })).toHaveCount(0);
    await expect(page.locator('.needs__item')).toHaveCount(1);
  });

  test('is not there at all once everything has an answer', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/matrix');
    await page.locator('.drip').waitFor();

    await expect(page.locator('.needs')).toHaveCount(0);
  });

  test('every answer is a real target on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubApi(page, { signedIn: true, unsorted: UNSORTED });
    await page.goto('/app/matrix');
    await page.locator('.needs__item').first().waitFor();

    for (const label of ['Revenue stops', 'Not much, honestly']) {
      const box = await page.locator('.needs__item').first().getByRole('button', { name: label }).boundingBox();
      expect(box.height, `"${label}" is ${Math.round(box.height)}px tall`).toBeGreaterThanOrEqual(44);
    }
  });
});
