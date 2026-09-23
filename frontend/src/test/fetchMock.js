import { vi } from 'vitest';

/**
 * A stand-in for the API that answers in the real envelope.
 *
 * Handlers are keyed "METHOD /path". Anything unhandled throws with the route
 * name, which is a better failure than a test quietly getting `undefined`.
 */
export function mockApi(handlers = {}) {
  const calls = [];

  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined, init });

    const handler = handlers[key];
    if (!handler) throw new Error(`No mock for ${key}`);

    const { status = 200, body } = typeof handler === 'function' ? await handler() : handler;

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
      json: async () => body,
    };
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const success = (data, status = 200) => ({ status, body: { success: true, data } });

export const failure = (status, code, message, details) => ({
  status,
  body: { success: false, error: { code, message, details } },
});

/** The boot call AuthProvider makes. Signed out unless a test says otherwise. */
export const bootSignedOut = { 'POST /api/v1/auth/refresh': failure(401, 'UNAUTHENTICATED', 'No refresh token supplied') };
