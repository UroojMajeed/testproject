import { useAuth } from '../../context/useAuth.js';
import { formatDate } from '../../lib/formatters.js';
import { Logo } from '../../components/ui/Logo.jsx';

/**
 * Deliberately almost empty.
 *
 * Step 1 is authentication, so this proves the session works and says what comes
 * next. Filling it with a dashboard of numbers we cannot compute yet is how the
 * last attempt at this project got away from us.
 */
export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main id="main" tabIndex={-1} className="container py-5" style={{ maxWidth: '44rem' }}>
      {/* A way back to the front page. Without it the only route out of the signed-in
          area is the browser's address bar, which is not a route. */}
      <p className="mb-5"><Logo /></p>

      <header className="d-flex flex-wrap gap-3 justify-content-between align-items-start mb-5">
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>Hello, {user?.name}</h1>
          <p className="mb-0" style={{ color: 'var(--ink-muted)' }}>
            You are signed in as {user?.email}.
          </p>
        </div>

        <button type="button" className="btn btn-outline-secondary" onClick={logout}>
          Sign out
        </button>
      </header>

      <section
        className="p-4"
        style={{
          background: 'var(--brand-wash)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Step 1 of the build is done</h2>
        <p className="mb-0" style={{ color: 'var(--ink-muted)' }}>
          Sign up, sign in, sign out, session refresh and password reset all work end to end. Nothing else has
          been built yet — that is on purpose. The next step gets agreed before it gets written.
        </p>
      </section>

      <dl className="row mt-5 mb-0" style={{ fontSize: 'var(--text-sm)' }}>
        <dt className="col-sm-4" style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>Account created</dt>
        <dd className="col-sm-8">{formatDate(user?.createdAt) || '—'}</dd>

        <dt className="col-sm-4" style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>Email</dt>
        <dd className="col-sm-8">
          {user?.emailVerified ? 'Verified' : 'Not verified yet'}
        </dd>

        <dt className="col-sm-4" style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>Timezone</dt>
        <dd className="col-sm-8 mb-0">{user?.timezone ?? '—'}</dd>
      </dl>
    </main>
  );
}
