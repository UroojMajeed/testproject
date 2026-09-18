import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { paths } from './paths.js';
import { FullPageSpinner } from '../components/ui/FullPageSpinner.jsx';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner label="Restoring your session" />;

  if (!isAuthenticated) {
    // `from` is preserved so sign-in returns the user where they were headed.
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner label="Loading" />;
  if (isAuthenticated) return <Navigate to={paths.app} replace />;
  return <Outlet />;
}
