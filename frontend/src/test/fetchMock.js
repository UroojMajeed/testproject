import { vi } from 'vitest';

/**
 * A stand-in for the API that answers in the real envelope.
 *
 * Handlers are keyed "METHOD /path". Anything unhandled throws with the route
 * name, which is a better failure than a test quietly getting `undefined`.
 */
export function mockApi(handlers = {}) {
  const calls = [];

  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined, init });

    const handler = handlers[key];
    if (!handler) throw new Error(`No mock for ${key}`);

    const { status = 200, body } = typeof handler === 'function' ? await handler() : handler;

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
      json: async () => body,
    };
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const success = (data, status = 200) => ({ status, body: { success: true, data } });

export const failure = (status, code, message, details) => ({
  status,
  body: { success: false, error: { code, message, details } },
});

/** The boot call AuthProvider makes. Signed out unless a test says otherwise. */
export const bootSignedOut = { 'POST /api/v1/auth/refresh': failure(401, 'UNAUTHENTICATED', 'No refresh token supplied') };

/**
 * A signed-in workspace that is past onboarding, with one filed week.
 *
 * Grouped here rather than rebuilt per test: every signed-in screen needs /state
 * before it will render anything, so a test that forgets it sees a spinner and an
 * assertion failure that says nothing about what it was actually testing.
 */
export const WORKSPACE_STATE = {
  weekStarting: '2026-09-21',
  needsRate: false,
  needsFirstAudit: false,
  currentWeekFiled: true,
  completedAudits: 3,
  needsFirstSort: false,
  unsortedCount: 0,
};

/**
 * Two dashboard rows, reused by the matrix below.
 *
 * Shared rather than duplicated because the server sends the same row object in
 * both places: a fixture where they drift apart would let a component pass a test
 * it could not pass against the real API.
 */
const INVOICING = {
  activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2,
  averageEnergy: -2, value: 'low', quadrant: 'delegate',
  estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000,
};

const SALES_CALLS = {
  activityId: 'a2', name: 'Sales calls', estimatedMinutes: 300, energy: 2,
  averageEnergy: 2, value: 'critical', quadrant: 'produce',
  estimatedWeeklyCostMinor: 7500, estimatedAnnualCostMinor: 375000,
};

/** A quadrant with its totals summed from its members, as the server does it. */
const quadrant = (activities) => ({
  activities,
  count: activities.length,
  estimatedMinutes: activities.reduce((sum, row) => sum + row.estimatedMinutes, 0),
  estimatedWeeklyCostMinor: activities.reduce((sum, row) => sum + row.estimatedWeeklyCostMinor, 0),
  estimatedAnnualCostMinor: activities.reduce((sum, row) => sum + row.estimatedAnnualCostMinor, 0),
});

export const DASHBOARD = {
  week: { weekStarting: '2026-09-21', weekEnding: '2026-09-27', isTypical: true, completedAt: '2026-09-25T10:00:00.000Z' },
  rate: { rateMinorPerHour: 1500, currency: 'USD', weeksPerYear: 50, effectiveFrom: '2026-09-01T00:00:00.000Z', formulaVersion: 1 },
  activities: [INVOICING, SALES_CALLS],
  matrix: {
    // Invoicing drains and does not matter; sales calls energise and do. The two
    // named quadrants are enough to prove ordering and totals, and leaving the
    // other two empty is what a real first sort looks like.
    delegate: quadrant([INVOICING]),
    replace: quadrant([]),
    invest: quadrant([]),
    produce: quadrant([SALES_CALLS]),
  },
  unsortedCount: 0,
  totals: { estimatedMinutes: 540, estimatedWeeklyCostMinor: 13500, estimatedAnnualCostMinor: 675000 },
  worst: INVOICING,
  weeksRecorded: 3,
};

/** Everything a signed-in screen asks for, so a test only overrides what it cares about. */
export const signedInWorkspace = (over = {}) => ({
  'GET /api/v1/workspace/state': success(WORKSPACE_STATE),
  'GET /api/v1/workspace/dashboard': success(DASHBOARD),
  'GET /api/v1/workspace/activities': success({ activities: [
    { id: 'a1', name: 'Invoicing', value: 'low', valueSetAt: '2026-09-24T00:00:00.000Z', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
    { id: 'a2', name: 'Sales calls', value: 'critical', valueSetAt: '2026-09-24T00:00:00.000Z', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
  ] }),
  'GET /api/v1/workspace/activities/unsorted': success({ activities: [] }),
  'GET /api/v1/workspace/rate': success({ rate: DASHBOARD.rate }),
  // Reachable from the frame's nav on every signed-in screen now, so it belongs
  // here rather than in the one test file that used to be the only way in.
  'GET /api/v1/workspace/audits/current': success({
    week: {
      id: 'w1', weekStarting: '2026-09-28', weekEnding: '2026-10-04', timezone: 'UTC',
      status: 'draft', isTypical: true, completedAt: null, entries: [], totalEstimatedMinutes: 0,
    },
    suggestions: [],
    isNew: true,
  }),
  ...over,
});
