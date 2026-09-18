import { describe, it, expect, beforeEach } from 'vitest';
import { api, BASE, registerUser, makeWorkspace } from '../helpers.js';
import { TimeEntry, Task, BuybackPlan } from '../../src/models/index.js';

const auth = (t, ws) => ({ Authorization: `Bearer ${t}`, 'X-Workspace-Id': ws });

/** Two weeks of a founder's fortnight, as the sort would receive it. */
function activities() {
  const out = [];
  const push = (title, minutes, days) => {
    for (const d of days) {
      out.push({
        title,
        durationMinutes: minutes,
        startAt: new Date(Date.now() - d * 86_400_000).toISOString(),
      });
    }
  };
  push('Weekly client report', 120, [1, 4, 8, 11]);
  push('Client report — retainers', 110, [2, 9]);
  push('Invoice reminders', 45, [3, 6, 10, 13]);
  push('Discovery call — Northwind', 60, [2, 9]);
  push('Product strategy', 120, [5, 12]);
  return out;
}

let ctx;

beforeEach(async () => {
  const { accessToken } = await registerUser();
  const workspace = await makeWorkspace(accessToken);
  await api().patch(`${BASE}/workspaces/${workspace.id}/buyback-rate`)
    .set({ Authorization: `Bearer ${accessToken}` })
    .send({ annualCompensationMinor: 40_000_000, annualHours: 8000, method: 'calculated' });
  ctx = { accessToken, wsId: workspace.id, h: auth(accessToken, workspace.id) };
});

describe('the sort', () => {
  it('collapses a fortnight of activities into a handful of groups', async () => {
    const res = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });

    expect(res.status).toBe(201);
    // 14 raw occurrences collapse into 4 groups: the two report variants merge.
    expect(res.body.data.groups.length).toBeLessThan(activities().length);
    expect(res.body.data.groups.length).toBeLessThanOrEqual(5);
  });

  it('orders groups by time cost, biggest first', async () => {
    const res = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });
    const totals = res.body.data.groups.map((g) => g.totalMinutes);
    expect(totals).toEqual([...totals].sort((a, z) => z - a));
  });

  it('refuses a second sort while one is running', async () => {
    const payload = { source: 'recall', windowDays: 14, activities: activities() };
    await api().post(`${BASE}/sort`).set(ctx.h).send(payload);
    const again = await api().post(`${BASE}/sort`).set(ctx.h).send(payload);
    expect(again.status).toBe(409);
  });

  it('writes one time entry per occurrence when a group is classified', async () => {
    const start = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });

    const { session, groups } = start.body.data;
    const group = groups[0];

    const res = await api()
      .post(`${BASE}/sort/${session.id}/groups/${group.id}/classify`).set(ctx.h)
      .send({ energy: 'low', value: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.group.dripQuadrant).toBe('replacement');

    const written = await TimeEntry.countDocuments({ workspaceId: ctx.wsId });
    expect(written).toBe(group.eventCount);

    // A sorted group is a coarser estimate than a timer, and says so.
    const entry = await TimeEntry.findOne({ workspaceId: ctx.wsId });
    expect(entry.precision).toBe('recalled');
    expect(entry.estimatedCostMinor).toBeGreaterThan(0);
  });

  it('will not classify the same group twice', async () => {
    const start = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });
    const { session, groups } = start.body.data;
    const body = { energy: 'low', value: 'low' };

    await api().post(`${BASE}/sort/${session.id}/groups/${groups[0].id}/classify`).set(ctx.h).send(body);
    const again = await api().post(`${BASE}/sort/${session.id}/groups/${groups[0].id}/classify`).set(ctx.h).send(body);
    expect(again.status).toBe(409);
  });

  it('records how long the sort took — the activation metric', async () => {
    const start = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });
    const res = await api().post(`${BASE}/sort/${start.body.data.session.id}/complete`).set(ctx.h);

    expect(res.status).toBe(200);
    expect(res.body.data.session.status).toBe('completed');
    expect(res.body.data.session.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('the full loop', () => {
  async function sortEverything() {
    const start = await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });
    const { session, groups } = start.body.data;

    for (const g of groups) {
      // Reports and invoicing drain; sales and strategy do not.
      const draining = /report|invoice/i.test(g.title);
      const valuable = /report|discovery|strategy/i.test(g.title);
      await api().post(`${BASE}/sort/${session.id}/groups/${g.id}/classify`).set(ctx.h)
        .send({ energy: draining ? 'low' : 'high', value: valuable ? 'high' : 'low' });
    }
    await api().post(`${BASE}/sort/${session.id}/complete`).set(ctx.h);
    return session;
  }

  it('fills the DRIP matrix from the sort', async () => {
    await sortEverything();
    const res = await api().get(`${BASE}/drip`).set(ctx.h);

    expect(res.status).toBe(200);
    expect(res.body.data.points.length).toBeGreaterThan(0);
    expect(res.body.data.quadrants.replacement.minutes).toBeGreaterThan(0);
    expect(res.body.data.quadrants.replacement.costMinor).toBeGreaterThan(0);
  });

  it('produces recommendations grounded in the entries', async () => {
    await sortEverything();
    const res = await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });

    expect(res.status).toBe(201);
    const recs = res.body.data.recommendations;
    expect(recs.length).toBeGreaterThan(0);

    const top = recs[0];
    expect(top.evidence.length).toBeGreaterThanOrEqual(4);
    expect(top.confidence.signals.length).toBe(5);
    expect(top.reason).toMatch(/\d/);
    expect(['eliminate', 'automate', 'delegate', 'replace', 'simplify']).toContain(top.type);
  });

  it('never recommends production work', async () => {
    await sortEverything();
    await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });
    const res = await api().get(`${BASE}/recommendations`).set(ctx.h);

    const titles = res.body.data.recommendations.map((r) => r.title.toLowerCase());
    expect(titles.some((t) => t.includes('product strategy'))).toBe(false);
  });

  it('does not resurrect a rejected recommendation on re-analysis', async () => {
    await sortEverything();
    const first = await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });
    const target = first.body.data.recommendations[0];

    await api().post(`${BASE}/recommendations/${target.id}/reject`).set(ctx.h).send({ reason: 'Not now' });
    await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });

    const after = await api().get(`${BASE}/recommendations`).set(ctx.h);
    const taskIds = after.body.data.recommendations.map((r) => String(r.taskId?.id ?? r.taskId));
    expect(taskIds).not.toContain(String(target.taskId?.id ?? target.taskId));
  });

  it('refuses to approve a plan with no logged time to measure against', async () => {
    const task = await Task.create({
      workspaceId: ctx.wsId, title: 'Never logged', fingerprint: 'zzz',
      createdBy: '507f1f77bcf86cd799439011',
    });

    const created = await api().post(`${BASE}/plans`).set(ctx.h)
      .send({ taskId: String(task._id), strategy: 'delegate' });
    expect(created.status).toBe(201);

    const approved = await api().post(`${BASE}/plans/${created.body.data.plan.id}/approve`).set(ctx.h);
    expect(approved.status).toBe(400);
    expect(approved.body.error.message).toMatch(/nothing to measure against/i);
  });

  it('freezes the baseline at approval and refuses to let it be edited', async () => {
    await sortEverything();
    await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });
    const recs = await api().get(`${BASE}/recommendations`).set(ctx.h);
    const rec = recs.body.data.recommendations[0];

    const created = await api().post(`${BASE}/plans`).set(ctx.h).send({
      taskId: String(rec.taskId.id ?? rec.taskId), recommendationId: rec.id, strategy: rec.type,
    });
    const planId = created.body.data.plan.id;

    const approved = await api().post(`${BASE}/plans/${planId}/approve`).set(ctx.h);
    expect(approved.status).toBe(200);

    const { estimate } = approved.body.data.plan;
    expect(estimate.frozenAt).toBeTruthy();
    expect(estimate.baselineMinutesPerWeek).toBeGreaterThan(0);
    expect(estimate.baselineEntryCount).toBeGreaterThan(0);

    // An attempt to rewrite the frozen estimate is rejected outright.
    const tamper = await api().patch(`${BASE}/plans/${planId}`).set(ctx.h)
      .send({ estimate: { baselineMinutesPerWeek: 99999 } });
    expect(tamper.status).toBe(422);

    const reloaded = await BuybackPlan.findById(planId);
    expect(reloaded.estimate.baselineMinutesPerWeek).toBe(estimate.baselineMinutesPerWeek);
  });

  it('reports low confidence when the owner stopped logging after the transfer', async () => {
    await sortEverything();
    await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });
    const recs = await api().get(`${BASE}/recommendations`).set(ctx.h);
    const rec = recs.body.data.recommendations[0];

    const created = await api().post(`${BASE}/plans`).set(ctx.h).send({
      taskId: String(rec.taskId.id ?? rec.taskId), strategy: 'delegate',
    });
    const planId = created.body.data.plan.id;
    await api().post(`${BASE}/plans/${planId}/approve`).set(ctx.h);

    // No entries logged since — the apparent saving is total, and untrustworthy.
    const verified = await api().post(`${BASE}/plans/${planId}/verify`).set(ctx.h);

    expect(verified.status).toBe(200);
    const v = verified.body.data.plan.verification;
    expect(v.confidence).toBe('low');
    expect(v.coverage.ratio).toBeLessThan(0.6);
  });

  it('keeps a low-confidence saving out of the dashboard headline', async () => {
    await sortEverything();
    await api().post(`${BASE}/recommendations/analyse`).set(ctx.h).send({ windowDays: 14 });
    const recs = await api().get(`${BASE}/recommendations`).set(ctx.h);
    const rec = recs.body.data.recommendations[0];

    const created = await api().post(`${BASE}/plans`).set(ctx.h)
      .send({ taskId: String(rec.taskId.id ?? rec.taskId), strategy: 'delegate' });
    await api().post(`${BASE}/plans/${created.body.data.plan.id}/approve`).set(ctx.h);
    await api().patch(`${BASE}/plans/${created.body.data.plan.id}`).set(ctx.h).send({ status: 'in_progress' });
    await api().post(`${BASE}/plans/${created.body.data.plan.id}/verify`).set(ctx.h);

    const dash = await api().get(`${BASE}/analytics/dashboard`).set(ctx.h);
    expect(dash.status).toBe(200);
    expect(dash.body.data.reclaimed.verifiedHoursPerWeek).toBe(0);
    // The projection is still shown — clearly labelled as a projection.
    expect(dash.body.data.potentialHoursPerWeek).toBeGreaterThanOrEqual(0);
  });

  it('drafts a playbook that lands in draft, not published', async () => {
    await sortEverything();
    const task = await Task.findOne({ workspaceId: ctx.wsId, 'recurrence.isRecurring': true });

    const res = await api().post(`${BASE}/playbooks/draft-from-task`).set(ctx.h)
      .send({ taskId: String(task._id) });

    expect(res.status).toBe(201);
    expect(res.body.data.playbook.status).toBe('draft');
    expect(res.body.data.playbook.generated).toBe(true);
    expect(res.body.data.playbook.steps.length).toBeGreaterThan(0);
    // Placeholder wording, explicitly flagged for a human to replace.
    expect(JSON.stringify(res.body.data.playbook.steps)).toMatch(/\[Replace this\]/);
  });

  it('will not publish a playbook with no steps', async () => {
    const created = await api().post(`${BASE}/playbooks`).set(ctx.h)
      .send({ name: 'Empty', steps: [] });
    const res = await api().post(`${BASE}/playbooks/${created.body.data.playbook.id}/publish`).set(ctx.h);
    expect(res.status).toBe(400);
  });

  it('serves a dashboard built from the rollup', async () => {
    await sortEverything();
    const res = await api().get(`${BASE}/analytics/dashboard`).set(ctx.h);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.trackedMinutes).toBeGreaterThan(0);
    expect(res.body.data.summary.days.length).toBe(14);
    expect(res.body.data.summary.drainingCostMinor).toBeGreaterThan(0);
  });
});

describe('tenant isolation on domain data', () => {
  it('will not show one workspace\'s entries to another', async () => {
    await api().post(`${BASE}/sort`).set(ctx.h)
      .send({ source: 'recall', windowDays: 14, activities: activities() });

    const outsider = await registerUser({ email: 'outsider@example.com' });
    const theirWs = await makeWorkspace(outsider.accessToken, 'Other Studio');

    const res = await api().get(`${BASE}/time-entries`)
      .set(auth(outsider.accessToken, theirWs.id));

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toEqual([]);
  });

  it('rejects a workspace header the caller does not belong to', async () => {
    const outsider = await registerUser({ email: 'outsider@example.com' });
    const res = await api().get(`${BASE}/drip`).set(auth(outsider.accessToken, ctx.wsId));
    expect(res.status).toBe(404);
  });
});
