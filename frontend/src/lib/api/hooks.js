import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../apiClient.js';
import { endpoints } from './endpoints.js';

/**
 * The server's view of where someone is in onboarding.
 *
 * One query, and every routing decision reads it. The alternative — inferring
 * "no rate yet" from an empty rate response and "no audit yet" from an empty audit
 * response — ends up duplicated in each guard and drifts from what the server
 * thinks. `staleTime: 0` because it changes the moment anything is saved.
 */
export const stateKey = ['workspace', 'state'];

export function useWorkspaceState() {
  return useQuery({
    queryKey: stateKey,
    queryFn: () => api.get(endpoints.workspace.state()),
    staleTime: 0,
  });
}

export function useRate() {
  return useQuery({
    queryKey: ['workspace', 'rate'],
    queryFn: () => api.get(endpoints.workspace.rate()),
  });
}

export function useSetRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api.put(endpoints.workspace.rate(), values),
    // Setting a rate moves someone through onboarding and re-prices the dashboard,
    // so both have to be refetched rather than showing the previous answer.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ['workspace', 'activities'],
    queryFn: () => api.get(endpoints.workspace.activities()),
  });
}

export function useCurrentAudit() {
  return useQuery({
    queryKey: ['workspace', 'audit', 'current'],
    queryFn: () => api.get(endpoints.workspace.currentAudit()),
    // Creates the week's draft server-side on first call, so it must not be
    // replayed from cache after the week rolls over.
    staleTime: 0,
  });
}

export function useSaveAudit(weekStarting) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put(endpoints.workspace.audit(weekStarting), body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['workspace', 'dashboard'],
    queryFn: () => api.get(endpoints.workspace.dashboard()),
  });
}
