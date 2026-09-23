import { Link } from 'react-router-dom';
import { paths } from '../../routes/paths.js';
import { Logo } from '../../components/ui/Logo.jsx';
import { useAuth } from '../../context/useAuth.js';
import { ThemeToggle } from '../../components/ui/ThemeToggle.jsx';

/**
 * The public front door.
 *
 * Its whole job is to say what this is and route you to the right form, so the
 * page is one screen of reading and two buttons. Everything below the fold is
 * there to answer "how" for the person who is not ready to click yet.
 *
 * The copy is deliberately honest about what exists. Describing a dashboard we
 * have not built would make the first signed-in screen a letdown, and the note at
 * the bottom says plainly where the build has got to.
 */

const LOOP = [
  ['Audit', 'Your week, grouped into about a dozen repeating activities — not four hundred calendar entries.'],
  ['Decide', 'Ten minutes of sorting shows what drains you, and what an hour of it costs at your own rate.'],
  ['Transfer', 'Automate it, hand it over with a written playbook, or keep it and be asked again next quarter.'],
  ['Measure', 'Before and after are compared from your own entries, so the hours you got back are counted, not claimed.'],
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing">
      <header className="page-width site-bar">
        {/* Plain, not a link: it would point at this very page. */}
        <Logo as="plain" />

        <nav className="site-bar__nav" aria-label="Account">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link to={paths.app} className="btn btn-primary">Go to your account</Link>
          ) : (
            <>
              <Link to={paths.login} className="btn btn-link">Sign in</Link>
              <Link to={paths.register} className="btn btn-primary">Start free</Link>
            </>
          )}
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="page-width landing__hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading" className="landing__headline">
            Stop spending your best hours on work that someone — or something — else could do.
          </h1>

          <p className="landing__lede">
            ReclaimOS finds the work eating your week, prices it at your own rate, helps you hand it off,
            and then proves how much of it actually came back.
          </p>

          <div className="landing__actions">
            <Link to={paths.register} className="btn btn-primary btn-lg">Create your account</Link>
            {/*
              An in-page anchor rather than a button: it moves the reader down the
              document, so the browser's own behaviour — including back, and the
              heading landmark it lands on — is the right one.
            */}
            <a href="#how" className="btn btn-outline-secondary btn-lg">See how it works</a>
          </div>

          <p className="landing__note">Ten minutes to a first result. No two-week tracking period first.</p>
        </section>

        <section id="how" className="page-width landing__section" aria-labelledby="how-heading">
          <h2 id="how-heading" className="eyebrow">The loop</h2>

          {/* An ordered list because the order is the point — these are four steps. */}
          <ol className="landing__steps">
            {LOOP.map(([title, body], index) => (
              <li key={title} className="landing__step">
                <span className="landing__step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="landing__step-title">{title}</h3>
                <p className="landing__step-body">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="page-width landing__section" aria-labelledby="built-heading">
          <div className="landing__panel">
            <h2 id="built-heading" className="landing__panel-title">What works today</h2>
            <p className="landing__panel-body">
              This is being built one step at a time, in the open. Right now that means accounts: sign up,
              sign in, sessions that survive a reload, and password reset. The audit and everything after it
              come next, and nothing above is switched on until it is real.
            </p>
            <Link to={paths.register} className="btn btn-primary">Create your account</Link>
          </div>
        </section>

      </main>

      <footer className="page-width landing__footer">
        <p className="mb-0">
          ReclaimOS — step 1 of the build. Every figure the product shows is computed from your own data.
        </p>
      </footer>
    </div>
  );
}
