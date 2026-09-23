import { Link } from 'react-router-dom';

/**
 * The frame all four auth screens sit in. One h1 per page, and it is the title.
 *
 * None of these screens autofocus their first field. It looks like a courtesy, but
 * it drops a screen-reader user straight into an input, past the heading and the
 * sentence underneath that say which form this is — and on a narrow screen it
 * scrolls the title out of view before anyone has read it. The form is the only
 * thing on the page; one Tab reaches it.
 */
export function AuthShell({ title, lede, children, footer }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="mb-4" style={{ fontWeight: 600, color: 'var(--brand-text)' }}>
          <Link to="/" className="text-decoration-none">ReclaimOS</Link>
        </p>

        <h1 className="auth-card__title">{title}</h1>
        {lede ? <p className="auth-card__lede">{lede}</p> : null}

        {children}

        {footer ? <div className="auth-card__footer">{footer}</div> : null}
      </div>
    </main>
  );
}
