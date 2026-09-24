import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT, EXPECTED_RATE_MINOR } from '../helpers.js';
import { Workspace, BuybackRate } from '../../src/models/index.js';

/**
 * Step 2 over HTTP: the workspace, the rate, the activities, the weekly audit and
 * the figures that come out of them.
 *
 * The tenancy tests matter most. A cross-tenant read is the worst bug this product
 * could have and the quietest — nothing crashes, the wrong person's week simply
 * appears — so it is checked at the route, not trusted to the plugin.
 */

const WS = `${BASE}/workspace`;

const setRate = (session, over = {}) =>
  api().put(`${WS}/rate`).set(session.auth()).send({ ...RATE_INPUT, ...over });

const currentWeek = (session) => api().get(`${WS}/audits/current`).set(session.auth());

const saveWeek = (session, weekStarting, body) =>
  api().put(`${WS}/audits/${weekStarting}`).set(session.auth()).send(body);

/** Registers, sets a rate, and files one complete week. The normal starting state. */
async function withFiledWeek(entries, over = {}) {
  const session = await signedInUser(over);
  await setRate(session);

  const { body } = await currentWeek(session);
  const weekStarting = body.data.week.weekStarting;
  const res = await saveWeek(session, weekStarting, { entries, status: 'complete' });

  return { session, weekStarting, res };
}

describe('the workspace', () => {
  it('is created with the account, not on first use', async () => {
    const session = await signedInUser();

    // Lazy creation means every request downstream has to cope with there not
    // being one, and eventually one of them forgets.
    const res = await api().get(WS).set(session.auth());

    expect(res.status).toBe(200);
    expect(res.body.data.workspace.id).toBeTruthy();
    expect(await Workspace.countDocuments({})).toBe(1);
  });

  it('takes the timezone from the account, because weeks are cut in it', async () => {
    const session = await signedInUser({ timezone: 'Asia/Karachi' });
    const res = await api().get(WS).set(session.auth());

    expect(res.body.data.workspace.timezone).toBe('Asia/Karachi');
    expect(res.body.data.workspace.auditDay).toBe('friday');
  });

  it('needs authentication', async () => {
    expect((await api().get(WS)).status).toBe(401);
  });

  it('still answers 404 for a path that does not exist', async () => {
    // The workspace router carries a blanket auth guard. Mounted at the root it
    // would answer every unmatched path with 401 and the 404 handler would never
    // run, which is how this was wrong the first time.
    const res = await api().get(`${BASE}/nonsense`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('the state endpoint', () => {
  it('sends a new account to the rate first', async () => {
    const session = await signedInUser();
    const res = await api().get(`${WS}/state`).set(session.auth());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ needsRate: true, needsFirstAudit: true, completedAudits: 0 });
    expect(res.body.data.weekStarting).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sends them to the audit once the rate is set', async () => {
    const session = await signedInUser();
    await setRate(session);

    const res = await api().get(`${WS}/state`).set(session.auth());
    expect(res.body.data).toMatchObject({ needsRate: false, needsFirstAudit: true });
  });

  it('opens the dashboard once a week is filed', async () => {
    const { session } = await withFiledWeek([
      { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
    ]);

    const res = await api().get(`${WS}/state`).set(session.auth());
    expect(res.body.data).toMatchObject({
      needsRate: false, needsFirstAudit: false, currentWeekFiled: true, completedAudits: 1,
    });
  });
});

describe('the buyback rate', () => {
  it('computes the rate from income and hours', async () => {
    const session = await signedInUser();
    const res = await setRate(session);

    expect(res.status).toBe(201);
    expect(res.body.data.rate.rateMinorPerHour).toBe(EXPECTED_RATE_MINOR);
  });

  it('returns the inputs alongside the result, so the working can be shown', async () => {
    const session = await signedInUser();
    const res = await setRate(session);

    // A bare number invites argument and cannot be re-checked. This is a planning
    // estimate people are asked to act on, not a fact handed down.
    expect(res.body.data.rate).toMatchObject({
      annualIncomeMinor: RATE_INPUT.annualIncomeMinor,
      hoursPerWeek: RATE_INPUT.hoursPerWeek,
      weeksPerYear: RATE_INPUT.weeksPerYear,
    });
    expect(res.body.data.rate.formulaVersion).toBeGreaterThanOrEqual(1);
  });

  it('appends a record rather than editing one, so history survives', async () => {
    const session = await signedInUser();
    await setRate(session);
    await setRate(session, { annualIncomeMinor: 24_000_000 });

    // If March's income change rewrote the rate, every figure June was shown would
    // silently become a different number.
    expect(await BuybackRate.countDocuments({}).setOptions({ allTenants: true })).toBe(2);

    const current = await api().get(`${WS}/rate`).set(session.auth());
    expect(current.body.data.rate.rateMinorPerHour).toBe(EXPECTED_RATE_MINOR * 2);

    const history = await api().get(`${WS}/rate/history`).set(session.auth());
    expect(history.body.data.rates).toHaveLength(2);
  });

  it('has no rate before one is set', async () => {
    const session = await signedInUser();
    const res = await api().get(`${WS}/rate`).set(session.auth());

    expect(res.status).toBe(200);
    expect(res.body.data.rate).toBeNull();
  });

  it.each([
    ['a fractional amount', { annualIncomeMinor: 1200.5 }],
    ['a negative income', { annualIncomeMinor: -1 }],
    ['no hours', { hoursPerWeek: 0 }],
    ['more hours than a week holds', { hoursPerWeek: 200 }],
    ['more weeks than a year holds', { weeksPerYear: 60 }],
  ])('rejects %s with 422', async (_label, over) => {
    const session = await signedInUser();
    const res = await setRate(session, over);

    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});
