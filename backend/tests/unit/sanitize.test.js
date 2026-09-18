import { describe, it, expect } from 'vitest';
import { sanitize } from '../../src/middleware/sanitize.middleware.js';

const run = (req) => {
  let called = false;
  sanitize(req, {}, () => { called = true; });
  expect(called).toBe(true);
  return req;
};

describe('sanitize', () => {
  it('strips mongo operators from the body', () => {
    const req = run({ body: { email: { $ne: null }, password: 'x' } });
    expect(req.body.email).toEqual({});
    expect(req.body.password).toBe('x');
  });

  it('strips dotted keys that could reach into subdocuments', () => {
    const req = run({ body: { 'buybackRate.amountMinor': 999999, name: 'ok' } });
    expect(req.body['buybackRate.amountMinor']).toBeUndefined();
    expect(req.body.name).toBe('ok');
  });

  it('strips prototype pollution attempts', () => {
    const req = run({ body: JSON.parse('{"__proto__":{"admin":true},"name":"ok"}') });
    expect(req.body.name).toBe('ok');
    expect({}.admin).toBeUndefined();
  });

  it('recurses into nested objects and arrays', () => {
    const req = run({ body: { filters: [{ $where: 'evil' }, { ok: 1 }], nested: { deep: { $gt: 5 } } } });
    expect(req.body.filters[0]).toEqual({});
    expect(req.body.filters[1]).toEqual({ ok: 1 });
    expect(req.body.nested.deep).toEqual({});
  });

  it('leaves clean payloads exactly as they were', () => {
    const clean = { name: 'Meridian', tags: ['a', 'b'], nested: { n: 1 } };
    const req = run({ body: structuredClone(clean) });
    expect(req.body).toEqual(clean);
  });

  it('survives a missing body, params or query', () => {
    expect(() => run({})).not.toThrow();
  });

  it('does not recurse without bound', () => {
    let deep = { $bad: 1 };
    for (let i = 0; i < 200; i += 1) deep = { nested: deep };
    expect(() => run({ body: deep })).not.toThrow();
  });
});
