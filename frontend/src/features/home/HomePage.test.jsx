import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';
import { getAccessToken } from '../../lib/tokenStore.js';
import { formatDate } from '../../lib/formatters.js';

const USER = {
  id: 'u1',
  name: 'Urooj Majeed',
  email: 'founder@example.com',
  timezone: 'Asia/Karachi',
  emailVerified: false,
  createdAt: '2026-09-01T10:00:00.000Z',
};

const renderHome = async (handlers = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: success({ accessToken: 'fresh', user: USER }),
    ...handlers,
  });
  const utils = await renderWithProviders(<HomePage />, { route: '/' });
  return { ...utils, ...mock };
};

describe('the signed-in home page', () => {
  it('greets the user the session restored', async () => {
    await renderHome();

    expect(screen.getByRole('heading', { level: 1, name: /urooj majeed/i })).toBeInTheDocument();
    expect(screen.getByText(/founder@example\.com/)).toBeInTheDocument();
  });

  it('shows the account details the serializer actually returns', async () => {
    await renderHome();

    expect(screen.getByText(/asia\/karachi/i)).toBeInTheDocument();
    expect(screen.getByText(/not verified yet/i)).toBeInTheDocument();
    // Compared against the formatter rather than a literal: the exact wording is
    // the runner's locale talking, and formatDate has its own test.
    expect(screen.getByText(formatDate(USER.createdAt))).toBeInTheDocument();
  });

  it('signs out and drops the token from memory', async () => {
    const user = userEvent.setup();
    const { calls } = await renderHome({ [`POST ${endpoints.auth.logout()}`]: { status: 204 } });

    expect(getAccessToken()).toBe('fresh');

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(getAccessToken()).toBeNull());
    expect(calls.some((c) => c.key === `POST ${endpoints.auth.logout()}`)).toBe(true);
  });

  it('still signs the user out locally when the logout call fails', async () => {
    const user = userEvent.setup();
    // Otherwise a server hiccup leaves somebody looking at a signed-in page with a
    // token still in memory, which is the worst of both outcomes.
    await renderHome({ [`POST ${endpoints.auth.logout()}`]: () => { throw new TypeError('Failed to fetch'); } });

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(getAccessToken()).toBeNull());
  });
});

describe('getting back out', () => {
  it('offers a way back to the front page', async () => {
    await renderHome();

    // Without this the only route out of the signed-in area is the address bar,
    // which is not a route.
    expect(screen.getByRole('link', { name: /reclaimos/i })).toHaveAttribute('href', '/');
  });
});
