import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearAccessToken } from '../lib/tokenStore.js';
import { resetRefreshState } from '../lib/apiClient.js';

afterEach(() => {
  cleanup();
  clearAccessToken();
  // Both of these are module state, and both would otherwise leak into the next
  // test — a pending single-flight refresh is especially unpleasant, because the
  // next test inherits a promise that never settles and simply hangs.
  resetRefreshState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
