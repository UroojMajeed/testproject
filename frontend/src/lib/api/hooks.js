import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from './endpoints.js';
import { qk } from '../queryKeys.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';

/** Every query is keyed by workspace, so switching cannot show stale tenant data. */
function useWs() {
  const { workspaceId } = useWorkspace();
  return workspaceId;
}

export function useDashboard(windowDays = 14) {
  const id = useWs();
  return useQuery({
    queryKey: qk.dashboard(id, windowDays),
    queryFn: () => endpoints.dashboard(id, windowDays),
    enabled: Boolean(id),
  });
}

export function useEntries(params = {}) {
  const id = useWs();
  return useQuery({
    queryKey: qk.entries(id, params),
    queryFn: () => endpoints.listEntries(id, params),
    enabled: Boolean(id),
  });
}

export function useEntrySummary(params = {}) {
  const id = useWs();
  return useQuery({
    queryKey: qk.summary(id, params),
    queryFn: () => endpoints.entrySummary(id, params),
    enabled: Boolean(id),
  });
}

/** Anything that changes time invalidates everything derived from it. */
function invalidateTimeDerived(qc, id) {
  qc.invalidateQueries({ queryKey: ['ws', id] });
}

export function useCreateEntry() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => endpoints.createEntry(id, body),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useUpdateEntry() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }) => endpoints.updateEntry(id, entryId, body),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useDeleteEntry() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId) => endpoints.deleteEntry(id, entryId),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useActiveSort() {
  const id = useWs();
  return useQuery({
    queryKey: qk.sortActive(id),
    queryFn: () => endpoints.activeSort(id),
    enabled: Boolean(id),
  });
}

export function useStartSort() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => endpoints.startSort(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sortActive(id) }),
  });
}

export function useClassifyGroup(sessionId) {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...body }) => endpoints.classifyGroup(id, sessionId, groupId, body),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useSkipGroup(sessionId) {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId) => endpoints.skipGroup(id, sessionId, groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sortActive(id) }),
  });
}

export function useCompleteSort() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId) => endpoints.completeSort(id, sessionId),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useDrip(windowDays = 14) {
  const id = useWs();
  return useQuery({
    queryKey: qk.drip(id, windowDays),
    queryFn: () => endpoints.drip(id, windowDays),
    enabled: Boolean(id),
  });
}

export function useReclassify() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...body }) => endpoints.reclassify(id, taskId, body),
    onSuccess: () => invalidateTimeDerived(qc, id),
  });
}

export function useRecommendations(status = 'pending') {
  const id = useWs();
  return useQuery({
    queryKey: qk.recommendations(id, status),
    queryFn: () => endpoints.listRecommendations(id, status),
    enabled: Boolean(id),
  });
}

export function useAnalyse() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (windowDays) => endpoints.analyse(id, windowDays),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', id] }),
  });
}

export function useDecideRecommendation() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recId, decision, reason }) => {
      if (decision === 'accept') return endpoints.acceptRecommendation(id, recId);
      if (decision === 'reject') return endpoints.rejectRecommendation(id, recId, reason);
      return endpoints.snoozeRecommendation(id, recId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', id] }),
  });
}

export function usePlans(status = 'all') {
  const id = useWs();
  return useQuery({
    queryKey: qk.plans(id, status),
    queryFn: () => endpoints.listPlans(id, status),
    enabled: Boolean(id),
  });
}

export function usePlan(planId) {
  const id = useWs();
  return useQuery({
    queryKey: qk.plan(id, planId),
    queryFn: () => endpoints.getPlan(id, planId),
    enabled: Boolean(id && planId),
  });
}

export function useCreatePlan() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => endpoints.createPlan(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', id] }),
  });
}

export function usePlanAction(action) {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId) =>
      (action === 'approve' ? endpoints.approvePlan(id, planId) : endpoints.verifyPlan(id, planId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', id] }),
  });
}

export function useUpdatePlan() {
  const id = useWs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, ...body }) => endpoints.updatePlan(id, planId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws', id] }),
  });
}

export function usePlaybooks(status = 'all') {
  const id = useWs();
  return useQuery({
    queryKey: qk.playbooks(id, status),
    queryFn: () => endpoints.listPlaybooks(id, status),
    enabled: Boolean(id),
  });
}

export function usePlaybook(pbId) {
  const id = useWs();
  return useQuery({
    queryKey: qk.playbook(id, pbId),
    queryFn: () => endpoints.getPlaybook(id, pbId),
    enabled: Boolean(id && pbId),
  });
}

export function usePlaybookMutations() {
  const id = useWs();
  const qc = useQueryClient();
  const bust = () => qc.invalidateQueries({ queryKey: ['ws', id] });

  return {
    create: useMutation({ mutationFn: (body) => endpoints.createPlaybook(id, body), onSuccess: bust }),
    update: useMutation({
      mutationFn: ({ pbId, ...body }) => endpoints.updatePlaybook(id, pbId, body), onSuccess: bust,
    }),
    publish: useMutation({ mutationFn: (pbId) => endpoints.publishPlaybook(id, pbId), onSuccess: bust }),
    draft: useMutation({ mutationFn: (taskId) => endpoints.draftPlaybook(id, taskId), onSuccess: bust }),
  };
}

export function useDelegationQueue() {
  const id = useWs();
  return useQuery({
    queryKey: qk.delegation(id),
    queryFn: () => endpoints.delegationQueue(id),
    enabled: Boolean(id),
  });
}

export function useWeeklyReview(week) {
  const id = useWs();
  return useQuery({
    queryKey: qk.review(id, week ?? 'current'),
    queryFn: () => endpoints.weeklyReview(id, week),
    enabled: Boolean(id),
  });
}

export function useTasks(params = {}) {
  const id = useWs();
  return useQuery({
    queryKey: qk.tasks(id, params),
    queryFn: () => endpoints.listTasks(id, params),
    enabled: Boolean(id),
  });
}

export function useMembers() {
  const id = useWs();
  return useQuery({
    queryKey: qk.members(id),
    queryFn: () => endpoints.members(id),
    enabled: Boolean(id),
  });
}

export function useWorkspaceMutations() {
  const id = useWs();
  const qc = useQueryClient();
  const bust = () => {
    qc.invalidateQueries({ queryKey: ['ws', id] });
    qc.invalidateQueries({ queryKey: qk.session });
  };
  return {
    update: useMutation({ mutationFn: (body) => endpoints.updateWorkspace(id, body), onSuccess: bust }),
    setRate: useMutation({ mutationFn: (body) => endpoints.updateBuybackRate(id, body), onSuccess: bust }),
    invite: useMutation({ mutationFn: (body) => endpoints.invite(id, body), onSuccess: bust }),
  };
}
