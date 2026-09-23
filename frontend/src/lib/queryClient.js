import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient.js';

/**
 * Retrying a 401 or a 422 is pointless — the answer will not change — and
 * retrying a 409 on sign up would just re-post the form. Retry once, and only
 * for the failures that are actually transient.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (attempt, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return attempt < 1;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
