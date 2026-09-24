import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore.js';
import { endpoints } from './api/endpoints.js';
import { ERROR_CODES, ERROR_MESSAGES } from './constants.js';

/**
 * One way in and out of the API.
 *
 * Responsibilities, and deliberately no others:
 *   - attach the bearer token
 *   - unwrap the { success, data } envelope
 *   - turn { success: false, error } into a thrown ApiError with its details intact
 *   - refresh once, silently, when an access token has expired mid-session
 */

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }

  /** What to show the user: our wording where we have it, the server's otherwise. */
  get userMessage() {
    return ERROR_MESSAGES[this.code] ?? this.message;
  }

  /** 422 details, keyed by form field, ready to hand to react-hook-form. */
  get fieldErrors() {
    const out = {};
    for (const d of this.details) {
      // The server names fields as "body.password"; the form knows it as "password".
      const field = String(d.field ?? '').replace(/^(body|query|params)\./, '');
      if (field && !out[field]) out[field] = d.message;
    }
    return out;
  }
}

const networkError = () =>
  new ApiError({ status: 0, code: 'NETWORK', message: ERROR_MESSAGES.NETWORK });

/**
 * Refresh is single-flight.
 *
 * Without this, three requests expiring together would each POST /auth/refresh.
 * Rotation means the second and third would present a token the first had already
 * consumed, the server would read that as reuse, and it would revoke the whole
 * family — the app would sign itself out for being too parallel.
 */
let refreshInFlight = null;

function refreshSession() {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(endpoints.auth.refresh(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        // A refresh that never answers would leave the app on its loading screen
        // forever, because AuthContext waits for this before it decides anything.
        // Ten seconds, then treat it as no session.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const body = await res.json();
      const token = body?.data?.accessToken ?? null;
      if (token) setAccessToken(token);
      return body?.data ?? null;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

async function parse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page from a proxy, usually. Do not pretend it is our envelope.
    return { success: false, error: { code: ERROR_CODES.INTERNAL, message: 'Unreadable response from the server' } };
  }
}

async function send(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      // Same-origin in dev thanks to the Vite proxy, so the refresh cookie rides
      // along without any CORS credentials dance.
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw networkError();
  }

  const payload = await parse(res);

  if (res.ok) return payload?.data ?? null;

  throw new ApiError({
    status: res.status,
    code: payload?.error?.code ?? ERROR_CODES.INTERNAL,
    message: payload?.error?.message ?? `Request failed with ${res.status}`,
    details: payload?.error?.details,
  });
}

/**
 * The exported call. A 401 caused by an expired access token gets exactly one
 * refresh-and-retry; anything else is handed straight to the caller.
 */
export async function request(path, options = {}) {
  try {
    return await send(path, options);
  } catch (err) {
    const expired =
      err instanceof ApiError
      && err.status === 401
      && err.code === ERROR_CODES.TOKEN_EXPIRED
      && options.auth !== false
      && !options._retried;

    if (!expired) throw err;

    const session = await refreshSession();
    if (!session) {
      clearAccessToken();
      throw err;
    }
    return send(path, { ...options, _retried: true });
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/** Used by AuthContext on boot; exported so the retry path and boot path share it. */
export { refreshSession };

/**
 * A test seam, and the only one in this file.
 *
 * The single-flight promise is module state. A test that leaves a refresh pending
 * would hand that same unresolved promise to the next test, which would then wait
 * on it forever — a hang with no useful message. Nothing in the app calls this.
 */
export function resetRefreshState() {
  refreshInFlight = null;
}
