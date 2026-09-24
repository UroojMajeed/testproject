import request from 'supertest';
import { createApp } from '../src/app.js';
import { REFRESH_COOKIE } from '../src/utils/token.js';

export const app = createApp();
export const api = () => request(app);
export const BASE = '/api/v1';

export const validUser = (over = {}) => ({
  name: 'Urooj Majeed',
  email: 'founder@example.com',
  password: 'correct-horse-battery-staple',
  ...over,
});

/** Pulls the refresh cookie value out of a Set-Cookie header. */
export function refreshCookieFrom(res) {
  const raw = res.headers['set-cookie'] ?? [];
  const found = raw.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  return found ? found.split(';')[0] : null;
}

export async function registerUser(over = {}) {
  const body = validUser(over);
  const res = await api().post(`${BASE}/auth/register`).send(body);
  return { res, body, accessToken: res.body?.data?.accessToken, cookie: refreshCookieFrom(res) };
}

/**
 * A signed-in caller with a workspace, which registration creates.
 *
 * `auth()` returns the header rather than the token so call sites read as what
 * they are doing — `.set(...session.auth())` — instead of rebuilding the Bearer
 * string a hundred times.
 */
export async function signedInUser(over = {}) {
  const { res, body, accessToken, cookie } = await registerUser(over);
  return {
    res,
    body,
    accessToken,
    cookie,
    auth: () => ({ Authorization: `Bearer ${accessToken}` }),
  };
}

/** Money as integer minor units, the only way it is ever handled. */
export const RATE_INPUT = Object.freeze({
  annualIncomeMinor: 12_000_000, // $120,000
  hoursPerWeek: 40,
  weeksPerYear: 50,
});

/** $120,000 over 2,000 hours is $60/hour; a quarter of that is the $15 buyback rate. */
export const EXPECTED_RATE_MINOR = 1_500;
