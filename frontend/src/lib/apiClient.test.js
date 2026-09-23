import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, request, ApiError } from './apiClient.js';
import { endpoints } from './api/endpoints.js';
import { setAccessToken, getAccessToken, clearAccessToken } from './tokenStore.js';
import { mockApi, success, failure } from '../test/fetchMock.js';

const ME = endpoints.auth.me();
const REFRESH = endpoints.auth.refresh();

beforeEach(() => clearAccessToken());

describe('the envelope', () => {
  it('unwraps data and hands back only that', async () => {
    mockApi({ [`GET ${ME}`]: success({ user: { id: 'u1', name: 'Urooj' } }) });

    await expect(api.get(ME)).resolves.toEqual({ user: { id: 'u1', name: 'Urooj' } });
  });

  it('returns null for a 204 rather than trying to parse it', async () => {
    mockApi({ [`POST ${endpoints.auth.logout()}`]: { status: 204 } });

    await expect(api.post(endpoints.auth.logout())).resolves.toBeNull();
  });

  it('turns a failure envelope into an ApiError carrying the code', async () => {
    mockApi({
      [`POST ${endpoints.auth.login()}`]: failure(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect'),
    });

    const err = await api.post(endpoints.auth.login(), {}, { auth: false }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  it('survives a response that is not JSON at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => '<html>Bad Gateway</html>',
    })));

    const err = await api.get(ME).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe('INTERNAL');
  });

  it('reports an unreachable server as a network error, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const err = await api.get(ME).catch((e) => e);
    expect(err.code).toBe('NETWORK');
    expect(err.userMessage).toMatch(/port 5000/);
  });

  it('lets an abort through untouched, because a cancelled request is not a failure', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort; }));

    await expect(api.get(ME)).rejects.toBe(abort);
  });
});

describe('ApiError.fieldErrors', () => {
  it('strips the "body." prefix so the keys match the form field names', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields need attention',
      details: [
        { field: 'body.password', message: 'Use at least 12 characters' },
        { field: 'body.email', message: 'Enter a valid email address' },
      ],
    });

    expect(err.fieldErrors).toEqual({
      password: 'Use at least 12 characters',
      email: 'Enter a valid email address',
    });
  });

  it('keeps the first message per field rather than the last', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      details: [
        { field: 'body.password', message: 'first' },
        { field: 'body.password', message: 'second' },
      ],
    });

    expect(err.fieldErrors.password).toBe('first');
  });

  it('prefers our wording over the server message when we have one', () => {
    const err = new ApiError({ status: 401, code: 'ACCOUNT_LOCKED', message: 'Try again in 15 minutes.' });
    expect(err.userMessage).toMatch(/locked for a few minutes/);
  });
});

describe('the bearer token', () => {
  it('is attached when there is one', async () => {
    setAccessToken('token-abc');
    const { calls } = mockApi({ [`GET ${ME}`]: success({ user: {} }) });

    await api.get(ME);

    expect(calls[0].init.headers.Authorization).toBe('Bearer token-abc');
  });

  it('is left off when the caller says the route is public', async () => {
    setAccessToken('token-abc');
    const { calls } = mockApi({ [`POST ${endpoints.auth.login()}`]: success({}) });

    await api.post(endpoints.auth.login(), {}, { auth: false });

    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('sends the cookie, which is how refresh works at all', async () => {
    const { calls } = mockApi({ [`GET ${ME}`]: success({ user: {} }) });

    await api.get(ME);

    expect(calls[0].init.credentials).toBe('same-origin');
  });
});

describe('refreshing an expired access token', () => {
  it('refreshes once and replays the original request', async () => {
    setAccessToken('expired-token');
    let meCalls = 0;

    const { calls } = mockApi({
      [`GET ${ME}`]: () => {
        meCalls += 1;
        return meCalls === 1
          ? failure(401, 'TOKEN_EXPIRED', 'Access token expired')
          : success({ user: { id: 'u1' } });
      },
      [`POST ${REFRESH}`]: success({ accessToken: 'fresh-token', user: { id: 'u1' } }),
    });

    await expect(api.get(ME)).resolves.toEqual({ user: { id: 'u1' } });

    expect(getAccessToken()).toBe('fresh-token');
    expect(calls.filter((c) => c.key === `POST ${REFRESH}`)).toHaveLength(1);
    // The replay carries the new token, not the expired one.
    expect(calls.at(-1).init.headers.Authorization).toBe('Bearer fresh-token');
  });

  it('gives up after one attempt instead of looping', async () => {
    setAccessToken('expired-token');

    const { calls } = mockApi({
      [`GET ${ME}`]: failure(401, 'TOKEN_EXPIRED', 'Access token expired'),
      [`POST ${REFRESH}`]: success({ accessToken: 'fresh-token', user: { id: 'u1' } }),
    });

    await expect(api.get(ME)).rejects.toBeInstanceOf(ApiError);
    expect(calls.filter((c) => c.key === `GET ${ME}`)).toHaveLength(2);
  });

  it('clears the token and rethrows when the refresh itself fails', async () => {
    setAccessToken('expired-token');

    mockApi({
      [`GET ${ME}`]: failure(401, 'TOKEN_EXPIRED', 'Access token expired'),
      [`POST ${REFRESH}`]: failure(401, 'UNAUTHENTICATED', 'Session not recognised'),
    });

    await expect(api.get(ME)).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it('does not refresh on a 401 that is not an expiry', async () => {
    setAccessToken('some-token');
    const { calls } = mockApi({ [`GET ${ME}`]: failure(401, 'UNAUTHENTICATED', 'Authentication required') });

    await expect(api.get(ME)).rejects.toBeInstanceOf(ApiError);
    expect(calls.some((c) => c.key === `POST ${REFRESH}`)).toBe(false);
  });

  /**
   * The one that matters.
   *
   * Refresh rotates server-side and a consumed token counts as reuse, which revokes
   * the whole family. Three requests expiring together must therefore share one
   * refresh — three would make the app sign itself out for being parallel.
   */
  it('shares a single refresh between requests that expire together', async () => {
    setAccessToken('expired-token');
    const seen = { [ME]: 0 };

    const { calls } = mockApi({
      [`GET ${ME}`]: () => {
        seen[ME] += 1;
        return seen[ME] <= 3
          ? failure(401, 'TOKEN_EXPIRED', 'Access token expired')
          : success({ user: { id: 'u1' } });
      },
      [`POST ${REFRESH}`]: success({ accessToken: 'fresh-token', user: { id: 'u1' } }),
    });

    await Promise.all([request(ME), request(ME), request(ME)]);

    expect(calls.filter((c) => c.key === `POST ${REFRESH}`)).toHaveLength(1);
  });
});
