import { test, expect } from '@playwright/test';
import { stubApi, collectConsoleErrors } from './apiStub.js';

/**
 * The activities list, in a browser.
 *
 * The part worth a browser is the round trip: change an answer here and the
 * dashboard's matrix has to move the activity. jsdom proves the request was sent;
 * only this proves the two screens agree afterwards.
 */

/**
 * A row, found by the name its field announces.
 *
 * Not `input[value="…"]`: React sets the initial value as an attribute and every
 * change after that as a property, so a value selector matches what the row was
 * called when the page loaded and never what it is called now.
 */
const rowFor = (page, name) =>
  page.locator('.activity-row').filter({ has: page.getByLabel(`Name of ${name}`, { exact: true }) });

/** The rows themselves — `listitem` alone also counts the nav's own list. */
const rows = (page) => page.locator('.activity-row');

test.describe('the activities list', () => {
  test('is reachable from the frame, and lists what keeps coming back', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await page.getByRole('navigation', { name: /sections/i }).getByRole('link', { name: 'Activities' }).click();

    await expect(page).toHaveURL(/\/app\/activities$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/your activities/i);
    // Two live ones; the archived third is not shown until it is asked for.
    await expect(rows(page)).toHaveCount(2);
  });

  /**
   * The stub cannot prove the round trip: its dashboard is a fixture, and a stub
   * that recomputed the matrix would be a second implementation of the DRIP rule,
   * free to drift from the server's. So this asserts the part the client owns —
   * that an answer here makes the dashboard go and ask again rather than replay a
   * cached matrix that no longer matches. The real round trip is checked against
   * the running API.
   */
  test('an answer here makes the dashboard go and ask again', async ({ page }) => {
    const api = await stubApi(page, { signedIn: true });
    await page.goto('/app');
    await expect(page.locator('.quadrant[data-quadrant="delegate"]')).toContainText('Invoicing');

    const before = api.callsTo('/api/v1/workspace/dashboard').length;

    await page.getByRole('navigation', { name: /sections/i }).getByRole('link', { name: 'Activities' }).click();
    await rowFor(page, 'Invoicing').getByRole('combobox').selectOption('critical');
    await page.getByRole('navigation', { name: /sections/i }).getByRole('link', { name: 'Your week' }).click();
    await page.getByRole('heading', { name: /what to do about it/i }).waitFor();

    expect(api.callsTo('/api/v1/workspace/dashboard').length).toBeGreaterThan(before);
  });

  test('renames on leaving the field, with no Edit button to find first', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/activities');

    await rowFor(page, 'Invoicing').getByRole('textbox').fill('Invoicing and chasing payment');
    await page.keyboard.press('Tab');

    await expect(rowFor(page, 'Invoicing and chasing payment')).toBeVisible();
    await expect(rowFor(page, 'Invoicing')).toHaveCount(0);
  });

  test('says what is wrong when the name is already taken, and puts the old one back', async ({ page }) => {
    const console_ = collectConsoleErrors(page);
    await stubApi(page, { signedIn: true });
    await page.goto('/app/activities');

    await rowFor(page, 'Invoicing').getByRole('textbox').fill('Sales calls');
    await page.keyboard.press('Tab');

    // The message has to be about activities. A blanket rule once answered this
    // with "There is already an account with that email address".
    await expect(page.getByRole('alert')).toContainText(/already have an activity with that name/i);
    await expect(rowFor(page, 'Invoicing').getByRole('textbox')).toHaveValue('Invoicing');

    console_.allow(/409/);
    expect(console_.errors).toEqual([]);
  });

  test('asks before archiving, and the row goes once it is confirmed', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/activities');

    await rowFor(page, 'Invoicing').getByRole('button', { name: /archive invoicing/i }).click();
    await expect(rowFor(page, 'Invoicing')).toContainText(/archive it\?/i);

    await rowFor(page, 'Invoicing').getByRole('button', { name: /yes, archive/i }).click();

    await expect(rowFor(page, 'Invoicing')).toHaveCount(0);
  });

  test('keeps archived activities out of the way until they are asked for', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/activities');

    await expect(rowFor(page, 'Tidying the CRM')).toHaveCount(0);

    await page.getByRole('checkbox', { name: /show the ones i have archived/i }).check();

    const archived = rowFor(page, 'Tidying the CRM');
    await expect(archived).toBeVisible();
    // Archived, never deleted — and the row says how it comes back.
    await expect(archived).toContainText(/name it in an audit and it comes back/i);
    await expect(archived.getByRole('textbox')).toBeDisabled();
  });
});

test.describe('the activities list on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stacks the name over the answer rather than squeezing both', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app/activities');
    await rows(page).first().waitFor();

    const name = await rowFor(page, 'Invoicing').getByRole('textbox').boundingBox();
    const answer = await rowFor(page, 'Invoicing').getByRole('combobox').boundingBox();

    expect(answer.y).toBeGreaterThan(name.y + name.height - 2);
    expect(name.width).toBeGreaterThan(260);

    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflows by ${over}px`).toBeLessThanOrEqual(0);
  });
});
