import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setUnauthenticatedHandler } from '../lib/apiClient.js';
import { setAccessToken, clearAccessToken } from '../lib/tokenStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  // 'loading' until the silent refresh settles, so guarded routes never flash
  // the login page for an already-signed-in user.
  const [status, setStatus] = useState('loading');

  const signOutLocally = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setWorkspaces([]);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => setUnauthenticatedHandler(signOutLocally), [signOutLocally]);

  // On boot the access token is gone (it only lived in memory), but the refresh
  // cookie may still be valid — so try once to restore the session.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await api.refreshSession();
        const data = await api.get('/auth/me');
        if (cancelled) return;
        setUser(data.user);
        setWorkspaces(data.workspaces ?? []);
        setStatus('authenticated');
      } catch {
        if (!cancelled) signOutLocally();
      }
    })();

    return () => { cancelled = true; };
  }, [signOutLocally]);

  const adoptSession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    setWorkspaces(data.workspaces ?? []);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (credentials) => {
    adoptSession(await api.post('/auth/login', credentials));
  }, [adoptSession]);

  const register = useCallback(async (payload) => {
    adoptSession(await api.post('/auth/register', payload));
  }, [adoptSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      signOutLocally();
    }
  }, [signOutLocally]);

  const addWorkspace = useCallback((workspace) => {
    setWorkspaces((prev) => [...prev.filter((w) => w.id !== workspace.id), workspace]);
  }, []);

  const value = useMemo(
    () => ({
      user,
      workspaces,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      addWorkspace,
    }),
    [user, workspaces, status, login, register, logout, addWorkspace],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
