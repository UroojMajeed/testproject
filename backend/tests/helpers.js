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
