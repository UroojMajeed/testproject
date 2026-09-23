import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import LandingPage from './LandingPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, bootSignedOut } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';
import { paths } from '../../routes/paths.js';

const renderLanding = async (handlers = bootSignedOut) => {
  const mock = mockApi(handlers);
  const utils = await renderWithProviders(<LandingPage />, { route: paths.landing });
  return { ...utils, ...mock };
};

const signedIn = {
  [`POST ${endpoints.auth.refresh()}`]: success({
    accessToken: 'fresh',
    user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
  }),
};

describe('the landing page', () => {
  it('says what the product is in its one h1', async () => {
    await renderLanding();

    const headings = screen.getAllByRole('heading', { level: 1 });
    // Exactly one. A second h1 leaves a screen reader with no clue which is the
    // page's subject, and the outline stops being an outline.
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/best hours/i);
  });

  it('is readable without signing in', async () => {
    // Not behind GuestRoute or ProtectedRoute — it renders for an anonymous
    // visitor with no session at all, which is the entire point of a front page.
    await renderLanding();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', paths.login);
  });

  it('offers both doors, and points the primary one at sign up', async () => {
    await renderLanding();

    const signUpLinks = screen.getAllByRole('link', { name: /create your account|start free/i });
    expect(signUpLinks.length).toBeGreaterThanOrEqual(2); // header and hero
    for (const link of signUpLinks) expect(link).toHaveAttribute('href', paths.register);
  });

  it('offers the account instead of sign in once there is a session', async () => {
    await renderLanding(signedIn);

    expect(screen.getByRole('link', { name: /go to your account/i })).toHaveAttribute('href', paths.app);
    // Showing "Sign in" to someone already signed in is the small wrongness that
    // makes an app feel like it is not paying attention.
    expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /start free/i })).not.toBeInTheDocument();
  });

  it('describes the four steps in order, as a list', async () => {
    await renderLanding();

    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps.map((li) => li.querySelector('h3').textContent)).toEqual([
      'Audit', 'Decide', 'Transfer', 'Measure',
    ]);
    // An ordered list, because the order is the meaning. A screen reader announces
    // "4 items" and the position within them; a row of divs announces nothing.
    expect(steps[0].closest('ol')).not.toBeNull();
  });

  it('says plainly that only accounts are built so far', async () => {
    await renderLanding();

    /**
     * The honesty rule. This page describes an audit, a rate and playbooks, none of
     * which exist yet — so it has to say where the build has got to. Without this,
     * the first signed-in screen reads as a broken promise rather than step 1.
     */
    expect(screen.getByRole('heading', { name: /what works today/i })).toBeInTheDocument();
    expect(screen.getByText(/sign up, sign in, sessions that survive a reload/i)).toBeInTheDocument();
  });

  it('puts the page heading before the navigation in the heading order', async () => {
    await renderLanding();

    const headings = screen.getAllByRole('heading');
    expect(headings[0]).toHaveTextContent(/best hours/i);
    // h1 then h2s then h3s, never a level skipped.
    const levels = headings.map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('links "See how it works" to a section that exists on the page', async () => {
    const { container } = await renderLanding();

    const anchor = screen.getByRole('link', { name: /see how it works/i });
    const target = anchor.getAttribute('href');

    expect(target).toMatch(/^#/);
    // A jump link to a missing id silently does nothing, which is worse than a
    // visibly broken link because nobody reports it.
    expect(container.querySelector(target)).not.toBeNull();
  });

  it('keeps the wordmark out of the heading outline', async () => {
    await renderLanding();

    // It is a brand mark, not a heading. Marking it up as one would put "ReclaimOS"
    // above the actual subject of the page in every outline and screen-reader list.
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.some((text) => text.trim() === 'ReclaimOS')).toBe(false);
  });
});
