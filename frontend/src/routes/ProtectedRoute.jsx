import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { paths } from './paths.js';
import { FullPageSpinner } from '../components/ui/FullPageSpinner.jsx';

/**
 * Waits for the boot refresh before deciding anything.
 *
 * Redirecting while status is 'loading' would bounce an authenticated user to the
 * sign-in screen on every reload. The `from` state means they land back where they
 * were aiming once they have signed in.
 */
export function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace state={{ from: location }} />;
  return <Outlet />;
}

/** The mirror image: keeps a signed-in user off the sign-in and sign-up screens. */
export function GuestRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <FullPageSpinner label="Checking your session" />;
  if (isAuthenticated) return <Navigate to={paths.home} replace />;
  return <Outlet />;
}
