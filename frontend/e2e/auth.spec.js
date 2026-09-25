import { test, expect } from '@playwright/test';
import { stubApi, collectConsoleErrors, PASSWORD, USER, FIRST_NAME } from './apiStub.js';

/**
 * The login module, driven the way a person drives it.
 *
 * These deliberately repeat some of what the jsdom tests already cover. The point
 * is not the assertion, it is the environment: a real browser navigating real
 * URLs, with a stylesheet, a history stack and a focus model. Every bug found here
 * so far was invisible to jsdom.
 */

// Initialised here, not in beforeEach: if a test fails before the hook completes,
// afterEach still runs, and asserting on an undefined variable buries the real
// failure under a second, confusing one.
let console_;

test.beforeEach(async ({ page }) => {
  console_ = collectConsoleErrors(page);
});

test.afterEach(async () => {
  // A page can render perfectly while something throws behind it.
  expect(console_?.errors ?? [], 'unexpected console or page errors').toEqual([]);
});

const fillSignUp = async (page, over = {}) => {
  const values = { name: USER.name, email: USER.email, password: PASSWORD, ...over };
  await page.getByLabel(/your name/i).fill(values.name);
  await page.getByLabel(/email address/i).fill(values.email);
  await page.getByLabel(/^password/i).fill(values.password);
  return values;
};

const signIn = async (page, password = PASSWORD) => {
  await page.getByLabel(/email address/i).fill(USER.email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
};

test.describe('signing up', () => {
  test('the landing page leads to the form, and the form leads into the app', async ({ page }) => {
    const api = await stubApi(page);
    await page.goto('/');

    await page.getByRole('link', { name: /create your account/i }).first().click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await fillSignUp(page);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(FIRST_NAME);

    // The browser's own timezone goes along, so dates read correctly later.
    const [sent] = api.callsTo('/api/v1/auth/register');
    expect(sent.body.timezone).toBeTruthy();
    expect(sent.body.email).toBe(USER.email);
  });

  test('a weak password is caught without calling the API at all', async ({ page }) => {
    const api = await stubApi(page);
    await page.goto('/sign-up');

    await fillSignUp(page, { password: 'short' });
    await page.getByRole('button', { name: /create account/i }).click();

    const password = page.getByLabel(/^password/i);
    await expect(password).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.field-error')).toHaveText(/use at least 12 characters/i);
    expect(api.callsTo('/api/v1/auth/register')).toHaveLength(0);
  });

  test('a rule only the server knows still lands under the right field', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-up');

    // The client blocklist and the server blocklist can drift. When the server is
    // the one to object, its message has to reach the field it names, not a banner.
    await fillSignUp(page, { password: 'server-only-rejection' });
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByLabel(/^password/i)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.field-error')).toHaveText(/too common/i);
  });

  test('a duplicate email is explained, with a way onward', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-up');

    await fillSignUp(page, { email: 'taken@example.com' });
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toContainText(/already registered/i);
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeEnabled();
  });

  test('the password can be revealed and hidden again', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-up');
    const password = page.getByLabel(/^password/i);
    await password.fill(PASSWORD);

    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});

test.describe('the session', () => {
  test('survives a reload, without the token ever touching storage', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(FIRST_NAME);

    await page.reload();

    // The access token is gone the moment the tab reloads; the httpOnly cookie is
    // the only evidence a session exists, and the boot refresh is what recovers it.
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(FIRST_NAME);

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored, 'browser storage should be empty').toBe('{}');
  });

  test('signing out ends it, and the app is closed again', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: /sign in/i })).toBeVisible();
  });

  test('a signed-out visitor is returned to the page they were aiming for', async ({ page }) => {
    await stubApi(page);
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1, name: /sign in/i })).toBeVisible();

    await signIn(page);

    // Back to /app, not to the front page. Dumping everyone at the top loses
    // whatever link brought them here.
    await expect(page).toHaveURL(/\/app$/);
  });

  test('the front page stays open, and offers the account instead of a sign-in link', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/best hours/i);
    await expect(page.getByRole('link', { name: /go to your account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^sign in$/i })).toHaveCount(0);
  });

  test('a signed-in user is moved off the sign-up form, which is a dead end for them', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/sign-up');

    await expect(page).toHaveURL(/\/app$/);
  });
});

test.describe('signing in', () => {
  test('a wrong password is announced, and gives nothing away about the address', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-in');

    await signIn(page, 'definitely-the-wrong-password');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/do not match an account/i);
    // "No account with that email" would hand out a free account-enumeration API.
    await expect(alert).not.toContainText(/no account|not found|does not exist|unknown/i);
  });

  test('repeated failures end in a lockout that says what to do instead', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-in');
    await signIn(page, 'wrong-password-here');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await expect(page.getByRole('alert')).toBeVisible();
    }

    await expect(page.getByRole('alert')).toContainText(/locked for a few minutes/i);
    await expect(page.getByRole('link', { name: /forgotten your password/i })).toBeVisible();
  });

  test('an unreachable API says so, rather than appearing to do nothing', async ({ page }) => {
    await stubApi(page);
    // The abort below is the point of the test, so its console error is expected.
    console_.allow(/net::ERR_FAILED/);
    await page.route('**/api/v1/auth/login', (route) => route.abort('failed'));
    await page.goto('/sign-in');

    await signIn(page);

    await expect(page.getByRole('alert')).toContainText(/cannot reach the server/i);
  });
});

test.describe('resetting a password', () => {
  test('the request is confirmed without confirming the account exists', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-in');

    await page.getByRole('link', { name: /forgotten your password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.getByLabel(/email address/i).fill('nobody@example.com');
    await page.getByRole('button', { name: /send the reset link/i }).click();

    const confirmation = page.getByRole('status');
    await expect(confirmation).toContainText(/if an account exists/i);
    await expect(confirmation).not.toContainText(/\bwe (have )?sent\b/i);
  });

  test('a link with no token explains itself instead of showing a dead form', async ({ page }) => {
    await stubApi(page);
    await page.goto('/reset-password');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/link is incomplete/i);
    await expect(page.getByRole('button', { name: /save the new password/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /request a new link/i })).toBeVisible();
  });

  test('a new password is set, and sign in explains why it is asking again', async ({ page }) => {
    await stubApi(page);
    await page.goto(`/reset-password?token=${'a'.repeat(40)}`);

    await page.getByLabel(/^new password/i).fill('a-completely-different-secret');
    await page.getByLabel(/confirm new password/i).fill('a-completely-different-secret');
    await page.getByRole('button', { name: /save the new password/i }).click();

    // The reset revoked every session, so there is nothing to sign the user into.
    // Landing on the form with no explanation would read as a failure.
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('status')).toContainText(/password was changed/i);
  });

  test('two passwords that differ are caught before the request', async ({ page }) => {
    const api = await stubApi(page);
    await page.goto(`/reset-password?token=${'a'.repeat(40)}`);

    await page.getByLabel(/^new password/i).fill('a-completely-different-secret');
    await page.getByLabel(/confirm new password/i).fill('a-completely-different-typo');
    await page.getByRole('button', { name: /save the new password/i }).click();

    await expect(page.locator('.field-error')).toContainText(/must match/i);
    expect(api.callsTo('/api/v1/auth/reset-password')).toHaveLength(0);
  });
});

test('an unrecognised URL goes to the front page, not to a login form', async ({ page }) => {
  await stubApi(page);
  await page.goto('/nope/not/a/page');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/best hours/i);
});
