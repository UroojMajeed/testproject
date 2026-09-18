/**
 * Centralised so invalidation is a lookup rather than a guess. Every key is
 * prefixed by the workspace, which means switching workspace cannot show
 * another one's cached data.
 */
export const qk = {
  session: ['session'],
  ws: (id) => ['ws', id],

  dashboard: (id, days) => ['ws', id, 'dashboard', days],
  entries: (id, params) => ['ws', id, 'entries', params],
  summary: (id, params) => ['ws', id, 'summary', params],
  tasks: (id, params) => ['ws', id, 'tasks', params],
  task: (id, taskId) => ['ws', id, 'tasks', taskId],
  drip: (id, days) => ['ws', id, 'drip', days],
  recommendations: (id, status) => ['ws', id, 'recommendations', status],
  recommendation: (id, recId) => ['ws', id, 'recommendations', recId],
  plans: (id, status) => ['ws', id, 'plans', status],
  plan: (id, planId) => ['ws', id, 'plans', planId],
  playbooks: (id, status) => ['ws', id, 'playbooks', status],
  playbook: (id, pbId) => ['ws', id, 'playbooks', pbId],
  runs: (id, pbId) => ['ws', id, 'playbooks', pbId, 'runs'],
  delegation: (id) => ['ws', id, 'delegation'],
  review: (id, week) => ['ws', id, 'review', week],
  sortActive: (id) => ['ws', id, 'sort', 'active'],
  sortSession: (id, sid) => ['ws', id, 'sort', sid],
  members: (id) => ['ws', id, 'members'],
};
