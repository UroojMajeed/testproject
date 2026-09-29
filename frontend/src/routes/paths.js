/** Every route in one place, so no component builds a URL from a string literal. */
export const paths = Object.freeze({
  // Public.
  landing: '/',
  login: '/sign-in',
  register: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',

  // Signed in. Kept under /app so the public pages and the product never fight
  // over a URL, and so a signed-out visitor landing anywhere under /app gets the
  // same treatment without a rule per page.
  app: '/app',
  rate: '/app/rate',
  audit: '/app/audit',
  matrix: '/app/matrix',
  handover: '/app/handover',

  /**
   * Off the sidebar, still reachable.
   *
   * Renaming an activity and archiving one live only here, so dropping the route
   * with the nav item would quietly delete working features. It is linked from
   * the week instead of taking a place in a five-item frame.
   */
  activities: '/app/activities',
});
