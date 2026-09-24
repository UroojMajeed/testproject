/**
 * The API, standing still.
 *
 * The backend needs MongoDB, so these tests answer it themselves at the network
 * boundary, in the same envelope backend/src/utils/ApiResponse.js produces. That
 * makes the suite hermetic — it runs with nothing but the frontend installed.
 *
 * Be clear about what that does and does not prove. It checks the frontend against
 * the contract in src/lib/api/endpoints.js. It does not check that the real server
 * honours that contract; `npm run test:integration` in backend/ is what does that.
 * If the two ever disagree, both suites can be green and the app still broken —
 * which is exactly why CLAUDE.md names the four files that have to agree.
 */

export const PASSWORD = 'correct-horse-battery-staple';

/** The dashboard greets by first name, which is friendlier and deliberate. */
export const FIRST_NAME = 'Urooj';

export const USER = {
  id: '68f0a1b2c3d4e5f600000001',
  name: 'Urooj Majeed',
  email: 'founder@example.com',
  avatarUrl: null,
  timezone: 'Asia/Karachi',
  emailVerified: false,
  createdAt: '2026-09-23T09:14:00.000Z',
  lastLoginAt: null,
};

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ok = (data, status = 200) => json(status, { success: true, data });
const fail = (status, code, message, details) => json(status, { success: false, error: { code, message, details } });

/**
 * Installs the stub and hands back a handle.
 *
 * `signedIn` starts the session already established, which is how a test reaches
 * the signed-in pages without walking the sign-in form every time.
 */
/**
 * A workspace that is past onboarding with one week filed.
 *
 * Needed because the signed-in area is gated on GET /workspace/state: without it
 * every test that reaches /app lands on the gate's error screen instead of the
 * dashboard, which is how seventeen of these failed the first time step 2 landed.
 */
const WORKSPACE = { id: 'ws1', name: 'My business', auditDay: 'friday', timezone: 'UTC', currency: 'USD', createdAt: '2026-09-01T00:00:00.000Z' };

const RATE = { id: 'r1', rateMinorPerHour: 1500, currency: 'USD', annualIncomeMinor: 12_000_000, hoursPerWeek: 40, weeksPerYear: 50, formulaVersion: 1, effectiveFrom: '2026-09-01T00:00:00.000Z' };

const DASHBOARD = {
  week: { weekStarting: '2026-09-14', weekEnding: '2026-09-20', isTypical: true, completedAt: '2026-09-19T10:00:00.000Z' },
  rate: RATE,
  activities: [
    { activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2, estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
    { activityId: 'a2', name: 'Sales calls', estimatedMinutes: 360, energy: 2, estimatedWeeklyCostMinor: 9000, estimatedAnnualCostMinor: 450000 },
  ],
  totals: { estimatedMinutes: 600, estimatedWeeklyCostMinor: 15000, estimatedAnnualCostMinor: 750000 },
  worst: { activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2, estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
  weeksRecorded: 1,
};

export async function stubApi(page, { signedIn = false, onboarding = {} } = {}) {
  const state = { session: signedIn, failedLogins: 0 };
  const calls = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? JSON.parse(request.postData()) : {};
    calls.push({ method: request.method(), path, body });

    switch (path) {
      case '/api/v1/auth/refresh':
        // The whole session model in one branch: on boot the client has no token
        // and asks the cookie who it is.
        return route.fulfill(state.session
          ? ok({ accessToken: 'stub-access-token', user: USER })
          : fail(401, 'UNAUTHENTICATED', 'No refresh token supplied'));

      case '/api/v1/auth/register':
        if (body.email === 'taken@example.com') {
          return route.fulfill(fail(409, 'CONFLICT', 'That email is already registered'));
        }
        if (body.password === 'server-only-rejection') {
          return route.fulfill(fail(422, 'VALIDATION_ERROR', 'Some fields need attention', [
            { field: 'body.password', message: 'That password is too common — pick another' },
          ]));
        }
        state.session = true;
        return route.fulfill(ok({ accessToken: 'stub-access-token', user: USER }, 201));

      case '/api/v1/auth/login':
        if (body.password !== PASSWORD) {
          state.failedLogins += 1;
          // Mirrors MAX_LOGIN_ATTEMPTS=5: the sixth try meets a locked account.
          return route.fulfill(state.failedLogins > 5
            ? fail(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.')
            : fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect'));
        }
        state.session = true;
        state.failedLogins = 0;
        return route.fulfill(ok({ accessToken: 'stub-access-token', user: { ...USER, lastLoginAt: new Date().toISOString() } }));

      case '/api/v1/auth/logout':
        state.session = false;
        return route.fulfill({ status: 204, body: '' });

      case '/api/v1/auth/forgot-password':
        // Identical whether or not the address exists — that is the point of it.
        return route.fulfill(ok({ message: 'If an account exists for that address, a reset link is on its way.' }));

      case '/api/v1/auth/reset-password':
        state.session = false; // a reset revokes every session
        return route.fulfill(ok({ message: 'Password updated. Please sign in with your new password.' }));

      // ── Step 2 ────────────────────────────────────────────────────────
      case '/api/v1/workspace':
        return route.fulfill(ok({ workspace: WORKSPACE }));

      case '/api/v1/workspace/state':
        return route.fulfill(ok({
          weekStarting: '2026-09-14',
          needsRate: false,
          needsFirstAudit: false,
          currentWeekFiled: true,
          completedAudits: 1,
          ...onboarding,
        }));

      case '/api/v1/workspace/rate':
        return route.fulfill(request.method() === 'PUT' ? ok({ rate: RATE }, 201) : ok({ rate: RATE }));

      case '/api/v1/workspace/activities':
        return route.fulfill(ok({ activities: [
          { id: 'a1', name: 'Invoicing', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
          { id: 'a2', name: 'Sales calls', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
        ] }));

      case '/api/v1/workspace/audits/current':
        return route.fulfill(ok({
          week: {
            id: 'w1', weekStarting: '2026-09-21', weekEnding: '2026-09-27', timezone: 'UTC',
            status: 'draft', isTypical: true, completedAt: null, entries: [], totalEstimatedMinutes: 0,
          },
          suggestions: [],
          isNew: true,
        }));

      case '/api/v1/workspace/dashboard':
        return route.fulfill(ok(DASHBOARD));

      default:
        // Loud, because a silent 404 here looks like a frontend bug for an hour.
        return route.fulfill(fail(404, 'NOT_FOUND', `No stub for ${request.method()} ${path} — add one in e2e/apiStub.js`));
    }
  });

  return {
    calls,
    /** Every call made to one endpoint, for asserting on what was actually sent. */
    callsTo: (path) => calls.filter((c) => c.path === path),
  };
}

/**
 * Chromium logs every non-2xx response as a console error. The 401s and 423s these
 * tests provoke on purpose are not findings, so they are filtered here rather than
 * by loosening the check.
 */
export function collectConsoleErrors(page) {
  const errors = [];
  // The statuses these tests provoke on purpose. Chromium logs every non-2xx
  // response as a console error, so without this the suite reports its own
  // fixtures as findings.
  const allowed = [/Failed to load resource: the server responded with a status of (401|409|422|423)/];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (allowed.some((pattern) => pattern.test(message.text()))) return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

  return {
    errors,
    /**
     * For a test that causes an error deliberately — aborting a request to check
     * the offline message, say. Scoped to that one test, so a genuine network
     * failure anywhere else still fails the suite.
     */
    allow(pattern) {
      allowed.push(pattern);
      return this;
    },
  };
}
