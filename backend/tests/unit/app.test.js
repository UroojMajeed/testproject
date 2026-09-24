import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();
const api = () => request(app);

describe('app wiring', () => {
  it('serves health without a database', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', uptime: expect.any(Number) } });
  });

  it('reports not-ready when mongo is down', async () => {
    const res = await api().get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.data.database).toBe('unavailable');
  });

  it('returns unknown routes in the standard error envelope', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('security headers', () => {
  it('sets a content security policy', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  });

  it('does not advertise the framework', async () => {
    expect((await api().get('/api/v1/health')).headers['x-powered-by']).toBeUndefined();
  });

  it('sets nosniff and a referrer policy', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('cors', () => {
  it('allows the configured client origin with credentials', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('refuses an origin that is not on the allowlist', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request limits', () => {
  it('rejects a body over the size cap', async () => {
    const res = await api().post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'a@b.com', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it('rejects a cross-origin state change on an auth route', async () => {
    const res = await api().post('/api/v1/auth/logout').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });
});

describe('route registration', () => {
  it.each([
    ['post', '/api/v1/auth/register'],
    ['post', '/api/v1/auth/login'],
    ['post', '/api/v1/auth/refresh'],
    ['post', '/api/v1/auth/logout'],
    ['post', '/api/v1/auth/forgot-password'],
    ['post', '/api/v1/auth/reset-password'],
  ])('%s %s exists and is not a 404', async (method, path) => {
    const res = await api()[method](path).set('Origin', 'http://localhost:3000').send({});
    expect(res.status).not.toBe(404);
  });

  it.each([
    ['get', '/api/v1/auth/me'],
    ['post', '/api/v1/auth/logout-all'],
    ['post', '/api/v1/auth/change-password'],
  ])('%s %s requires authentication', async (method, path) => {
    const res = await api()[method](path).set('Origin', 'http://localhost:3000').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('rate limits match what each route is for', () => {
  /**
   * Refresh used to share the sign-in limiter, and that was a real bug: the access
   * token lives in memory, so every page load calls refresh once. At 20 in fifteen
   * minutes, somebody working normally locked themselves out of their own session.
   * It surfaced by driving the app repeatedly until it answered 429 to everything.
   */
  it('gives refresh room for a working afternoon, not a sign-in attempt', async () => {
    const { LIMITS } = await import('../../src/middleware/rateLimiter.js');

    // A page load, a second tab, a token expiring mid-session — all refreshes.
    expect(LIMITS.refresh).toBeGreaterThanOrEqual(120);
    expect(LIMITS.refresh).toBeGreaterThan(LIMITS.auth * 5);
  });

  it('keeps sign in tight, because that is the brute-force surface', async () => {
    const { LIMITS } = await import('../../src/middleware/rateLimiter.js');

    // Well under the 5 failures that lock an account, so the lockout is what a
    // guesser meets first rather than a limiter they can wait out.
    expect(LIMITS.auth).toBeLessThanOrEqual(30);
  });

  it('keeps password reset tightest of all, since it also sends email', async () => {
    const { LIMITS } = await import('../../src/middleware/rateLimiter.js');

    expect(LIMITS.sensitive).toBeLessThan(LIMITS.auth);
  });

  it('puts refresh on its own limiter, not the sign-in one', async () => {
    const { readFileSync } = await import('node:fs');
    const routes = readFileSync(new URL('../../src/modules/auth/auth.routes.js', import.meta.url), 'utf8');

    // Asserting on the wiring because the middleware skips in tests, so a swap
    // back to authLimiter would otherwise pass everything here in silence.
    expect(routes).toMatch(/post\('\/refresh',\s*refreshLimiter/);
    expect(routes).toMatch(/post\('\/login',\s*authLimiter/);
  });
});
