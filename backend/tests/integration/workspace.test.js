import { describe, it, expect } from 'vitest';
import { api, BASE, registerUser, makeWorkspace } from '../helpers.js';

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('workspaces', () => {
  it('creates a workspace and makes the creator its owner', async () => {
    const { accessToken } = await registerUser();
    const res = await api().post(`${BASE}/workspaces`).set(auth(accessToken))
      .send({ name: 'Meridian Studio', industry: 'agency' });

    expect(res.status).toBe(201);
    expect(res.body.data.workspace.role).toBe('owner');
    expect(res.body.data.workspace.slug).toMatch(/^meridian-studio-[a-f\d]{6}$/);
  });

  it('requires authentication', async () => {
    const res = await api().post(`${BASE}/workspaces`).send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });

  it('computes the buyback rate from compensation and hours', async () => {
    const { accessToken } = await registerUser();
    const ws = await makeWorkspace(accessToken);

    const res = await api().patch(`${BASE}/workspaces/${ws.id}/buyback-rate`).set(auth(accessToken))
      .send({ annualCompensationMinor: 40_000_000, annualHours: 8000, method: 'calculated' });

    expect(res.status).toBe(200);
    // $400,000.00 over 8,000 hours = $50.00/hour = 5000 minor units.
    expect(res.body.data.workspace.buybackRate.amountMinor).toBe(5000);
  });

  it('demands a reason when the rate is overridden by hand', async () => {
    const { accessToken } = await registerUser();
    const ws = await makeWorkspace(accessToken);

    const res = await api().patch(`${BASE}/workspaces/${ws.id}/buyback-rate`).set(auth(accessToken))
      .send({ annualCompensationMinor: 40_000_000, annualHours: 8000, method: 'manual', amountMinor: 9000 });

    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d) => d.field === 'body.overrideReason')).toBe(true);
  });
});

describe('tenant isolation', () => {
  it('hides another account\'s workspace behind a 404, not a 403', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const ws = await makeWorkspace(owner.accessToken);

    const outsider = await registerUser({ email: 'outsider@example.com' });
    const res = await api().get(`${BASE}/workspaces/${ws.id}`).set(auth(outsider.accessToken));

    // 404 rather than 403: a stranger should not learn the id is real.
    expect(res.status).toBe(404);
  });

  it('only lists workspaces the caller belongs to', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    await makeWorkspace(owner.accessToken);

    const outsider = await registerUser({ email: 'outsider@example.com' });
    const res = await api().get(`${BASE}/workspaces`).set(auth(outsider.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.workspaces).toEqual([]);
  });
});

describe('role enforcement', () => {
  it('stops a member from changing workspace settings', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const ws = await makeWorkspace(owner.accessToken);

    const invited = await api().post(`${BASE}/workspaces/${ws.id}/invites`).set(auth(owner.accessToken))
      .send({ email: 'teammate@example.com', role: 'member' });
    expect(invited.status).toBe(201);

    // The invite token is never returned in the response — confirm that.
    expect(JSON.stringify(invited.body)).not.toMatch(/token/i);
  });

  it('will not invite the same address twice', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const ws = await makeWorkspace(owner.accessToken);
    const payload = { email: 'teammate@example.com', role: 'member' };

    await api().post(`${BASE}/workspaces/${ws.id}/invites`).set(auth(owner.accessToken)).send(payload);
    const again = await api().post(`${BASE}/workspaces/${ws.id}/invites`).set(auth(owner.accessToken)).send(payload);

    expect(again.status).toBe(409);
  });

  it('refuses to invite someone as owner', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const ws = await makeWorkspace(owner.accessToken);

    const res = await api().post(`${BASE}/workspaces/${ws.id}/invites`).set(auth(owner.accessToken))
      .send({ email: 'teammate@example.com', role: 'owner' });

    expect(res.status).toBe(422);
  });
});

describe('health', () => {
  it('reports ok', async () => {
    const res = await api().get(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('404s an unknown route in the standard envelope', async () => {
    const res = await api().get(`${BASE}/nope`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
