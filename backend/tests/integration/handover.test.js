import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT } from '../helpers.js';

const WS = `${BASE}/workspace`;

/**
 * Step 4 is the promise the dashboard has been making: it names the worst
 * activity, says what it costs, and then said "the next step of the build".
 */

/** A week with one draining, low-value activity and one energising, critical one. */
async function workspaceWithAWeek(entries = [
  { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
  { activityName: 'Sales calls', estimatedMinutes: 300, energy: 2 },
]) {
  const session = await signedInUser();
  await api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);

  const { body } = await api().get(`${WS}/audits/current`).set(session.auth());
  await api().put(`${WS}/audits/${body.data.week.weekStarting}`).set(session.auth())
    .send({ entries, status: 'complete' });

  const list = await api().get(`${WS}/activities`).set(session.auth());
  const byName = new Map(list.body.data.activities.map((a) => [a.name, a.id]));
  return { session, byName };
}

const answer = (session, id, value) =>
  api().put(`${WS}/activities/${id}/value`).set(session.auth()).send({ value });

const plan = (session) => api().get(`${WS}/handovers/plan`).set(session.auth());

describe('GET /workspace/handovers/plan', () => {
  it('proposes the draining activities and nothing else', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');       // drains, low → delegate
    await answer(session, byName.get('Sales calls'), 'critical'); // energises → produce

    const res = await plan(session);

    expect(res.status).toBe(200);
    // Handing over the work you enjoy and are good at is the mistake the whole
    // matrix exists to stop.
    expect(res.body.data.candidates.map((c) => c.name)).toEqual(['Invoicing']);
  });

  it('includes Replace as well as Delegate — both drain the owner', async () => {
    const { session, byName } = await workspaceWithAWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Client delivery', estimatedMinutes: 360, energy: -1 },
    ]);
    await answer(session, byName.get('Invoicing'), 'low');            // → delegate
    await answer(session, byName.get('Client delivery'), 'critical'); // → replace

    const res = await plan(session);

    const quadrants = res.body.data.candidates.map((c) => c.quadrant).sort();
    expect(quadrants).toEqual(['delegate', 'replace']);
  });

  it('says nothing is waiting when nothing has been sorted yet', async () => {
    const { session } = await workspaceWithAWeek();

    // No value answers, so no quadrants, so nothing can be proposed honestly.
    const res = await plan(session);

    expect(res.body.data.candidates).toEqual([]);
    expect(res.body.data.totals.count).toBe(0);
  });

  it('prices the lot, and names the rate that decides it', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    const res = await plan(session);

    // Four hours at the $15 buyback rate: $60 a week, $3,000 over 50 weeks.
    expect(res.body.data.totals.estimatedMinutes).toBe(240);
    expect(res.body.data.totals.estimatedWeeklyCostMinor).toBe(6_000);
    expect(res.body.data.totals.estimatedAnnualCostMinor).toBe(300_000);
    // The whole decision in one number: anyone cheaper than this is worth it.
    expect(res.body.data.breakEvenMinorPerHour).toBe(1_500);
  });

  it('agrees with the dashboard, because it is built from it', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    const [planned, dash] = await Promise.all([
      plan(session),
      api().get(`${WS}/dashboard`).set(session.auth()),
    ]);

    const fromDash = dash.body.data.matrix.delegate.estimatedAnnualCostMinor;
    expect(planned.body.data.totals.estimatedAnnualCostMinor).toBe(fromDash);
  });
});

describe('POST /workspace/handovers', () => {
  it('starts a checklist with every box unticked', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    const res = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    expect(res.status).toBe(201);
    const { handover } = res.body.data;
    expect(handover.status).toBe('planned');
    expect(handover.doneCount).toBe(0);
    expect(handover.stepCount).toBeGreaterThanOrEqual(6);
    expect(handover.steps.every((s) => !s.done)).toBe(true);
  });

  it('sends the wording with the steps rather than leaving it to the client', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    const res = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    // A second copy of these strings on the client would drift from this one.
    for (const step of res.body.data.handover.steps) {
      expect(step.title, step.key).toBeTruthy();
      expect(step.detail, step.key).toBeTruthy();
    }
  });

  it('stamps what it was costing when the decision was taken', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    const res = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    const { handover } = res.body.data;
    expect(handover.estimatedMinutesPerWeek).toBe(240);
    expect(handover.estimatedAnnualCostMinor).toBe(300_000);
    expect(handover.rateMinorPerHour).toBe(1_500);
  });

  it('keeps that figure even after the rate changes', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');
    const { body } = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    // Double the income, so the rate doubles.
    await api().put(`${WS}/rate`).set(session.auth())
      .send({ ...RATE_INPUT, annualIncomeMinor: RATE_INPUT.annualIncomeMinor * 2 });

    const after = await api().get(`${WS}/handovers`).set(session.auth());
    const [row] = after.body.data.handovers;

    // The number that justified the decision must not be rewritten by a later
    // one. A rate that changed in March cannot change what June was told.
    expect(row.rateMinorPerHour).toBe(body.data.handover.rateMinorPerHour);
    expect(row.estimatedAnnualCostMinor).toBe(300_000);
  });

  it('refuses a second handover for the same activity', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');
    const id = byName.get('Invoicing');

    await api().post(`${WS}/handovers`).set(session.auth()).send({ activityId: id });
    const second = await api().post(`${WS}/handovers`).set(session.auth()).send({ activityId: id });

    // Two checklists for one job and no answer to "is this handed over yet".
    expect(second.status).toBe(409);
  });

  it('will not price a handover for an activity with no recorded week', async () => {
    const { session } = await workspaceWithAWeek();
    const made = await api().post(`${WS}/activities`).set(session.auth()).send({ name: 'Something new' });

    const res = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: made.body.data.activity.id });

    // A handover priced at zero is worse than being told why it cannot be priced.
    expect(res.status).toBe(422);
  });

  it('takes it off the list of candidates once it is under way', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');

    await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    const res = await plan(session);
    const [invoicing] = res.body.data.candidates;
    expect(invoicing.handoverId).toBeTruthy();
    // It is in progress, not still waiting to be decided on.
    expect(res.body.data.totals.count).toBe(0);
  });
});

describe('working through the checklist', () => {
  async function started() {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');
    const { body } = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });
    return { session, id: body.data.handover.id, handover: body.data.handover };
  }

  const tick = (session, id, key, done = true) =>
    api().put(`${WS}/handovers/${id}/steps/${key}`).set(session.auth()).send({ done });

  it('ticks a box and remembers when', async () => {
    const { session, id } = await started();

    const res = await tick(session, id, 'record');

    expect(res.status).toBe(200);
    const step = res.body.data.handover.steps.find((s) => s.key === 'record');
    expect(step.done).toBe(true);
    expect(step.doneAt).toBeTruthy();
    expect(res.body.data.handover.doneCount).toBe(1);
  });

  it('unticks again, because people change their minds', async () => {
    const { session, id } = await started();
    await tick(session, id, 'record');

    const res = await tick(session, id, 'record', false);

    const step = res.body.data.handover.steps.find((s) => s.key === 'record');
    expect(step.done).toBe(false);
    expect(step.doneAt).toBeNull();
  });

  it('follows the boxes rather than being told a status', async () => {
    const { session, id, handover } = await started();
    expect(handover.status).toBe('planned');

    const one = await tick(session, id, 'record');
    expect(one.body.data.handover.status).toBe('in_progress');

    // A checklist that claims "in progress" with every box empty is one nobody
    // trusts, so the status is derived every time rather than set by hand.
    const back = await tick(session, id, 'record', false);
    expect(back.body.data.handover.status).toBe('planned');
  });

  it('is done when every box is ticked, and says when', async () => {
    const { session, id, handover } = await started();

    let res;
    for (const step of handover.steps) res = await tick(session, id, step.key);

    expect(res.body.data.handover.status).toBe('done');
    expect(res.body.data.handover.completedAt).toBeTruthy();
    expect(res.body.data.handover.doneCount).toBe(handover.stepCount);
  });

  it('refuses a step it does not have', async () => {
    const { session, id } = await started();

    const res = await tick(session, id, 'invent-a-step');

    // The keys are the contract; an unknown one is a client bug worth saying so.
    expect(res.status).toBe(422);
  });

  it('records who is taking it on', async () => {
    const { session, id } = await started();

    const res = await api().patch(`${WS}/handovers/${id}`).set(session.auth())
      .send({ assignee: 'Aisha', notes: 'Starts on the 6th' });

    expect(res.body.data.handover.assignee).toBe('Aisha');
    expect(res.body.data.handover.notes).toBe('Starts on the 6th');
  });

  it('can be called off', async () => {
    const { session, id } = await started();

    const res = await api().delete(`${WS}/handovers/${id}`).set(session.auth());
    expect(res.status).toBe(204);

    const after = await api().get(`${WS}/handovers`).set(session.auth());
    expect(after.body.data.handovers).toEqual([]);
  });
});

describe('another workspace', () => {
  it('cannot see or touch a handover that is not its own', async () => {
    const { session, byName } = await workspaceWithAWeek();
    await answer(session, byName.get('Invoicing'), 'low');
    const { body } = await api().post(`${WS}/handovers`).set(session.auth())
      .send({ activityId: byName.get('Invoicing') });

    // A distinct address: validUser() has a fixed one, and registering it twice
    // is a 409 with no token, which fails as a 401 and looks like a tenancy bug.
    const stranger = await signedInUser({ email: 'stranger@example.com' });

    const listed = await api().get(`${WS}/handovers`).set(stranger.auth());
    expect(listed.body.data.handovers).toEqual([]);

    const poked = await api().put(`${WS}/handovers/${body.data.handover.id}/steps/record`)
      .set(stranger.auth()).send({ done: true });
    expect(poked.status).toBe(404);
  });
});
