import { Logo } from '../../../components/ui/Logo.jsx';

/**
 * The frame all four auth screens sit in. One h1 per page, and it is the title.
 *
 * `tabIndex={-1}` on the main element is what makes the skip link in App.jsx
 * actually work: without it the browser scrolls to the target but leaves focus in
 * the header, so the next Tab goes back to the link you just used.
 *
 * None of these screens autofocus their first field. It looks like a courtesy, but
 * it drops a screen-reader user straight into an input, past the heading and the
 * sentence underneath that say which form this is — and on a narrow screen it
 * scrolls the title out of view before anyone has read it. The form is the only
 * thing on the page; one Tab reaches it.
 */
export function AuthShell({ title, lede, children, footer }) {
  return (
    <main id="main" tabIndex={-1} className="auth-shell">
      <div className="auth-card">
        <p className="auth-card__mark">
          <Logo />
        </p>

        <h1 className="auth-card__title">{title}</h1>
        {lede ? <p className="auth-card__lede">{lede}</p> : null}

        {children}

        {footer ? <div className="auth-card__footer">{footer}</div> : null}
      </div>
    </main>
  );
}
