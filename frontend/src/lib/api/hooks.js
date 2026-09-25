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

export function useUnsortedActivities() {
  return useQuery({
    queryKey: ['workspace', 'activities', 'unsorted'],
    queryFn: () => api.get(endpoints.workspace.unsortedActivities()),
    // The sort screen works through this list; a stale copy would re-ask about
    // something already answered.
    staleTime: 0,
  });
}

/**
 * Saves one answer.
 *
 * Deliberately invalidates nothing. The sort screen saves each choice as it is
 * made, and refetching the list between cards would reorder the deck under the
 * reader's hand. The screen invalidates once, when it is finished.
 */
export function useSetActivityValue() {
  return useMutation({
    mutationFn: ({ id, value }) => api.put(endpoints.workspace.activityValue(id), { value }),
  });
}

/** Called when the sort screen is done, so state and the dashboard catch up. */
export function useRefreshWorkspace() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['workspace'] });
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
