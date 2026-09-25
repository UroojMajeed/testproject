import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useWorkspaceState } from '../../lib/api/hooks.js';
import { NAV } from '../../routes/nav.jsx';

/**
 * The frame the signed-in app lives in.
 *
 * Until now every screen was somewhere you were *sent* — rate, then audit, then
 * sort, then the dashboard — so nothing ever needed a way to go anywhere, and
 * nothing had one. That is fine for a funnel and wrong for an app.
 *
 * One rule decides whether the frame appears: the first run does not get it.
 * A sidebar offering three destinations in the middle of a three-step setup
 * invites people to wander out of it, and there is nothing worth visiting yet
 * anyway. The moment onboarding is done, every page is inside the frame.
 *
 * The pages keep their own `<main id="main">`. The layout supplies everything
 * around it, which leaves exactly one main landmark on the page — the invariant
 * landmarks.test.jsx exists to defend.
 */
export function AppLayout() {
  const { data, isPending } = useWorkspaceState();
  const { user, logout } = useAuth();

  // The gate is reading the same query, so this resolves with it rather than
  // flashing a frame around a screen that is about to be redirected away.
  const onboarding = isPending
    || Boolean(data?.needsRate || data?.needsFirstAudit || data?.needsFirstSort);

  if (onboarding) {
    return (
      <>
        {/*
          The mark takes the gutter, not a wrapper around the outlet: the page
          below supplies its own .page-width, and nesting one inside another
          applies the max-width and the side padding twice.
        */}
        <p className="bare-mark page-width"><Logo /></p>
        <Outlet />
      </>
    );
  }

  return (
    <div className="shell">
      <div className="shell__brand"><Logo /></div>

      {/*
        One nav element, moved by CSS rather than rendered twice: a left rail on a
        desk, a fixed bar along the bottom on a phone. Two copies would put every
        destination in the accessibility tree twice, and a screen reader would read
        the hidden one.
      */}
      <nav className="shell__nav" aria-label="Sections">
        <ul className="shell__list">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                // NavLink sets aria-current="page" itself, which is what actually
                // tells a screen reader where it is. The class only carries the
                // weight and the rule, for the people who can see them.
                className={({ isActive }) => `shell__link${isActive ? ' is-current' : ''}`}
              >
                <svg className="shell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  {item.icon}
                </svg>
                <span className="shell__label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/*
        The foot of the rail on a desk, the right of the top bar on a phone. Kept
        out of the nav element because it is not a section of the app, and a
        screen reader listing the navigation should hear three destinations rather
        than three destinations and a theme button.
      */}
      <div className="shell__account">
        <p className="shell__who">Signed in as <strong>{user?.name ?? 'you'}</strong></p>
        <div className="shell__account-actions">
          <ThemeToggle />
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="shell__body">
        <Outlet />
      </div>
    </div>
  );
}
