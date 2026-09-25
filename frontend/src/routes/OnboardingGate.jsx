import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useWorkspaceState } from '../lib/api/hooks.js';
import { FullPageSpinner } from '../components/ui/FullPageSpinner.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { paths } from './paths.js';

/**
 * Where a signed-in person belongs right now.
 *
 * The server answers this, in one call, and the client only obeys. Inferring it
 * here instead — no rate means show the rate screen, no audit means show the
 * audit — puts the same reasoning in every guard and lets it drift from what the
 * API believes.
 *
 * The order is the flow we agreed: rate, then the first audit, then the dashboard.
 * Nobody should ever reach an empty dashboard, so the first audit is a gate. After
 * that it is a prompt, not a gate — missing a Friday must not lock someone out of
 * figures they already have.
 */
export function OnboardingGate() {
  const { data, isPending, isError, error, refetch } = useWorkspaceState();
  const location = useLocation();

  if (isPending) return <FullPageSpinner label="Working out where you are" />;

  if (isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{error?.userMessage ?? 'Could not load your workspace.'}</Alert>
        <button type="button" className="btn btn-primary" onClick={() => refetch()}>Try again</button>
      </main>
    );
  }

  /**
   * Rate, then the first week, then the first sort. Each one is only a gate until
   * it has been done once.
   */
  const wanted = data.needsRate ? paths.rate
    : data.needsFirstAudit ? paths.audit
      : data.needsFirstSort ? paths.sort
        : null;

  // Past onboarding: everything is open.
  if (!wanted) return <Outlet />;

  /**
   * The gate pushes people forward; it does not pin them to one page.
   *
   * Earlier steps stay reachable, and that is not a nicety — saving the rate
   * invalidates /state, needsFirstAudit becomes true, and a gate that allowed only
   * `wanted` redirected to the audit mid-render. The confirmation screen that
   * explains the rate is a planning estimate never appeared at all.
   *
   * So: the dashboard is what is gated. Standing on a step you have already done
   * is always allowed.
   */
  const reachable = data.needsRate
    ? [paths.rate]
    : data.needsFirstAudit
      ? [paths.rate, paths.audit]
      : [paths.rate, paths.audit, paths.sort];
  if (reachable.includes(location.pathname)) return <Outlet />;

  return <Navigate to={wanted} replace />;
}
