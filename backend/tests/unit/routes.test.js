import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();
const api = () => request(app);

/** Walks the Express stack and returns every registered path in order. */
function registeredPaths(router, prefix = '') {
  const out = [];
  for (const layer of router.stack ?? []) {
    if (layer.route) {
      out.push({ path: prefix + layer.route.path, methods: Object.keys(layer.route.methods) });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const src = layer.regexp?.source ?? '';
      const seg = src
        .replace('^\\/', '/').replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/').replace(/\$$/, '').replace(/\(\?:.*$/, '');
      out.push(...registeredPaths(layer.handle, prefix + (seg === '/' ? '' : seg)));
    }
  }
  return out;
}

describe('route registration', () => {
  const paths = registeredPaths(app._router).map((r) => r.path);

  it.each([
    '/api/v1/auth/login',
    '/api/v1/workspaces',
    '/api/v1/time-entries',
    '/api/v1/tasks',
    '/api/v1/sort',
    '/api/v1/drip',
    '/api/v1/recommendations',
    '/api/v1/plans',
    '/api/v1/playbooks',
    '/api/v1/analytics/dashboard',
  ])('registers %s', (p) => {
    expect(paths.some((x) => x.startsWith(p))).toBe(true);
  });

  it('registers the delegation queue BEFORE the task id route', () => {
    // '/:id' would otherwise match the literal segment "queue" and the
    // delegation board would be permanently unreachable.
    const queue = paths.findIndex((p) => p.includes('/queue/delegation'));
    const byId = paths.findIndex((p) => p === '/api/v1/tasks/:id');
    expect(queue).toBeGreaterThanOrEqual(0);
    expect(byId).toBeGreaterThanOrEqual(0);
    expect(queue).toBeLessThan(byId);
  });

  it('registers the time-entry summary before the entry id route', () => {
    const summary = paths.findIndex((p) => p.endsWith('/time-entries/summary'));
    const byId = paths.findIndex((p) => p === '/api/v1/time-entries/:id');
    expect(summary).toBeLessThan(byId === -1 ? Infinity : byId);
  });

  it('registers the active sort before the sort id route', () => {
    const active = paths.findIndex((p) => p.endsWith('/sort/active'));
    const byId = paths.findIndex((p) => p === '/api/v1/sort/:id');
    expect(active).toBeLessThan(byId === -1 ? Infinity : byId);
  });
});

describe('every domain route is behind authentication', () => {
  it.each([
    ['get', '/api/v1/time-entries'],
    ['post', '/api/v1/time-entries'],
    ['get', '/api/v1/tasks'],
    ['get', '/api/v1/tasks/queue/delegation'],
    ['post', '/api/v1/sort'],
    ['get', '/api/v1/sort/active'],
    ['get', '/api/v1/drip'],
    ['get', '/api/v1/recommendations'],
    ['post', '/api/v1/recommendations/analyse'],
    ['get', '/api/v1/plans'],
    ['get', '/api/v1/playbooks'],
    ['get', '/api/v1/analytics/dashboard'],
    ['get', '/api/v1/analytics/weekly-review'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await api()[method](path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
