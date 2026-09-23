import { useContext } from 'react';
import { AuthContext } from './authContext.js';

/** Who is signed in, and the calls that change that. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
