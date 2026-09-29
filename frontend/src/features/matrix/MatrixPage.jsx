import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { Matrix } from '../dashboard/Matrix.jsx';
import { NeedsAnswer } from '../dashboard/NeedsAnswer.jsx';
import { useDashboard } from '../../lib/api/hooks.js';
import { QUADRANT_COPY, QUADRANT_ORDER } from '../../lib/drip.js';
import { paths } from '../../routes/paths.js';

/**
 * The matrix, with the explanation it never had room for.
 *
 * It used to sit halfway down the week, between a table and a verdict, where a
 * 2×2 is just another block to scroll past. Given its own section it can say what
 * it is: two questions, four answers, and a different thing to do about each —
 * which is the whole idea the product is built on and the one nobody arrives
 * already knowing.
 *
 * The week keeps the figures; this keeps the reasoning.
 */
export default function MatrixPage() {
  const { data, isPending, isError, error } = useDashboard();

  if (isPending) return <FullPageSpinner label="Placing your activities" />;

  if (isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{error?.userMessage ?? 'Could not load your matrix.'}</Alert>
      </main>
    );
  }

  const { matrix, rate, unsortedCount, week } = data;

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <header className="app-header">
        <div>
          <h1 className="app-header__title">The matrix</h1>
          <p className="app-header__subtitle">
            Two questions about each activity, and four different things to do about the answers.
          </p>
        </div>
      </header>

      {!week ? (
        <section className="notice">
          <h2 className="notice__title">Nothing to place yet</h2>
          <p className="notice__body mb-4">
            The matrix is built from a recorded week. Record one and every activity in it
            lands in a quadrant.
          </p>
          <Link to={paths.audit} className="btn btn-primary">Record a week</Link>
        </section>
      ) : (
        <>
          {/*
            The explanation first, and only here. On the week it would be four
            paragraphs between somebody and their figures; on its own page it is
            the reason the page exists.
          */}
          <section className="explain" aria-labelledby="explain-heading">
            <h2 id="explain-heading" className="explain__title">How an activity gets placed</h2>

            <ol className="explain__axes">
              <li>
                <span className="explain__axis">How it felt</span>
                <span className="explain__detail">
                  Answered every week, because it changes. Averaged across the weeks you have
                  recorded, so one bad Tuesday does not decide anything.
                </span>
              </li>
              <li>
                <span className="explain__axis">What it is worth</span>
                <span className="explain__detail">
                  Answered once — “if you stopped for a month, what happens?” — because it
                  barely changes. That is what keeps the weekly habit to two questions.
                </span>
              </li>
            </ol>

            <p className="explain__why">
              The distinction the whole thing exists for is <strong>Delegate against Replace</strong>.
              Both drain you and look identical on a timesheet: one goes to a VA on Friday, the
              other is a hire that breaks the business if it goes to the wrong person.
            </p>
          </section>

          <NeedsAnswer />

          <Matrix matrix={matrix} currency={rate.currency} unsortedCount={unsortedCount} />

          <section className="explain mt-6" aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="explain__title">What each one means</h2>
            <dl className="explain__quadrants">
              {QUADRANT_ORDER.map((name) => (
                <div key={name} className="explain__quadrant" data-quadrant={name}>
                  <dt>{QUADRANT_COPY[name].title}</dt>
                  <dd>
                    <span className="explain__meaning">{QUADRANT_COPY[name].meaning}</span>
                    <span className="explain__action">{QUADRANT_COPY[name].action}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="explain__why">
              The two that drain you carry a decision, so they are the ones the{' '}
              <Link to={paths.handover}>handover roadmap</Link> is built from.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
