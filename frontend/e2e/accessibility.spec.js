import { test, expect } from '@playwright/test';
import { stubApi, FIRST_NAME } from './apiStub.js';

/**
 * The checks that need a browser.
 *
 * src/styles/contrast.test.js measures the palette, which is necessary and not
 * sufficient: it reads token values, and cannot know which CSS rule actually wins
 * on a given element. Both real bugs found so far lived in that gap — a focus ring
 * Bootstrap overrode at zero width, and a Bootstrap default grey at 4.37:1 that we
 * had simply never set. Every token was correct in both cases.
 *
 * So this file asks the browser what it computed, not what we declared.
 */

const relativeLuminance = ([r, g, b]) => {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const toRgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(toRgb(foreground)), relativeLuminance(toRgb(background))]
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** What the element is really drawn on: the nearest ancestor with a solid fill. */
const MEASURE = (node) => {
  const style = getComputedStyle(node);
  const isTransparent = (c) => !c || /rgba\(0, 0, 0, 0\)|transparent/.test(c);

  let behind = null;
  for (let n = node.parentElement; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (!isTransparent(c)) { behind = c; break; }
  }

  return {
    color: style.color,
    own: style.backgroundColor,
    behind: behind ?? 'rgb(255, 255, 255)',
    borderColor: style.borderTopColor,
    // A border only counts if it can be seen. Several controls carry
    // `1px solid transparent` to reserve the space without drawing an edge, and
    // measuring those reports rgba(0,0,0,0) as black — which passes on a light
    // background and fails on a dark one, for an edge nobody can see either way.
    hasBorder: parseFloat(style.borderTopWidth) > 0 && !isTransparent(style.borderTopColor),
    fontSize: parseFloat(style.fontSize),
    fontWeight: Number(style.fontWeight) || 400,
    height: node.getBoundingClientRect().height,
  };
};

async function expectReadable(locator, label) {
  const m = await locator.evaluate(MEASURE);
  const background = /rgba\(0, 0, 0, 0\)|transparent/.test(m.own) ? m.behind : m.own;
  const ratio = contrastRatio(m.color, background);

  // WCAG AA: 3:1 counts as large only at 24px, or 18.66px when bold.
  const isLarge = m.fontSize >= 24 || (m.fontSize >= 18.66 && m.fontWeight >= 700);
  const required = isLarge ? 3 : 4.5;

  expect(ratio, `${label}: text ${m.color} on ${background} is ${ratio.toFixed(2)}:1, needs ${required}`)
    .toBeGreaterThanOrEqual(required);

  if (m.hasBorder) {
    const borderRatio = contrastRatio(m.borderColor, m.behind);
    expect(borderRatio, `${label}: border ${m.borderColor} is ${borderRatio.toFixed(2)}:1 against its surroundings`)
      .toBeGreaterThanOrEqual(3);
  }
}

test.describe('what the browser actually computes', () => {
  test('every control on the landing page is readable', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    await expectReadable(page.locator('h1'), 'headline');
    await expectReadable(page.locator('.landing__lede'), 'lede');
    await expectReadable(page.locator('.landing__actions .btn-primary'), 'primary call to action');
    // This is the one that was at 4.37:1, on Bootstrap's untouched $secondary.
    await expectReadable(page.locator('.landing__actions .btn-outline-secondary'), 'secondary call to action');
    await expectReadable(page.locator('.site-bar__nav .btn-link'), 'sign-in link');
    await expectReadable(page.locator('.eyebrow'), 'section eyebrow');
    await expectReadable(page.locator('.landing__step-number').first(), 'step number');
    await expectReadable(page.locator('.landing__step-body').first(), 'step body');
    await expectReadable(page.locator('.landing__panel-body'), 'panel body');
    await expectReadable(page.locator('.landing__footer p'), 'footer');
  });

  test('every control on the sign-in form is readable', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-in');

    await expectReadable(page.locator('.form-label').first(), 'field label');
    await expectReadable(page.locator('.form-control').first(), 'input text');
    await expectReadable(page.locator('button[type="submit"]'), 'submit button');
    await expectReadable(page.locator('.input-group .btn'), 'reveal toggle');
    await expectReadable(page.getByRole('link', { name: /forgotten your password/i }), 'forgot link');
    await expectReadable(page.locator('.logo'), 'wordmark');
  });

  test('an error message and its field are readable when shown', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-up');

    // Fill the rest, so the password is the only field in error. Submitting an
    // empty form would put three messages on screen and prove less.
    await page.getByLabel(/your name/i).fill('Urooj Majeed');
    await page.getByLabel(/email address/i).fill('founder@example.com');
    await page.getByLabel(/^password/i).fill('short');
    await page.getByRole('button', { name: /create account/i }).click();

    const error = page.locator('.field-error');
    await expect(error).toHaveCount(1);
    await expectReadable(error, 'field error');
    await expectReadable(page.locator('.field-hint'), 'field hint');

    // Colour is never the only signal that a field is wrong.
    await expect(page.getByLabel(/^password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  test('focus on the primary button draws two opaque bands', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    const cta = page.getByRole('link', { name: /create your account/i }).first();
    await cta.focus();
    // Bootstrap transitions box-shadow over 150ms. Reading it immediately reports a
    // 2px band as 0.05px, which would let a nearly-invisible ring pass.
    await page.waitForTimeout(400);

    const shadow = await cta.evaluate((el) => getComputedStyle(el).boxShadow);

    const spreads = [...shadow.matchAll(/(\d+(?:\.\d+)?)px(?=[,)]|\s*$)/g)].map((m) => Number(m[1]));
    const bands = spreads.filter((px) => px >= 1.5);

    expect(bands.length, `focus ring should have two visible bands, got "${shadow}"`).toBeGreaterThanOrEqual(2);
    // A semi-transparent ring is what Bootstrap's own looks like; ours is solid.
    expect(shadow, 'focus ring should be opaque').not.toMatch(/rgba\([^)]*,\s*0\.\d+\)/);
  });

  test.describe.configure({ mode: 'serial' });

  for (const [label, path] of [
    ['landing', '/'],
    ['sign in', '/sign-in'],
    ['sign up', '/sign-up'],
    ['forgot password', '/forgot-password'],
  ]) {
    test(`${label} has one main landmark and one h1`, async ({ page }) => {
      await stubApi(page);
      await page.goto(path);

      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('main')).toHaveAttribute('id', 'main');
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('the skip link is first, and moves focus where it points', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toMatch(/skip to main content/i);

    await page.keyboard.press('Enter');
    // Without tabindex="-1" on the target the browser scrolls but leaves focus
    // behind, so the next Tab returns to the link you just followed.
    const landed = await page.evaluate(() => document.activeElement?.tagName);
    expect(landed).toBe('MAIN');
  });

  test('the whole sign-in form is reachable by keyboard alone', async ({ page }) => {
    await stubApi(page);
    await page.goto('/sign-in');

    const reached = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      reached.push(await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute('aria-label') || el?.labels?.[0]?.textContent?.trim() || el?.textContent?.trim();
      }));
    }

    expect(reached.join(' | ')).toMatch(/email address/i);
    expect(reached.join(' | ')).toMatch(/password/i);
    expect(reached.join(' | ')).toMatch(/show password/i);
    expect(reached.join(' | ')).toMatch(/sign in/i);
  });

  test('every interactive control is at least 44px tall', async ({ page }) => {
    await stubApi(page, { signedIn: true });

    for (const path of ['/', '/sign-in', '/sign-up', '/app', '/app/sort']) {
      await page.goto(path);
      const small = await page.locator('button, .btn').evaluateAll((nodes) =>
        nodes
          .filter((n) => n.offsetParent !== null)
          .map((n) => ({ text: n.textContent.trim().slice(0, 30), height: Math.round(n.getBoundingClientRect().height) }))
          .filter((n) => n.height < 44));

      expect(small, `controls under 44px on ${path}`).toEqual([]);
    }
  });

  test('nothing overflows sideways', async ({ page }) => {
    await stubApi(page, { signedIn: true });

    for (const path of ['/', '/sign-in', '/sign-up', '/forgot-password', '/app', '/app/sort']) {
      await page.goto(path);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);

      // A sideways scrollbar on a phone is the clearest sign a layout was only
      // ever looked at on a laptop.
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test('the page declares its language and a title', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/ReclaimOS/);
  });

  test('the signed-in page is readable too', async ({ page }) => {
    await stubApi(page, { signedIn: true });
    await page.goto('/app');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(FIRST_NAME);
    await expectReadable(page.locator('h1'), 'greeting');
    await expectReadable(page.getByRole('button', { name: /sign out/i }), 'sign out');
  });
});

/**
 * The theme itself.
 *
 * _tokens.scss decides the values and src/styles/contrast.test.js measures them,
 * but neither can tell you whether the page is actually wearing them. That needs a
 * browser resolving a media query, which is what the `dark` project supplies.
 */
test.describe('theming', () => {
  test('follows the operating system without being asked', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    const prefersDark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
    const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = (canvas.match(/\d+/g) ?? []).map(Number);
    const isDarkCanvas = (r + g + b) / 3 < 96;

    expect(isDarkCanvas, `canvas is ${canvas} while prefers-color-scheme: dark is ${prefersDark}`)
      .toBe(prefersDark);
  });

  test('never paints a pure black canvas', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    // #000 against a lit room is a glare edge, and it leaves shadows nowhere to go.
    const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(canvas).not.toBe('rgb(0, 0, 0)');
  });

  test('an explicit choice overrides the system, in both directions', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    const canvasNow = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const dark = await canvasNow();

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const light = await canvasNow();

    // The :not([data-theme='light']) guard on the media query is what makes the
    // second of these work on a machine set to dark. Without it the system wins and
    // the toggle appears broken for exactly the people who most want it.
    expect(dark).not.toBe(light);
    const brightness = (c) => (c.match(/\d+/g) ?? []).map(Number).slice(0, 3).reduce((a, n) => a + n, 0);
    expect(brightness(light)).toBeGreaterThan(brightness(dark));
  });

  test('the toggle cycles system, light, dark and says which it is on', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toHaveAttribute('data-theme-state', 'system');

    // A three-state cycle, not a switch: "follow my computer" is a real preference
    // and a two-state toggle throws it away the first time it is pressed.
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-state', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-state', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-state', 'system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('the choice survives a reload', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    await page.locator('.theme-toggle').click();
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();

    // Applied before React renders, so there is no flash of the wrong theme.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.theme-toggle')).toHaveAttribute('data-theme-state', 'dark');
  });

  test('the toggle is reachable and labelled', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /theme:/i });
    await expect(toggle).toBeVisible();
    await expectReadable(toggle, 'theme toggle');

    const box = await toggle.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test('the wordmark is set in the display serif, not the UI sans', async ({ page }) => {
    await stubApi(page);
    await page.goto('/');

    // A family name with a digit in it — "Source Serif 4 Variable" — is invalid
    // unquoted, and a browser drops the whole declaration without complaint. That
    // shipped once: the stylesheet compiled, every test passed, and the headline was
    // quietly set in the UI font. Assert on what the browser resolved.
    const family = await page.locator('.logo').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/Source Serif/);

    const loaded = await page.evaluate(() => document.fonts.check('16px "Source Serif 4 Variable"'));
    expect(loaded, 'the display serif should actually be loaded, not just requested').toBe(true);
  });
});
