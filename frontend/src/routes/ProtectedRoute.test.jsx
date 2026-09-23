import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { mockApi, success, failure, bootSignedOut } from '../test/fetchMock.js';
import { endpoints } from '../lib/api/endpoints.js';
import { paths } from './paths.js';
import LoginPage from '../features/auth/pages/LoginPage.jsx';

const REFRESH = `POST ${endpoints.auth.refresh()}`;

const Tree = () => (
  <Routes>
    <Route element={<GuestRoute />}>
      <Route path={paths.login} element={<h1>Sign in</h1>} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route path={paths.home} element={<h1>Signed in area</h1>} />
      <Route path="/settings" element={<h1>Settings</h1>} />
    </Route>
  </Routes>
);

describe('the route guards', () => {
  it('sends a signed-out visitor to sign in', async () => {
    mockApi(bootSignedOut);
    await renderWithProviders(<Tree />, { route: paths.home });

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  /**
   * The bug this exists to prevent.
   *
   * The access token lives in memory, so a reload starts with nothing and the only
   * evidence of a session is the httpOnly cookie. Deciding before /auth/refresh has
   * answered flashes the sign-in form at somebody who is already signed in — which
   * is the most common way this pattern is got wrong.
   */
  it('restores a session from the refresh cookie rather than assuming signed out', async () => {
    mockApi({ [REFRESH]: success({ accessToken: 'fresh', user: { id: 'u1', name: 'Urooj' } }) });
    await renderWithProviders(<Tree />, { route: paths.home });

    expect(screen.getByRole('heading', { name: /signed in area/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('keeps a signed-in user off the sign-in screen', async () => {
    mockApi({ [REFRESH]: success({ accessToken: 'fresh', user: { id: 'u1', name: 'Urooj' } }) });
    await renderWithProviders(<Tree />, { route: paths.login });

    expect(screen.getByRole('heading', { name: /signed in area/i })).toBeInTheDocument();
  });

  it('says something while it is still deciding, instead of rendering nothing', async () => {
    // A refresh that never resolves: the tree must show a status, not a blank page.
    mockApi({ [REFRESH]: () => new Promise(() => {}) });
    await renderWithProviders(<Tree />, { route: paths.home });

    expect(screen.getByRole('status')).toHaveTextContent(/checking your session/i);
  });
});

describe('the round trip through sign in', () => {
  it('returns the user to the page they were aiming for', async () => {
    const user = userEvent.setup();
    let refreshes = 0;

    mockApi({
      [REFRESH]: () => {
        refreshes += 1;
        return failure(401, 'UNAUTHENTICATED', 'No refresh token supplied');
      },
      [`POST ${endpoints.auth.login()}`]: success({ accessToken: 'fresh', user: { id: 'u1', name: 'Urooj' } }),
    });

    await renderWithProviders(
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path={paths.login} element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path={paths.home} element={<h1>Home</h1>} />
          <Route path="/settings" element={<h1>Settings</h1>} />
        </Route>
      </Routes>,
      { route: '/settings' },
    );

    // Turned away, because the boot refresh found no session.
    expect(refreshes).toBe(1);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), 'founder@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    // Back to /settings, not to the home page. Dumping everyone on the dashboard
    // after sign in loses whatever link they followed to get here.
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });
});
