import { api } from '../apiClient.js';

/**
 * One function per endpoint. Components never call these directly — they go
 * through the hooks in hooks.js, which handle caching and invalidation.
 */
const ws = (workspaceId) => ({ workspaceId });
const qs = (params) => new URLSearchParams(
  Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
).toString();

export const endpoints = {
  // Analytics --------------------------------------------------------------
  dashboard: (id, windowDays = 14) => api.get(`/analytics/dashboard?windowDays=${windowDays}`, ws(id)),
  weeklyReview: (id, week) => api.get(`/analytics/weekly-review${week ? `?week=${week}` : ''}`, ws(id)),

  // Time entries -----------------------------------------------------------
  listEntries: (id, params = {}) => api.get(`/time-entries?${qs(params)}`, ws(id)),
  entrySummary: (id, params = {}) => api.get(`/time-entries/summary?${qs(params)}`, ws(id)),
  createEntry: (id, body) => api.post('/time-entries', body, ws(id)),
  updateEntry: (id, entryId, body) => api.patch(`/time-entries/${entryId}`, body, ws(id)),
  deleteEntry: (id, entryId) => api.delete(`/time-entries/${entryId}`, ws(id)),

  // Sort -------------------------------------------------------------------
  startSort: (id, body) => api.post('/sort', body, ws(id)),
  activeSort: (id) => api.get('/sort/active', ws(id)),
  getSort: (id, sid) => api.get(`/sort/${sid}`, ws(id)),
  classifyGroup: (id, sid, gid, body) => api.post(`/sort/${sid}/groups/${gid}/classify`, body, ws(id)),
  skipGroup: (id, sid, gid) => api.post(`/sort/${sid}/groups/${gid}/skip`, {}, ws(id)),
  completeSort: (id, sid) => api.post(`/sort/${sid}/complete`, {}, ws(id)),

  // Tasks ------------------------------------------------------------------
  listTasks: (id, params = {}) => api.get(`/tasks?${qs(params)}`, ws(id)),
  getTask: (id, taskId) => api.get(`/tasks/${taskId}`, ws(id)),
  updateTask: (id, taskId, body) => api.patch(`/tasks/${taskId}`, body, ws(id)),
  delegationQueue: (id) => api.get('/tasks/queue/delegation', ws(id)),

  // DRIP -------------------------------------------------------------------
  drip: (id, windowDays = 14) => api.get(`/drip?windowDays=${windowDays}`, ws(id)),
  reclassify: (id, taskId, body) => api.patch(`/drip/tasks/${taskId}`, body, ws(id)),

  // Advisor ----------------------------------------------------------------
  analyse: (id, windowDays = 14) => api.post('/recommendations/analyse', { windowDays }, ws(id)),
  listRecommendations: (id, status = 'pending') => api.get(`/recommendations?status=${status}`, ws(id)),
  getRecommendation: (id, recId) => api.get(`/recommendations/${recId}`, ws(id)),
  acceptRecommendation: (id, recId) => api.post(`/recommendations/${recId}/accept`, {}, ws(id)),
  rejectRecommendation: (id, recId, reason) => api.post(`/recommendations/${recId}/reject`, { reason }, ws(id)),
  snoozeRecommendation: (id, recId, snoozeDays = 28) =>
    api.post(`/recommendations/${recId}/snooze`, { snoozeDays }, ws(id)),

  // Plans ------------------------------------------------------------------
  listPlans: (id, status = 'all') => api.get(`/plans?status=${status}`, ws(id)),
  getPlan: (id, planId) => api.get(`/plans/${planId}`, ws(id)),
  createPlan: (id, body) => api.post('/plans', body, ws(id)),
  updatePlan: (id, planId, body) => api.patch(`/plans/${planId}`, body, ws(id)),
  approvePlan: (id, planId) => api.post(`/plans/${planId}/approve`, {}, ws(id)),
  verifyPlan: (id, planId) => api.post(`/plans/${planId}/verify`, {}, ws(id)),
  attachPlaybook: (id, planId, playbookId) => api.post(`/plans/${planId}/playbook`, { playbookId }, ws(id)),

  // Playbooks --------------------------------------------------------------
  listPlaybooks: (id, status = 'all') => api.get(`/playbooks?status=${status}`, ws(id)),
  getPlaybook: (id, pbId) => api.get(`/playbooks/${pbId}`, ws(id)),
  createPlaybook: (id, body) => api.post('/playbooks', body, ws(id)),
  updatePlaybook: (id, pbId, body) => api.patch(`/playbooks/${pbId}`, body, ws(id)),
  publishPlaybook: (id, pbId) => api.post(`/playbooks/${pbId}/publish`, {}, ws(id)),
  draftPlaybook: (id, taskId) => api.post('/playbooks/draft-from-task', { taskId }, ws(id)),
  listRuns: (id, pbId) => api.get(`/playbooks/${pbId}/runs`, ws(id)),
  startRun: (id, pbId) => api.post(`/playbooks/${pbId}/runs`, {}, ws(id)),
  updateRun: (id, runId, body) => api.patch(`/playbooks/runs/${runId}`, body, ws(id)),
  completeRun: (id, runId, body) => api.post(`/playbooks/runs/${runId}/complete`, body, ws(id)),

  // Workspace --------------------------------------------------------------
  members: (id) => api.get(`/workspaces/${id}/members`, ws(id)),
  updateWorkspace: (id, body) => api.patch(`/workspaces/${id}`, body, ws(id)),
  updateBuybackRate: (id, body) => api.patch(`/workspaces/${id}/buyback-rate`, body, ws(id)),
  invite: (id, body) => api.post(`/workspaces/${id}/invites`, body, ws(id)),
};
