import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT } from '../helpers.js';
import { Activity, AuditWeek } from '../../src/models/index.js';

const WS = `${BASE}/workspace`;

const setRate = (session) => api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);
const currentWeek = (session) => api().get(`${WS}/audits/current`).set(session.auth());
const saveWeek = (session, week, body) =>
  api().put(`${WS}/audits/${week}`).set(session.auth()).send(body);

/** Moves a YYYY-MM-DD back by whole weeks, for tests that need a previous week. */
function shiftBack(isoDate, weeks) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) - weeks * 7 * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

async function ready(over = {}) {
  const session = await signedInUser(over);
  await setRate(session);
  const { body } = await currentWeek(session);
  return { session, weekStarting: body.data.week.weekStarting };
}

describe('opening the week', () => {
  it('creates a draft for the week now closing', async () => {
    const { session } = await ready();
    const res = await currentWeek(session);

    expect(res.status).toBe(200);
    expect(res.body.data.week.status).toBe('draft');
    expect(res.body.data.week.weekStarting).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Monday to Sunday, so the client can name the range without doing date maths.
    expect(res.body.data.week.weekEnding).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the same draft rather than a new one each time', async () => {
    const { session } = await ready();
    const first = await currentWeek(session);
    const second = await currentWeek(session);

    expect(second.body.data.week.id).toBe(first.body.data.week.id);
    expect(await AuditWeek.countDocuments({}).setOptions({ allTenants: true })).toBe(1);
  });

  it('records the timezone the week was cut in', async () => {
    const { session } = await ready({ timezone: 'Asia/Karachi' });
    const res = await currentWeek(session);

    // Kept so that moving country later does not silently re-cut the history.
    expect(res.body.data.week.timezone).toBe('Asia/Karachi');
  });
});

describe('filing a week', () => {
  it('creates activities named inline and stores the entries', async () => {
    const { session, weekStarting } = await ready();

    const res = await saveWeek(session, weekStarting, {
      entries: [
        { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
        { activityName: 'Sales calls', estimatedMinutes: 300, energy: 2 },
      ],
      status: 'complete',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.week.status).toBe('complete');
    expect(res.body.data.week.entries).toHaveLength(2);
    expect(res.body.data.week.totalEstimatedMinutes).toBe(540);
    expect(await Activity.countDocuments({}).setOptions({ allTenants: true })).toBe(2);
  });

  it('names every duration as an estimate, because that is what it is', async () => {
    const { session, weekStarting } = await ready();
    const res = await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 240, energy: -1 }],
      status: 'complete',
    });

    // Measured figures arrive later and must never be confused with recall. The
    // response body is the last place that distinction should get lost.
    expect(res.body.data.week.entries[0]).toHaveProperty('estimatedMinutes');
    expect(res.body.data.week.entries[0]).not.toHaveProperty('minutes');
    expect(res.body.data.week).toHaveProperty('totalEstimatedMinutes');
  });

  it('reuses an activity typed with different capitals', async () => {
    const { session, weekStarting } = await ready();

    await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 60, energy: -1 }],
    });
    await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'invoicing', estimatedMinutes: 90, energy: -1 }],
    });

    // Two rows would split every trend this product is built to show.
    expect(await Activity.countDocuments({}).setOptions({ allTenants: true })).toBe(1);
  });

  it('refuses the same activity twice in one week', async () => {
    const { session, weekStarting } = await ready();

    const res = await saveWeek(session, weekStarting, {
      entries: [
        { activityName: 'Invoicing', estimatedMinutes: 60, energy: -1 },
        { activityName: 'Invoicing', estimatedMinutes: 30, energy: -1 },
      ],
    });

    // Otherwise its hours double and it quietly climbs to the top of the dashboard.
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toMatch(/more than once/i);
  });

  it('saves a draft without demanding it be finished', async () => {
    const { session, weekStarting } = await ready();
    const res = await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 60, energy: 0 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.week.status).toBe('draft');
    expect(res.body.data.week.completedAt).toBeNull();
  });

  it('will not finish an empty week', async () => {
    const { session, weekStarting } = await ready();
    const res = await saveWeek(session, weekStarting, { entries: [], status: 'complete' });

    expect(res.status).toBe(422);
  });

  it('accepts a week being marked unusual', async () => {
    const { session, weekStarting } = await ready();
    const res = await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Firefighting', estimatedMinutes: 2400, energy: -2 }],
      isTypical: false,
      status: 'complete',
    });

    // A baseline built from a holiday or a crisis makes every later comparison wrong.
    expect(res.body.data.week.isTypical).toBe(false);
  });

  it.each([
    ['fractional minutes', { estimatedMinutes: 90.5 }],
    ['more minutes than a week holds', { estimatedMinutes: 20_000 }],
    ['energy off the scale', { energy: 5 }],
    ['fractional energy', { energy: 1.5 }],
  ])('rejects %s with 422', async (_label, over) => {
    const { session, weekStarting } = await ready();
    const res = await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 60, energy: -1, ...over }],
    });

    expect(res.status).toBe(422);
  });

  it.each([
    ['both an id and a new name', { activityId: '0123456789abcdef01234567', activityName: 'Invoicing' }],
    ['neither an id nor a name', {}],
  ])('refuses an entry naming %s', async (_label, over) => {
    const { session, weekStarting } = await ready();

    // Ambiguity here would silently create a duplicate activity beside the one
    // that was picked; naming nothing has no activity to attach hours to at all.
    const res = await saveWeek(session, weekStarting, {
      entries: [{ estimatedMinutes: 60, energy: -1, ...over }],
    });

    expect(res.status).toBe(422);
  });
});

describe('the second week', () => {
  it('carries last week’s activities and hours forward as suggestions', async () => {
    const { session, weekStarting } = await ready();
    await saveWeek(session, weekStarting, {
      entries: [
        { activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 },
        { activityName: 'Sales calls', estimatedMinutes: 300, energy: 2 },
      ],
      status: 'complete',
    });

    /**
     * The pre-fill is the difference between a habit and a chore: week one takes
     * ten minutes, week two should take two. Rather than wait a week, move the
     * filed week back so that "the week now closing" is the one after it.
     */
    const previous = shiftBack(weekStarting, 1);
    await AuditWeek.updateMany({}, { weekStarting: previous }).setOptions({ allTenants: true });

    const res = await currentWeek(session);

    expect(res.body.data.week.weekStarting).toBe(weekStarting);
    expect(res.body.data.isNew).toBe(true);
    expect(res.body.data.suggestions).toHaveLength(2);
    expect(res.body.data.suggestions.map((s) => s.estimatedMinutes).sort((a, b) => a - b))
      .toEqual([240, 300]);
  });

  it('does not carry energy forward', async () => {
    const { session, weekStarting } = await ready();
    await saveWeek(session, weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 }],
      status: 'complete',
    });

    await AuditWeek.updateMany({}, { weekStarting: shiftBack(weekStarting, 1) })
      .setOptions({ allTenants: true });

    const res = await currentWeek(session);

    // Energy is the thing most likely to have changed, and a pre-filled answer is
    // an answer nobody re-reads.
    expect(res.body.data.suggestions[0]).not.toHaveProperty('energy');
  });
});

describe('tenancy', () => {
  it('never shows one workspace’s week to another', async () => {
    const mine = await ready();
    await saveWeek(mine.session, mine.weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 240, energy: -2 }],
      status: 'complete',
    });

    const theirs = await signedInUser({ email: 'someone-else@example.com', name: 'Someone Else' });

    /**
     * The worst bug this product could have, and the quietest: nothing crashes,
     * the wrong person's week simply appears. Checked at the route rather than
     * trusted to the plugin that is supposed to prevent it.
     */
    const week = await api().get(`${WS}/audits/${mine.weekStarting}`).set(theirs.auth());
    expect(week.status).toBe(404);

    const activities = await api().get(`${WS}/activities`).set(theirs.auth());
    expect(activities.body.data.activities).toHaveLength(0);

    const weeks = await api().get(`${WS}/audits`).set(theirs.auth());
    expect(weeks.body.data.weeks).toHaveLength(0);
  });

  it('will not let one workspace rename another’s activity', async () => {
    const mine = await ready();
    await saveWeek(mine.session, mine.weekStarting, {
      entries: [{ activityName: 'Invoicing', estimatedMinutes: 60, energy: -1 }],
    });
    const activity = await Activity.findOne({ name: 'Invoicing' }).setOptions({ allTenants: true });

    const theirs = await signedInUser({ email: 'someone-else@example.com', name: 'Someone Else' });
    const res = await api()
      .patch(`${WS}/activities/${activity._id}`)
      .set(theirs.auth())
      .send({ name: 'Stolen' });

    expect(res.status).toBe(404);
    // allTenants, because this assertion deliberately reaches across a boundary
    // the application code never may — and the plugin makes that explicit.
    const after = await Activity.findOne({ _id: activity._id }).setOptions({ allTenants: true });
    expect(after.name).toBe('Invoicing');
  });

  it('refuses a query that forgets its workspace', async () => {
    // The plugin throws rather than quietly returning another workspace's rows,
    // because discipline does not survive the fiftieth query.
    await expect(Activity.find({})).rejects.toThrow(/must carry workspaceId/);
  });
});
