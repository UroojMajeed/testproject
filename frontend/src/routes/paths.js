/** Every route in one place, so no component builds a URL from a string literal. */
export const paths = Object.freeze({
  // Public.
  landing: '/',
  login: '/sign-in',
  register: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',

  // Signed in. Kept under /app so the public pages and the product never fight
  // over a URL, and so a signed-out visitor landing anywhere under /app gets the
  // same treatment without a rule per page.
  app: '/app',
});
