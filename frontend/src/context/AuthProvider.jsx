import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, refreshSession } from '../lib/apiClient.js';
import { endpoints } from '../lib/api/endpoints.js';
import { setAccessToken, clearAccessToken } from '../lib/tokenStore.js';
import { AuthContext } from './authContext.js';

/**
 * Who is signed in, and the four calls that change that.
 *
 * The one piece worth explaining is `status`. Because the access token lives in
 * memory, a page reload always starts signed out — the httpOnly refresh cookie is
 * the only evidence a session exists, and only the server can read it. So on boot
 * we POST /auth/refresh once and wait.
 *
 * Until that answers, the app is neither signed in nor signed out; it is
 * 'loading'. Rendering the sign-in screen during that moment would flash the
 * login form at somebody who is already authenticated, which is the single most
 * common bug in this pattern. ProtectedRoute waits for 'ready' instead.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready'
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await refreshSession();
      if (cancelled) return;
      setUser(session?.user ?? null);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Both sign up and sign in end here: token into memory, user into state. */
  const adopt = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('ready');
    return session.user;
  }, []);

  const register = useCallback(
    async (values) => adopt(await api.post(endpoints.auth.register(), values, { auth: false })),
    [adopt],
  );

  const login = useCallback(
    async (values) => adopt(await api.post(endpoints.auth.login(), values, { auth: false })),
    [adopt],
  );

  const logout = useCallback(async () => {
    try {
      await api.post(endpoints.auth.logout());
    } catch {
      // Swallowed, not rethrown. Signing out is the one action that must always
      // appear to succeed: if the server is unreachable, the alternative is
      // leaving somebody on a signed-in screen with a token still in memory,
      // which is worse than a refresh cookie we failed to revoke. The cookie
      // expires on its own, and the next sign in rotates it anyway.
    }
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: Boolean(user),
      register,
      login,
      logout,
    }),
    [status, user, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
