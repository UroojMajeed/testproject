import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';

const WorkspaceContext = createContext(null);
const LAST_KEY = 'reclaimos:lastWorkspace';

/**
 * Holds the active workspace. Its id goes on every request as X-Workspace-Id,
 * and the server independently verifies membership — this is a convenience, not
 * an authorisation decision.
 */
export function WorkspaceProvider({ children }) {
  const { workspaces, user } = useAuth();
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!workspaces.length) { setActiveId(null); return; }
    const remembered = safeRead();
    const match = workspaces.find((w) => w.id === remembered)
      ?? workspaces.find((w) => w.id === user?.defaultWorkspaceId)
      ?? workspaces[0];
    setActiveId(match.id);
  }, [workspaces, user?.defaultWorkspaceId]);

  const select = useCallback((id) => {
    setActiveId(id);
    safeWrite(id);
  }, []);

  const workspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId],
  );

  const value = useMemo(
    () => ({
      workspace,
      workspaceId: workspace?.id ?? null,
      workspaces,
      select,
      currency: workspace?.currency ?? 'USD',
      buybackRateMinor: workspace?.buybackRate?.amountMinor ?? 0,
      canManage: ['owner', 'manager'].includes(workspace?.role),
      isOwner: workspace?.role === 'owner',
    }),
    [workspace, workspaces, select],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}

/**
 * Remembering which workspace was open is a per-browser convenience, not
 * session data — it is the one thing this app keeps in browser storage, and it
 * is useless to anyone who steals it.
 */
function safeRead() {
  try { return window.localStorage.getItem(LAST_KEY); } catch { return null; }
}
function safeWrite(id) {
  try { window.localStorage.setItem(LAST_KEY, id); } catch { /* private mode */ }
}
