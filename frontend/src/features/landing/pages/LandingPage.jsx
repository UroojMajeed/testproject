import { Link } from 'react-router-dom';
import { paths } from '../../../routes/paths.js';
import { Logo } from '../../../components/ui/Logo.jsx';

const LOOP = [
  ['Audit', 'Connect a calendar. We group your week into about a dozen repeating activities.'],
  ['Decide', 'Ten minutes of sorting shows what drains you — and what it costs at your own rate.'],
  ['Transfer', 'Automate it, hand it over with a ready playbook, or keep it and be asked again later.'],
  ['Measure', 'We compare your time entries before and after, and report what actually came back.'],
];

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="d-flex align-items-center gap-3 px-4 py-3">
        <Logo />
        <nav className="ms-auto d-flex align-items-center gap-2" aria-label="Account">
          <Link to={paths.login} className="btn btn-quiet fs-ui">Sign in</Link>
          <Link to={paths.register} className="btn btn-primary fs-ui">Start free</Link>
        </nav>
      </header>

      <main id="main">
        <section className="px-4 py-5" aria-labelledby="hero">
          <div className="mx-auto" style={{ maxWidth: 820 }}>
            <h1 id="hero" className="display-serif mb-3" style={{ fontSize: 'clamp(2.25rem, 6vw, 3.25rem)' }}>
              Stop spending your best hours on work someone — or something — else can do.
            </h1>
            <p className="fs-lead text-muted-2 max-ch mb-4">
              ReclaimOS finds the work consuming your time, prices it at your own rate, helps you hand
              it off, and then proves how much of it actually came back.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Link to={paths.register} className="btn btn-primary">Start your time audit</Link>
              <a href="#loop" className="btn btn-outline-ink">See how it works</a>
            </div>
            <p className="fs-caption text-muted-3 mt-3 mb-0">
              Ten minutes to your first result. No two-week tracking period.
            </p>
          </div>
        </section>

        <section id="loop" className="px-4 py-5" aria-labelledby="loop-heading">
          <div className="mx-auto" style={{ maxWidth: 980 }}>
            <h2 id="loop-heading" className="eyebrow mb-4">The loop</h2>
            <ol className="row g-3 list-unstyled mb-0">
              {LOOP.map(([title, body], i) => (
                <li key={title} className="col-12 col-md-6 col-lg-3">
                  <div className="surface p-3 h-100 stack gap-2">
                    <span className="numeral fs-caption text-muted-3">0{i + 1}</span>
                    <h3 className="fs-body fw-semibold mb-0" style={{ fontFamily: 'inherit' }}>{title}</h3>
                    <p className="fs-ui text-muted-2 mb-0">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="px-4 py-4 border-top">
        <p className="fs-caption text-muted-3 mb-0">
          ReclaimOS — design phase build. Figures shown in the product are computed from your own data.
        </p>
      </footer>
    </>
  );
}
