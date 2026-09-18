/** Every URL in one place — no route string is typed twice. */
export const paths = {
  landing: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password/:token',
  resetPasswordFor: (token) => `/reset-password/${token}`,

  onboarding: '/onboarding',

  sortStart: '/sort',
  sortSessionPattern: '/sort/:id',
  sortSession: (id) => `/sort/${id}`,
  sortResultPattern: '/sort/:id/result',
  sortResult: (id) => `/sort/${id}/result`,

  app: '/app',
  audit: '/app/audit',
  drip: '/app/drip',
  advisor: '/app/advisor',
  plans: '/app/plans',
  planPattern: '/app/plans/:id',
  plan: (id) => `/app/plans/${id}`,
  delegation: '/app/delegation',
  playbooks: '/app/playbooks',
  playbookPattern: '/app/playbooks/:id',
  playbook: (id) => `/app/playbooks/${id}`,
  review: '/app/review',
  settings: '/app/settings',
};
