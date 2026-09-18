/** Every URL in one place — no route string is typed twice. */
export const paths = {
  landing: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password/:token',
  resetPasswordFor: (token) => `/reset-password/${token}`,

  onboarding: '/onboarding',
  onboardingStep: (step) => `/onboarding/${step}`,

  app: '/app',
  dashboard: '/app',
  settings: '/app/settings',
};
