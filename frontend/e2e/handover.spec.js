import { test, expect } from '@playwright/test';
import { stubApi, collectConsoleErrors } from './apiStub.js';

/**
 * Step 4 in a browser.
 *
 * The part worth a browser is the round trip a person actually makes: decide on
 * the page that names the cost, land on a checklist, tick something, and have it
 * still ticked after a reload. jsdom proves the requests; only this proves the
 * screens agree afterwards.
 */

const start = (page) => page.getByRole('button', { name: /hand this over/i });

test.describe('deciding what to hand over', () => {
  test('is reachable from the frame and makes the case in money', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await page.getByRole('navigation', { name: /sections/i }).getByRole('link', { name: 'Handover roadmap' }).click();

    await expect(page).toHaveURL(/\/app\/handover$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/handover roadmap/i);
    // 4h a week at $15 over 50 weeks, and the rate that decides it.
    await expect(page.getByText(/4h a week is costing you \$3,000 a year/i)).toBeVisible();
    await expect(page.getByText(/that is your buyback rate/i)).toBeVisible();
  });

  test('names no salary it could not know', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await page.locator('.candidate').first().waitFor();

    // The test the book gives is "cheaper than your own hour", not "this job pays
    // £X" — and an invented range is a number somebody would hire on.
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/salary|per annum|\ba year for the role\b/i);
    expect(body).toMatch(/less than \$15 an hour/i);
  });

  test('starting one turns the row into a checklist', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');

    await start(page).click();

    await expect(page.getByRole('heading', { name: /on their way out/i })).toBeVisible();
    await expect(page.locator('.handover__step')).toHaveCount(3);
    await expect(page.getByText('0 of 3')).toBeVisible();
    // No longer waiting on a decision: it is under way.
    await expect(start(page)).toHaveCount(0);
  });
});

test.describe('working through the checklist', () => {
  test('a tick survives a reload, which is the whole point of saving it', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await start(page).click();
    await page.locator('.handover__step').first().waitFor();

    await page.getByRole('checkbox', { name: /record yourself doing it once/i }).check();
    await expect(page.getByText('1 of 3')).toBeVisible();

    await page.reload();

    await expect(page.getByRole('checkbox', { name: /record yourself doing it once/i })).toBeChecked();
    await expect(page.getByText('1 of 3')).toBeVisible();
  });

  test('the status follows the boxes rather than being claimed', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await start(page).click();
    await page.locator('.handover__step').first().waitFor();

    const boxes = page.getByRole('checkbox');
    const count = await boxes.count();
    for (let i = 0; i < count; i += 1) await boxes.nth(i).check();

    await expect(page.getByText(new RegExp(`${count} of ${count}`))).toBeVisible();
    await expect(page.getByText(/handed over\. that is 4h a week back/i)).toBeVisible();
  });

  test('records who is taking it on', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await start(page).click();
    await page.locator('.handover__step').first().waitFor();

    await page.getByLabel(/who is taking it on/i).fill('Aisha');
    await page.keyboard.press('Tab');
    await page.reload();

    await expect(page.getByLabel(/who is taking it on/i)).toHaveValue('Aisha');
  });

  test('asks before calling one off', async ({ page }) => {
    const console_ = collectConsoleErrors(page);
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await start(page).click();
    await page.locator('.handover__step').first().waitFor();

    await page.getByRole('button', { name: /stop handing over/i }).click();
    await expect(page.getByText(/call it off\?/i)).toBeVisible();

    await page.getByRole('button', { name: /yes, stop/i }).click();

    await expect(page.locator('.handover')).toHaveCount(0);
    await expect(start(page)).toBeVisible();
    expect(console_.errors).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the rows stack and every box is a real target', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/handover');
    await start(page).click();
    await page.locator('.handover__step').first().waitFor();

    const row = page.locator('.handover__check').first();
    const box = await row.boundingBox();
    // The whole row is the label, so the target is the row, not the 16px box.
    expect(box.height).toBeGreaterThanOrEqual(44);

    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflows by ${over}px`).toBeLessThanOrEqual(0);
  });
});
