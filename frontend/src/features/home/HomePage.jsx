import { useAuth } from '../../context/useAuth.js';
import { formatDate } from '../../lib/formatters.js';
import { Logo } from '../../components/ui/Logo.jsx';
import { ThemeToggle } from '../../components/ui/ThemeToggle.jsx';

/**
 * Deliberately almost empty.
 *
 * Step 1 is authentication, so this proves the session works and says what comes
 * next. Filling it with a dashboard of numbers we cannot compute yet is how the
 * previous attempt at this project got away from us.
 */
export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      {/* A way back to the front page. Without it the only route out of the
          signed-in area is the address bar, which is not a route. */}
      <div className="site-bar">
        <Logo />
        <div className="site-bar__nav">
          <ThemeToggle />
          <button type="button" className="btn btn-outline-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <header className="app-header">
        <div>
          <h1 className="app-header__title">Hello, {user?.name}</h1>
          <p className="app-header__subtitle">You are signed in as {user?.email}.</p>
        </div>
      </header>

      <section className="notice">
        <h2 className="notice__title">Step 1 of the build is done</h2>
        <p className="notice__body">
          Sign up, sign in, sign out, session refresh and password reset all work end to end. Nothing else has
          been built yet — that is on purpose. The next step gets agreed before it gets written.
        </p>
      </section>

      <dl className="facts">
        <dt>Account created</dt>
        <dd>{formatDate(user?.createdAt) || '—'}</dd>

        <dt>Email</dt>
        <dd>{user?.emailVerified ? 'Verified' : 'Not verified yet'}</dd>

        <dt>Timezone</dt>
        <dd>{user?.timezone ?? '—'}</dd>
      </dl>
    </main>
  );
}
