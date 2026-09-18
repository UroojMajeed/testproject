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
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets nosniff and a referrer policy', async () => {
    const res = await api().get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('cors', () => {
  it('allows the configured client origin with credentials', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('refuses an origin that is not on the allowlist', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request limits', () => {
  it('rejects a body over the size cap', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'a@b.com', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it('rejects a cross-origin state change on an auth route', async () => {
    const res = await api()
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });
});
