import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { paths } from '../routes/paths.js';
import { Logo } from '../components/ui/Logo.jsx';
import { initialsOf } from '../lib/formatters.js';

const NAV = [
  { to: paths.app, label: 'Dashboard', end: true },
  { to: paths.audit, label: 'Time audit' },
  { to: paths.drip, label: 'DRIP matrix' },
  { to: paths.advisor, label: 'Advisor' },
  { to: paths.delegation, label: 'Delegation', manager: true },
  { to: paths.playbooks, label: 'Playbooks' },
  { to: paths.review, label: 'Weekly review' },
  { to: paths.settings, label: 'Settings' },
];

const TITLES = {
  [paths.app]: 'Dashboard',
  [paths.audit]: 'Time audit',
  [paths.drip]: 'DRIP matrix',
  [paths.advisor]: 'Advisor',
  [paths.delegation]: 'Delegation',
  [paths.playbooks]: 'Playbooks',
  [paths.review]: 'Weekly review',
  [paths.settings]: 'Settings',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { workspace, workspaces, select, canManage } = useWorkspace();
  const { pathname } = useLocation();

  const visible = NAV.filter((item) => !item.manager || canManage);
  const title = TITLES[pathname] ?? 'ReclaimOS';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>

      <aside className="app-sidebar" aria-label="Main">
        <div className="px-3 pt-4 pb-3"><Logo /></div>

        {workspaces.length > 1 ? (
          <div className="px-3 pb-3">
            <label className="visually-hidden" htmlFor="ws-switch">Active workspace</label>
            <select
              id="ws-switch"
              className="form-select form-select-sm"
              value={workspace?.id ?? ''}
              onChange={(e) => select(e.target.value)}
              style={{ background: '#232019', color: 'var(--ground)', borderColor: '#33302a' }}
            >
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        ) : workspace && (
          <div className="px-3 pb-3">
            <div
              className="d-flex align-items-center gap-2 px-2 py-2 rounded"
              style={{ background: '#232019', border: '1px solid #33302a' }}
            >
              <span className="rounded flex-shrink-0" style={{ width: 20, height: 20, background: 'var(--drip-production)' }} aria-hidden="true" />
              <span className="fs-ui-sm text-truncate" style={{ color: 'var(--ground)' }}>{workspace.name}</span>
            </div>
          </div>
        )}

        <nav className="px-2 flex-grow-1" aria-label="Sections">
          <ul className="list-unstyled mb-0 stack gap-1">
            {visible.map(({ to, label, end }) => (
              <li key={label}>
                <NavLink to={to} end={end} className="d-flex align-items-center px-3 py-2 rounded fs-ui">
                  {label}
                </NavLink>
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
          <span className="stack flex-grow-1" style={{ minWidth: 0 }}>
            <span className="fs-ui-sm text-truncate" style={{ color: 'var(--ground)' }}>{user?.name}</span>
            <span className="fs-caption text-capitalize" style={{ color: '#a8a093' }}>{workspace?.role ?? 'member'}</span>
          </span>
        </div>
      </aside>

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <header className="d-flex align-items-center gap-3 px-3 px-sm-4 py-3 bg-white border-bottom">
          <h1 className="fs-body fw-semibold mb-0">{title}</h1>
          <button type="button" className="btn btn-quiet fs-ui ms-auto" onClick={logout}>Sign out</button>
        </header>

        {/* A phone gets a bottom tab bar rather than a hidden sidebar. */}
        <nav className="d-lg-none border-bottom bg-white px-2 py-1 overflow-auto" aria-label="Sections">
          <ul className="list-unstyled d-flex gap-1 mb-0" style={{ whiteSpace: 'nowrap' }}>
            {visible.map(({ to, label, end }) => (
              <li key={label}>
                <NavLink
                  to={to} end={end}
                  className={({ isActive }) =>
                    `btn ${isActive ? 'btn-outline-ink' : 'btn-quiet'} fs-ui-sm py-1 px-2`}
                  style={{ minHeight: '2.25rem' }}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="flex-grow-1 p-3 p-sm-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
