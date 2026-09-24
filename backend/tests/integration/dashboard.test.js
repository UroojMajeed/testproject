import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT, EXPECTED_RATE_MINOR } from '../helpers.js';
import { AuditWeek } from '../../src/models/index.js';

const WS = `${BASE}/workspace`;

const setRate = (session) => api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);
const dashboard = (session) => api().get(`${WS}/dashboard`).set(session.auth());

async function fileWeek(entries, over = {}) {
  const session = await signedInUser(over);
  await setRate(session);
  const { body } = await api().get(`${WS}/audits/current`).set(session.auth());
  const weekStarting = body.data.week.weekStarting;

  await api().put(`${WS}/audits/${weekStarting}`).set(session.auth())
    .send({ entries, status: 'complete' });

  return { session, weekStarting };
}

describe('what the week cost', () => {
  it('prices each activity at the buyback rate', async () => {
    // Four hours at the $15 buyback rate is $60 a week, and $3,000 over 50 weeks.
    const { session } = await fileWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    const res = await dashboard(session);

    expect(res.status).toBe(200);
    const [invoicing] = res.body.data.activities;
    expect(invoicing.name).toBe('Invoicing');
    expect(invoicing.estimatedWeeklyCostMinor).toBe(6_000);
    expect(invoicing.estimatedAnnualCostMinor).toBe(300_000);
  });

  it('totals the week', async () => {
    const { session } = await fileWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
      { activityName: 'Sales calls', estimatedMinutes: 360, energy: 2 },
    ]);

    const res = await dashboard(session);

    expect(res.body.data.totals.estimatedMinutes).toBe(600);
    expect(res.body.data.totals.estimatedWeeklyCostMinor).toBe(15_000); // 10h × $15
  });

  it('returns the rate that produced the figures', async () => {
    const { session } = await fileWeek([
      { activityName: 'Invoicing', estimatedMinutes: 60, energy: -1 },
    ]);

    // A figure quoted in June should still be explicable after the rate changes in
    // July, so the rate travels with the numbers rather than being looked up again.
    const res = await dashboard(session);
    expect(res.body.data.rate.rateMinorPerHour).toBe(EXPECTED_RATE_MINOR);
    expect(res.body.data.rate.weeksPerYear).toBe(RATE_INPUT.weeksPerYear);
  });

  it('names every figure as an estimate', async () => {
    const { session } = await fileWeek([
      { activityName: 'Invoicing', estimatedMinutes: 60, energy: -1 },
    ]);

    const res = await dashboard(session);
    const json = JSON.stringify(res.body);

    // Everything here is recall. When measured data arrives the two must be
    // impossible to confuse, and the time to make that so is before it exists.
    expect(json).toMatch(/estimatedWeeklyCostMinor/);
    expect(json).not.toMatch(/"verified/);
    expect(res.body.data.totals).not.toHaveProperty('minutes');
  });

  it('asks for a rate before it will price anything', async () => {
    const session = await signedInUser();
    const res = await dashboard(session);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/buyback rate/i);
  });

  it('is empty, not broken, before any week is filed', async () => {
    const session = await signedInUser();
    await setRate(session);

    const res = await dashboard(session);

    expect(res.status).toBe(200);
    expect(res.body.data.week).toBeNull();
    expect(res.body.data.activities).toEqual([]);
    expect(res.body.data.worst).toBeNull();
  });
});

describe('what to do about it', () => {
  it('picks the worst by cost weighted with how much it drains you', async () => {
    const { session } = await fileWeek([
      // Sales calls cost more, but they are energising — recommending somebody
      // delegate the work they most enjoy is how this product would lose trust.
      { activityName: 'Sales calls', estimatedMinutes: 600, energy: 2 },
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    const res = await dashboard(session);

    expect(res.body.data.worst.name).toBe('Invoicing');
  });

  it('never nominates something the owner enjoys', async () => {
    const { session } = await fileWeek([
      { activityName: 'Sales calls', estimatedMinutes: 600, energy: 2 },
      { activityName: 'Planning', estimatedMinutes: 120, energy: 1 },
    ]);

    // Nothing drains them, so there is nothing to hand off. Saying so is more
    // honest than nominating the biggest number on the page.
    expect((await dashboard(session)).body.data.worst).toBeNull();
  });

  it('prefers the more draining of two equally expensive activities', async () => {
    const { session } = await fileWeek([
      { activityName: 'Bookkeeping', estimatedMinutes: 240, energy: -1 },
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    expect((await dashboard(session)).body.data.worst.name).toBe('Invoicing');
  });

  it('ranks the list so the client does not have to', async () => {
    const { session } = await fileWeek([
      { activityName: 'Small thing', estimatedMinutes: 30, energy: -1 },
      { activityName: 'Big thing', estimatedMinutes: 600, energy: -1 },
      { activityName: 'Middle thing', estimatedMinutes: 180, energy: -1 },
    ]);

    const names = (await dashboard(session)).body.data.activities.map((a) => a.name);
    expect(names).toEqual(['Big thing', 'Middle thing', 'Small thing']);
  });
});

describe('an unusual week', () => {
  it('is not used as the headline when a normal one exists', async () => {
    const { session, weekStarting } = await fileWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    // Push the normal week back, then file a crisis week as the current one.
    const [y, m, d] = weekStarting.split('-').map(Number);
    const previous = new Date(Date.UTC(y, m - 1, d) - 7 * 86_400_000).toISOString().slice(0, 10);
    await AuditWeek.updateMany({}, { weekStarting: previous }).setOptions({ allTenants: true });

    await api().get(`${WS}/audits/current`).set(session.auth());
    await api().put(`${WS}/audits/${weekStarting}`).set(session.auth()).send({
      entries: [{ activityName: 'Firefighting', estimatedMinutes: 3000, energy: -2 }],
      isTypical: false,
      status: 'complete',
    });

    const res = await dashboard(session);

    // A baseline built from the week everything caught fire makes every later
    // comparison wrong, so a typical week keeps the headline.
    expect(res.body.data.week.weekStarting).toBe(previous);
    expect(res.body.data.week.isTypical).toBe(true);
    expect(res.body.data.weeksRecorded).toBe(2);
  });
});
