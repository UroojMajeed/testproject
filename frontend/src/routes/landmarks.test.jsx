import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import App from '../App.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { mockApi, success, bootSignedOut } from '../test/fetchMock.js';
import { endpoints } from '../lib/api/endpoints.js';
import { paths } from './paths.js';

/**
 * The skip link is the first thing in the tab order on every page, and it is worth
 * exactly as much as the target it points at.
 *
 * Two ways it breaks silently. The id can go missing, and then the link does
 * nothing. Or App can wrap the routes in a `<main>` of its own while a page also
 * renders one, and then there are two main landmarks and invalid HTML — which no
 * screenshot shows and no user reports, they just find the page harder to use.
 *
 * So render the whole App at each route and check the structure.
 */

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com', timezone: 'UTC', emailVerified: false },
});

const renderAt = async (route, signedIn = false) => {
  mockApi(signedIn ? { [`POST ${endpoints.auth.refresh()}`]: SESSION } : bootSignedOut);
  return renderWithProviders(<App />, { route });
};

const PUBLIC_ROUTES = [
  ['the landing page', paths.landing],
  ['sign in', paths.login],
  ['sign up', paths.register],
  ['forgot password', paths.forgotPassword],
  ['reset password', `${paths.resetPassword}?token=${'a'.repeat(28)}`],
];

describe('every page is one document with one main landmark', () => {
  it.each(PUBLIC_ROUTES)('%s', async (_label, route) => {
    const { container } = await renderAt(route);

    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe('main');
    // Without tabindex the browser scrolls to the target but leaves focus where it
    // was, so the next Tab returns to the skip link you just followed.
    expect(mains[0].getAttribute('tabindex')).toBe('-1');
  });

  it('the signed-in page', async () => {
    const { container } = await renderAt(paths.app, true);

    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe('main');
  });

  it('offers the skip link first, before anything else focusable', async () => {
    const { container } = await renderAt(paths.landing);

    const focusable = container.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])');
    expect(focusable[0]).toHaveTextContent(/skip to main content/i);
    expect(focusable[0]).toHaveAttribute('href', '#main');
  });
});

describe('the routes lead where they say', () => {
  it('sends an unknown URL to the landing page, not to a login form', async () => {
    await renderAt('/some/url/that/does/not/exist');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/best hours/i);
  });

  it('sends a signed-out visitor from the app to sign in', async () => {
    await renderAt(paths.app);

    expect(screen.getByRole('heading', { level: 1, name: /sign in/i })).toBeInTheDocument();
  });

  it('keeps a signed-in user on the landing page if that is where they went', async () => {
    await renderAt(paths.landing, true);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/best hours/i);
    expect(screen.getByRole('link', { name: /go to your account/i })).toBeInTheDocument();
  });

  it('moves a signed-in user off the sign-up form, which is a dead end for them', async () => {
    await renderAt(paths.register, true);

    expect(screen.getByRole('heading', { level: 1, name: /urooj majeed/i })).toBeInTheDocument();
  });
});
