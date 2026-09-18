import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { paths } from './paths.js';

/**
 * A signed-in account with no workspace, or an unfinished one, belongs in the
 * wizard rather than in an app shell with nothing to show.
 */
export function OnboardingGate() {
  const { workspaces } = useAuth();
  const active = workspaces[0];

  if (!active || !active.onboarding?.completedAt) return <Navigate to={paths.onboarding} replace />;
  return <Outlet />;
}

/** The mirror: keeps a finished account out of the wizard. */
export function OnboardingOnly() {
  const { workspaces } = useAuth();
  const active = workspaces[0];

  if (active?.onboarding?.completedAt) return <Navigate to={paths.app} replace />;
  return <Outlet />;
}
