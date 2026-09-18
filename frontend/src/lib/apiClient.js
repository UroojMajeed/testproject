import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore.js';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }

  /** Maps server field errors onto react-hook-form field names. */
  get fieldErrors() {
    return this.details.reduce((acc, d) => {
      if (d.field) acc[d.field.replace(/^body\./, '')] = d.message;
      return acc;
    }, {});
  }
}

let refreshPromise = null;
let onUnauthenticated = () => {};

export function setUnauthenticatedHandler(fn) {
  onUnauthenticated = fn;
}

/**
 * All concurrent 401s share one refresh call. Without this, five parallel
 * requests would fire five rotations — and because rotation is single-use with
 * reuse detection, four of them would look like a stolen token and burn the
 * whole family.
 */
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'UNAUTHENTICATED', 'Session expired');
        const body = await res.json();
        setAccessToken(body.data.accessToken);
        return body.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent something unreadable');
  }
}

async function send(path, { method = 'GET', body, workspaceId, signal, _retried } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    // same-origin: the dev server proxies /api, so the cookie is first-party in
    // development exactly as it is in production.
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401 && !_retried && !path.startsWith('/auth/refresh')) {
    try {
      await refreshSession();
      return await send(path, { method, body, workspaceId, signal, _retried: true });
    } catch {
      clearAccessToken();
      onUnauthenticated();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
    }
  }

  const payload = await parse(res);

  if (!res.ok) {
    const err = payload?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Something went wrong', err.details);
  }

  return payload?.data ?? null;
}

export const api = {
  get: (path, opts) => send(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => send(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => send(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => send(path, { ...opts, method: 'DELETE' }),
  refreshSession,
};
