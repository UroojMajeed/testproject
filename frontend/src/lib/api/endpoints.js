/**
 * The client's half of the contract. When something 404s or 422s, this is the
 * first file to read — it is meant to be checkable, line by line, against
 * backend/src/routes.js and backend/src/modules/auth/auth.validation.js.
 *
 * Step 1 is authentication. Nothing else is listed because nothing else exists.
 */

export const API_BASE = '/api/v1';

export const endpoints = Object.freeze({
  health: () => `${API_BASE}/health`,

  auth: Object.freeze({
    // { name, email, password, timezone? } → 201 { accessToken, user }
    register: () => `${API_BASE}/auth/register`,
    // { email, password } → 200 { accessToken, user }
    login: () => `${API_BASE}/auth/login`,
    // refresh cookie → 200 { accessToken, user }
    refresh: () => `${API_BASE}/auth/refresh`,
    // refresh cookie → 204
    logout: () => `${API_BASE}/auth/logout`,
    // bearer → 204
    logoutAll: () => `${API_BASE}/auth/logout-all`,
    // bearer → 200 { user }
    me: () => `${API_BASE}/auth/me`,
    // { email } → 200 { message }   (identical whether or not the account exists)
    forgotPassword: () => `${API_BASE}/auth/forgot-password`,
    // { token, password } → 200 { message }
    resetPassword: () => `${API_BASE}/auth/reset-password`,
    // bearer { currentPassword, newPassword } → 200 { message }
    changePassword: () => `${API_BASE}/auth/change-password`,
    // { token } → 200 { user }
    verifyEmail: () => `${API_BASE}/auth/verify-email`,
  }),

  /**
   * Step 2. Everything here is tenant-scoped and needs a bearer token; the
   * /workspace prefix is the tenancy boundary made visible in the URL.
   */
  workspace: Object.freeze({
    // → 200 { workspace }
    show: () => `${API_BASE}/workspace`,
    // → 200 { weekStarting, needsRate, needsFirstAudit, currentWeekFiled, completedAudits }
    state: () => `${API_BASE}/workspace/state`,

    // → 200 { rate } — null until one is set
    rate: () => `${API_BASE}/workspace/rate`,
    // PUT { annualIncomeMinor, hoursPerWeek, weeksPerYear } → 201 { rate }
    rateHistory: () => `${API_BASE}/workspace/rate/history`,

    // → 200 { activities }
    activities: () => `${API_BASE}/workspace/activities`,
    // PATCH { name } → 200 { activity } · DELETE → 204 (archives)
    activity: (id) => `${API_BASE}/workspace/activities/${id}`,

    // → 200 { week, suggestions, isNew }
    currentAudit: () => `${API_BASE}/workspace/audits/current`,
    // → 200 { weeks }
    audits: () => `${API_BASE}/workspace/audits`,
    // PUT { entries[], isTypical?, status? } → 200 { week }
    audit: (weekStarting) => `${API_BASE}/workspace/audits/${weekStarting}`,

    // → 200 { week, rate, activities, totals, worst, weeksRecorded }
    dashboard: () => `${API_BASE}/workspace/dashboard`,
  }),
});
