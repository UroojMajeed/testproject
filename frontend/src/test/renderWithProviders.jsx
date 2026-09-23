import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthProvider.jsx';
import { ROUTER_FUTURE } from '../routes/routerFuture.js';

/**
 * The provider stack every screen needs, without pulling in main.jsx.
 *
 * Async on purpose. AuthProvider posts to /auth/refresh on mount to find out
 * whether the httpOnly cookie represents a session, and that promise resolves
 * after render. Awaiting it here means tests start from a settled tree — otherwise
 * every one of them logs an act() warning and the first assertion races the boot.
 *
 * A fresh QueryClient per test, with retries off: a retrying query turns one
 * assertion into a three-second wait and a flaky suite.
 */
export async function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  let utils;
  await act(async () => {
    utils = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return utils;
}
