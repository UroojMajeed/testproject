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
});
