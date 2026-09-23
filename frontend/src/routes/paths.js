/** Every route in one place, so no component builds a URL from a string literal. */
export const paths = Object.freeze({
  home: '/',
  login: '/sign-in',
  register: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
});
