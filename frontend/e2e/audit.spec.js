import { test, expect } from '@playwright/test';
import { stubApi } from './apiStub.js';

/**
 * The weekly form, in a browser.
 *
 * How it felt is a custom control — a radio group drawn as one connected scale —
 * and the questions that matters raise cannot be answered in jsdom: is every step
 * actually clickable, does it survive a narrow screen without losing an option,
 * and can it be operated without a mouse.
 */

const rows = (page) => page.locator('.audit-row');

/** The radio itself, for asserting state and for focus. */
const step = (page, row, label) => rows(page).nth(row).getByRole('radio', { name: label, exact: true });

/**
 * What a person actually clicks.
 *
 * The radio is visually hidden and the 44px target is the label around it, so a
 * test that clicks the input is testing something no user can do — and would pass
 * just as happily if the label were never wired to it.
 */
const target = (page, row, label) =>
  rows(page).nth(row).locator('.energy__step').filter({ has: page.getByRole('radio', { name: label, exact: true }) });

test.describe('recording a week', () => {
  test('starts with one box and opens the next as soon as one is named', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();

    await expect(rows(page)).toHaveCount(1);

    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');

    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1).getByRole('textbox')).toHaveValue('');
  });

  test('offers no Remove on a box with nothing in it', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();

    await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(0);

    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');

    await expect(page.getByRole('button', { name: /remove invoicing/i })).toBeVisible();
    // The trailing box is always empty, so the list must not end in a dead action.
    await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(1);
  });

  test('every step of the scale can be picked, and says what it means', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();
    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');

    for (const [label, shown] of [
      ['Drains me', 'Drains me'],
      ['Neutral', 'Neutral'],
      ['Energises me', 'Energises me'],
    ]) {
      await target(page, 0, label).click();
      await expect(step(page, 0, label)).toBeChecked();
      // The glyph is a picture; the wording beside it is what carries the meaning.
      await expect(rows(page).nth(0).locator('.energy__chosen')).toHaveText(shown);
    }
  });

  test('the scale is reachable and operable without a mouse', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();
    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');

    await step(page, 0, 'Drains me').focus();
    const ring = await target(page, 0, 'Drains me').evaluate((n) => getComputedStyle(n).boxShadow);
    expect(ring).not.toBe('none');

    // Arrow keys move within a radio group; that is why this is radios and not
    // five buttons that happen to look like a group.
    await page.keyboard.press('ArrowRight');
    await expect(step(page, 0, 'A bit draining')).toBeChecked();
  });

  test('says a filed week is filed rather than asking to finish it again', async ({ page }) => {
    await stubApi(page, { signedIn: true, currentWeekFiled: true });
    await page.goto('/app/audit');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/this week is filed/i);
    await expect(page.getByRole('button', { name: /save the changes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /come back to it/i })).toHaveCount(0);
  });
});

test.describe('recording a week on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps all five steps — the one that gets clipped is the one that matters', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();
    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');

    const scale = rows(page).nth(0).locator('.energy__scale');
    const { width, needed } = await scale.evaluate((n) => ({
      width: Math.round(n.getBoundingClientRect().width),
      needed: n.scrollWidth,
    }));

    // Squeezed into four steps' worth of room it clips the fifth, and the fifth is
    // "energises me" — the answer the whole product exists to find more of.
    expect(width, `scale is ${width}px but needs ${needed}px`).toBeGreaterThanOrEqual(needed);

    for (const label of ['Drains me', 'Energises me']) {
      const box = await target(page, 0, label).evaluate((n) => {
        const b = n.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height) };
      });
      expect(box.h, `"${label}" is ${box.h}px tall`).toBeGreaterThanOrEqual(44);
      expect(box.w, `"${label}" is ${box.w}px wide`).toBeGreaterThanOrEqual(44);
    }
  });

  test('the hours a person typed are still readable', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();

    await rows(page).nth(0).getByRole('textbox').fill('Invoicing');
    await rows(page).nth(0).getByRole('spinbutton').fill('4');

    await expect(rows(page).nth(0).getByRole('spinbutton')).toHaveValue('4');
    const w = await rows(page).nth(0).getByRole('spinbutton').evaluate((n) => n.getBoundingClientRect().width);
    expect(w, `the hours box is ${Math.round(w)}px`).toBeGreaterThan(32);
  });

  test('nothing overflows sideways', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/audit');
    await rows(page).first().waitFor();
    await rows(page).nth(0).getByRole('textbox').fill('Invoicing and chasing payment');

    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflows by ${over}px`).toBeLessThanOrEqual(0);
  });
});
