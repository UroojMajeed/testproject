import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { paths } from '../routes/paths.js';
import { Logo } from '../components/ui/Logo.jsx';
import { initialsOf } from '../lib/formatters.js';

const NAV = [
  { to: paths.app, label: 'Dashboard', end: true },
  { to: '/app/audit', label: 'Time Audit', soon: true },
  { to: '/app/drip', label: 'DRIP Matrix', soon: true },
  { to: '/app/advisor', label: 'AI Advisor', soon: true },
  { to: '/app/delegation', label: 'Delegation', soon: true },
  { to: '/app/playbooks', label: 'Playbooks', soon: true },
];

export function AppLayout() {
  const { user, workspaces, logout } = useAuth();
  const workspace = workspaces[0];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>

      <aside className="app-sidebar" aria-label="Main">
        <div className="px-3 pt-4 pb-3"><Logo /></div>

        {workspace && (
          <div className="px-3 pb-3">
            <div
              className="d-flex align-items-center gap-2 px-2 py-2 rounded"
              style={{ background: '#232019', border: '1px solid #33302a' }}
            >
              <span
                className="rounded"
                style={{ width: 20, height: 20, background: 'var(--drip-production)' }}
                aria-hidden="true"
              />
              <span className="fs-ui-sm text-truncate" style={{ color: 'var(--ground)' }}>
                {workspace.name}
              </span>
            </div>
          </div>
        )}

        <nav className="px-2 flex-grow-1" aria-label="Sections">
          <ul className="list-unstyled mb-0 stack gap-1">
            {NAV.map(({ to, label, end, soon }) => (
              <li key={label}>
                {soon ? (
                  <span
                    className="d-flex align-items-center px-3 py-2 rounded fs-ui"
                    style={{ color: '#6f6a60', cursor: 'not-allowed' }}
                    title="Arrives in a later phase"
                  >
                    {label}
                  </span>
                ) : (
                  <NavLink to={to} end={end} className="d-flex align-items-center px-3 py-2 rounded fs-ui">
                    {label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 d-flex align-items-center gap-2" style={{ borderTop: '1px solid #33302a' }}>
          <span
            className="rounded-circle d-flex align-items-center justify-content-center fs-caption fw-semibold flex-shrink-0"
            style={{ width: 28, height: 28, background: '#3a352c', color: 'var(--ground)' }}
            aria-hidden="true"
          >
            {initialsOf(user?.name)}
          </span>
          <span className="stack flex-grow-1 min-w-0">
            <span className="fs-ui-sm text-truncate" style={{ color: 'var(--ground)' }}>{user?.name}</span>
            <span className="fs-caption" style={{ color: '#a8a093' }}>{workspace?.role ?? 'member'}</span>
          </span>
        </div>
      </aside>

      <div className="flex-grow-1 d-flex flex-column min-w-0">
        <header className="d-flex align-items-center gap-3 px-4 py-3 bg-white border-bottom">
          <h1 className="fs-body fw-semibold mb-0">Dashboard</h1>
          <div className="ms-auto d-flex align-items-center gap-2">
            <button type="button" className="btn btn-quiet fs-ui" onClick={logout}>Sign out</button>
          </div>
        </header>

        <main id="main" className="flex-grow-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
