import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT } from '../helpers.js';
import { Activity, AuditWeek } from '../../src/models/index.js';

const WS = `${BASE}/workspace`;

/**
 * Step 3 over HTTP: answering the value question, and the matrix that falls out.
 */

async function withWeek(entries) {
  const session = await signedInUser();
  await api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);

  const { body } = await api().get(`${WS}/audits/current`).set(session.auth());
  const weekStarting = body.data.week.weekStarting;
  await api().put(`${WS}/audits/${weekStarting}`).set(session.auth())
    .send({ entries, status: 'complete' });

  return { session, weekStarting };
}

const activityNamed = (list, name) => list.find((row) => row.name === name);

const setValue = (session, id, value) =>
  api().put(`${WS}/activities/${id}/value`).set(session.auth()).send({ value });

async function idsByName(session) {
  const { body } = await api().get(`${WS}/activities`).set(session.auth());
  return Object.fromEntries(body.data.activities.map((row) => [row.name, row.id]));
}

describe('the value question', () => {
  it('starts unanswered, and says so rather than guessing', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    const res = await api().get(`${WS}/activities`).set(session.auth());

    // null is not "low". An activity nobody has been asked about must not be
    // filed under Delegate and recommended for handing off.
    expect(res.body.data.activities[0].value).toBeNull();
    expect(res.body.data.activities[0].valueSetAt).toBeNull();
  });

  it('lists what still needs answering', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Sales calls', estimatedMinutes: 300, energy: 2 },
    ]);

    const res = await api().get(`${WS}/activities/unsorted`).set(session.auth());
    expect(res.body.data.activities).toHaveLength(2);

    const ids = await idsByName(session);
    await setValue(session, ids.Invoicing, 'low');

    const after = await api().get(`${WS}/activities/unsorted`).set(session.auth());
    expect(after.body.data.activities).toHaveLength(1);
    expect(after.body.data.activities[0].name).toBe('Sales calls');
  });

  it('does not ask about something that has been archived', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);
    const ids = await idsByName(session);

    await api().delete(`${WS}/activities/${ids.Invoicing}`).set(session.auth());

    // Two minutes is all anybody will give this; none of it should go on work
    // they have already stopped doing.
    const res = await api().get(`${WS}/activities/unsorted`).set(session.auth());
    expect(res.body.data.activities).toHaveLength(0);
  });

  it('records when it was answered', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);
    const ids = await idsByName(session);

    const res = await setValue(session, ids.Invoicing, 'critical');

    expect(res.status).toBe(200);
    expect(res.body.data.activity.value).toBe('critical');
    expect(res.body.data.activity.valueSetAt).toBeTruthy();
  });

  it.each([['made-up'], [''], ['LOW']])('refuses %s as an answer', async (value) => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);
    const ids = await idsByName(session);

    // An unrecognised value would decide a quadrant, and the quadrant decides
    // whether somebody hires a person.
    expect((await setValue(session, ids.Invoicing, value)).status).toBe(422);
  });

  it('will not let one workspace answer for another', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);
    const ids = await idsByName(session);

    const theirs = await signedInUser({ email: 'someone@example.com', name: 'Someone Else' });
    expect((await setValue(theirs, ids.Invoicing, 'critical')).status).toBe(404);
  });
});

describe('the matrix', () => {
  const dashboard = (session) => api().get(`${WS}/dashboard`).set(session.auth());

  it('puts the same draining activity in a different quadrant depending on its value', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Client work', estimatedMinutes: 600, energy: -2 },
    ]);
    const ids = await idsByName(session);

    await setValue(session, ids.Invoicing, 'low');
    await setValue(session, ids['Client work'], 'critical');

    const { body } = await dashboard(session);

    // The distinction the whole step exists for. Identical energy; opposite advice.
    expect(activityNamed(body.data.activities, 'Invoicing').quadrant).toBe('delegate');
    expect(activityNamed(body.data.activities, 'Client work').quadrant).toBe('replace');
  });

  it('fills the other two quadrants from energy', async () => {
    const { session } = await withWeek([
      { activityName: 'Tinkering', estimatedMinutes: 120, energy: 2 },
      { activityName: 'Sales calls', estimatedMinutes: 300, energy: 2 },
    ]);
    const ids = await idsByName(session);

    await setValue(session, ids.Tinkering, 'low');
    await setValue(session, ids['Sales calls'], 'critical');

    const { body } = await dashboard(session);
    expect(activityNamed(body.data.activities, 'Tinkering').quadrant).toBe('invest');
    expect(activityNamed(body.data.activities, 'Sales calls').quadrant).toBe('produce');
  });

  it('leaves an unsorted activity out of every quadrant and says how many', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Email', estimatedMinutes: 180, energy: -1 },
    ]);
    const ids = await idsByName(session);
    await setValue(session, ids.Invoicing, 'low');

    const { body } = await dashboard(session);

    expect(body.data.unsortedCount).toBe(1);
    expect(activityNamed(body.data.activities, 'Email').quadrant).toBeNull();
    expect(body.data.matrix.delegate.count).toBe(1);
  });

  it('totals each quadrant, which is what makes it a decision', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Bookkeeping', estimatedMinutes: 180, energy: -1 },
      { activityName: 'Expenses', estimatedMinutes: 60, energy: -1 },
    ]);
    const ids = await idsByName(session);
    for (const name of ['Invoicing', 'Bookkeeping', 'Expenses']) await setValue(session, ids[name], 'low');

    const { body } = await dashboard(session);

    // 8 hours at the $15 buyback rate is $120 a week, $6,000 over 50 weeks — the
    // number a person's cost gets compared against.
    expect(body.data.matrix.delegate.count).toBe(3);
    expect(body.data.matrix.delegate.estimatedMinutes).toBe(480);
    expect(body.data.matrix.delegate.estimatedWeeklyCostMinor).toBe(12_000);
    expect(body.data.matrix.delegate.estimatedAnnualCostMinor).toBe(600_000);
  });

  it('orders a quadrant by value first, then by cost', async () => {
    const { session } = await withWeek([
      { activityName: 'Long but merely important', estimatedMinutes: 600, energy: -1 },
      { activityName: 'Short but critical', estimatedMinutes: 60, energy: -1 },
    ]);
    const ids = await idsByName(session);
    await setValue(session, ids['Long but merely important'], 'important');
    await setValue(session, ids['Short but critical'], 'critical');

    const { body } = await dashboard(session);

    // The top of a Replace list should be what pays most and hurts most, not
    // simply what takes longest.
    expect(body.data.matrix.replace.activities[0].name).toBe('Short but critical');
  });

  it('averages energy across weeks rather than trusting the latest', async () => {
    const { session, weekStarting } = await withWeek([
      { activityName: 'Client work', estimatedMinutes: 300, energy: -2 },
    ]);
    const ids = await idsByName(session);
    await setValue(session, ids['Client work'], 'critical');

    // Push that week back and file a second one where it felt fine.
    const [y, m, d] = weekStarting.split('-').map(Number);
    const previous = new Date(Date.UTC(y, m - 1, d) - 7 * 86_400_000).toISOString().slice(0, 10);
    await AuditWeek.updateMany({}, { weekStarting: previous }).setOptions({ allTenants: true });

    await api().get(`${WS}/audits/current`).set(session.auth());
    await api().put(`${WS}/audits/${weekStarting}`).set(session.auth()).send({
      entries: [{ activityId: ids['Client work'], estimatedMinutes: 300, energy: 2 }],
      status: 'complete',
    });

    const { body } = await api().get(`${WS}/dashboard`).set(session.auth());
    const row = activityNamed(body.data.activities, 'Client work');

    // -2 then +2 averages to zero, which is not draining — so one bad week does
    // not by itself recommend replacing yourself.
    expect(row.averageEnergy).toBe(0);
    expect(row.quadrant).toBe('produce');
  });

  it('ignores an unusual week when deciding whether something drains you', async () => {
    const { session, weekStarting } = await withWeek([
      { activityName: 'Client work', estimatedMinutes: 300, energy: 2 },
    ]);
    const ids = await idsByName(session);
    await setValue(session, ids['Client work'], 'critical');

    const [y, m, d] = weekStarting.split('-').map(Number);
    const previous = new Date(Date.UTC(y, m - 1, d) - 7 * 86_400_000).toISOString().slice(0, 10);
    await AuditWeek.updateMany({}, { weekStarting: previous }).setOptions({ allTenants: true });

    await api().get(`${WS}/audits/current`).set(session.auth());
    await api().put(`${WS}/audits/${weekStarting}`).set(session.auth()).send({
      entries: [{ activityId: ids['Client work'], estimatedMinutes: 300, energy: -2 }],
      isTypical: false,
      status: 'complete',
    });

    const { body } = await api().get(`${WS}/dashboard`).set(session.auth());

    // The week everything caught fire should not decide that client work drains you.
    expect(activityNamed(body.data.activities, 'Client work').quadrant).toBe('produce');
  });
});

describe('the sort gate', () => {
  it('asks for the first sort once a week has been filed', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    const res = await api().get(`${WS}/state`).set(session.auth());
    expect(res.body.data).toMatchObject({ needsFirstSort: true, unsortedCount: 1 });
  });

  it('does not ask before there is anything to sort', async () => {
    const session = await signedInUser();
    await api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);

    const res = await api().get(`${WS}/state`).set(session.auth());
    expect(res.body.data.needsFirstSort).toBe(false);
  });

  it('stops gating for good once anything has been sorted', async () => {
    const { session } = await withWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);
    const ids = await idsByName(session);
    await setValue(session, ids.Invoicing, 'low');

    await Activity.create({ workspaceId: (await Activity.findOne({ name: 'Invoicing' })
      .setOptions({ allTenants: true })).workspaceId, name: 'Something new' });

    const res = await api().get(`${WS}/state`).set(session.auth());

    // A new activity next Friday is a prompt, not a wall in front of figures they
    // already have.
    expect(res.body.data.needsFirstSort).toBe(false);
    expect(res.body.data.unsortedCount).toBe(1);
  });
});
