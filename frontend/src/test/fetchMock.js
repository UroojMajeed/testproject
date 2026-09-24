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
};

export const DASHBOARD = {
  week: { weekStarting: '2026-09-21', weekEnding: '2026-09-27', isTypical: true, completedAt: '2026-09-25T10:00:00.000Z' },
  rate: { rateMinorPerHour: 1500, currency: 'USD', weeksPerYear: 50, effectiveFrom: '2026-09-01T00:00:00.000Z', formulaVersion: 1 },
  activities: [
    { activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2, estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
    { activityId: 'a2', name: 'Sales calls', estimatedMinutes: 300, energy: 2, estimatedWeeklyCostMinor: 7500, estimatedAnnualCostMinor: 375000 },
  ],
  totals: { estimatedMinutes: 540, estimatedWeeklyCostMinor: 13500, estimatedAnnualCostMinor: 675000 },
  worst: { activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2, estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
  weeksRecorded: 3,
};

/** Everything a signed-in screen asks for, so a test only overrides what it cares about. */
export const signedInWorkspace = (over = {}) => ({
  'GET /api/v1/workspace/state': success(WORKSPACE_STATE),
  'GET /api/v1/workspace/dashboard': success(DASHBOARD),
  'GET /api/v1/workspace/activities': success({ activities: [
    { id: 'a1', name: 'Invoicing', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
    { id: 'a2', name: 'Sales calls', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
  ] }),
  'GET /api/v1/workspace/rate': success({ rate: DASHBOARD.rate }),
  ...over,
});
