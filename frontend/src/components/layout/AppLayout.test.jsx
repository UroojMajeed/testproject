import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import App from '../../App.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, signedInWorkspace, WORKSPACE_STATE } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';
import { paths } from '../../routes/paths.js';

/**
 * The frame, tested through the whole App rather than in isolation.
 *
 * What it has to get right is a relationship between three things — the route, the
 * onboarding state and the chrome — and a test that renders AppLayout alone with
 * hand-made props would prove none of it.
 */

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const renderAt = async (route, state = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace({
      'GET /api/v1/workspace/state': success({ ...WORKSPACE_STATE, ...state }),
    }),
  });
  const utils = await renderWithProviders(<App />, { route });
  await screen.findByRole('heading', { level: 1 });
  return { ...utils, ...mock };
};

const sections = () => screen.getByRole('navigation', { name: /sections/i });

describe('the frame around the signed-in app', () => {
  it('offers every section the app has, from one place', async () => {
    await renderAt(paths.app);

    const links = within(sections()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Your week', 'This week', 'Your rate']);
    expect(links[0]).toHaveAttribute('href', paths.app);
    expect(links[1]).toHaveAttribute('href', paths.audit);
    expect(links[2]).toHaveAttribute('href', paths.rate);
  });

  it('says which section you are in, out loud and not only in colour', async () => {
    await renderAt(paths.audit);

    const here = within(sections()).getByRole('link', { name: 'This week' });
    // aria-current is the part a screen reader gets; the class carries the weight
    // and the rule for everyone else.
    expect(here).toHaveAttribute('aria-current', 'page');
    expect(here).toHaveClass('is-current');

    expect(within(sections()).getByRole('link', { name: 'Your week' })).not.toHaveAttribute('aria-current');
  });

  it('does not light up every section just because the URL starts the same way', async () => {
    await renderAt(paths.audit);

    // "/app" is a prefix of "/app/audit", so without an exact match the dashboard
    // link would claim to be current on every page in the app.
    expect(within(sections()).getByRole('link', { name: 'Your week' })).not.toHaveClass('is-current');
  });

  it('holds the account controls, so no page has to carry its own bar', async () => {
    await renderAt(paths.app);

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^theme:/i })).toBeInTheDocument();
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
  });

  it('shows the wordmark once, not once per page', async () => {
    const { container } = await renderAt(paths.app);

    expect(container.querySelectorAll('.logo')).toHaveLength(1);
  });

  /**
   * The frame wrapped the outlet in its own .page-width once, which nested one
   * gutter inside another: the max-width and the side padding both applied twice,
   * and the funnel sat in a column half the width it was designed for. Every test
   * passed and the page rendered; it took a screenshot to see.
   */
  it('never puts one gutter inside another', async () => {
    const { container } = await renderAt(paths.app);

    for (const el of container.querySelectorAll('.page-width')) {
      expect(el.querySelector('.page-width'), 'a .page-width inside a .page-width').toBeNull();
    }
  });

  it('leaves exactly one main landmark, which the frame must not add to', async () => {
    const { container } = await renderAt(paths.app);

    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe('main');
  });
});

describe('the first run does not get the frame', () => {
  /**
   * A sidebar offering three destinations in the middle of a three-step setup
   * invites people to wander out of it, and there is nothing worth visiting until
   * the setup is done. So the funnel stays bare.
   */
  it('is bare on the rate screen of a brand new account', async () => {
    await renderAt(paths.rate, { needsRate: true, needsFirstAudit: true, completedAudits: 0 });

    expect(screen.queryByRole('navigation', { name: /sections/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /what is an hour of your time worth/i })).toBeInTheDocument();
  });

  it('is bare on the first audit', async () => {
    await renderAt(paths.audit, { needsRate: false, needsFirstAudit: true, completedAudits: 0 });

    expect(screen.queryByRole('navigation', { name: /sections/i })).not.toBeInTheDocument();
  });

  it('is bare on the first sort', async () => {
    await renderAt(paths.sort, {
      needsRate: false, needsFirstAudit: false, completedAudits: 1,
      needsFirstSort: true, unsortedCount: 2,
    });

    expect(screen.queryByRole('navigation', { name: /sections/i })).not.toBeInTheDocument();
  });

  it('still shows the wordmark while bare, so the funnel is not a blank page', async () => {
    const { container } = await renderAt(paths.rate, { needsRate: true, needsFirstAudit: true, completedAudits: 0 });

    expect(container.querySelectorAll('.logo')).toHaveLength(1);
  });

  it('gives the bare funnel one gutter, not two', async () => {
    const { container } = await renderAt(paths.rate, { needsRate: true, needsFirstAudit: true, completedAudits: 0 });

    for (const el of container.querySelectorAll('.page-width')) {
      expect(el.querySelector('.page-width'), 'a .page-width inside a .page-width').toBeNull();
    }
  });

  it('puts the frame up the moment onboarding is behind them', async () => {
    await renderAt(paths.audit, { needsRate: false, needsFirstAudit: false, completedAudits: 1 });

    expect(sections()).toBeInTheDocument();
  });
});
