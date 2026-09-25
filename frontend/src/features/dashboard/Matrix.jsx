import { Link } from 'react-router-dom';
import { QUADRANT_COPY, QUADRANT_ORDER } from '../sort/value.js';
import { formatMoney, formatDuration } from '../../lib/money.js';
import { paths } from '../../routes/paths.js';

/**
 * The DRIP matrix, as four blocks rather than a 2×2 grid.
 *
 * A quadrant diagram looks like the book and reads like a poster: it spends its
 * space on the axes and leaves no room for the activities or the totals, which are
 * the parts worth anything. Four blocks in priority order says the same thing and
 * has somewhere to put the numbers.
 *
 * Replace and Delegate come first because they are the two with something to do
 * about them.
 */
export function Matrix({ matrix, currency, unsortedCount }) {
  const populated = QUADRANT_ORDER.filter((name) => matrix[name]?.count > 0);

  if (!populated.length) {
    return (
      <section className="notice" aria-labelledby="matrix-empty">
        <h2 id="matrix-empty" className="notice__title">Nothing sorted yet</h2>
        <p className="notice__body mb-4">
          Answer one question about each activity and this becomes the picture of what to hand over,
          what to protect, and what to replace yourself on.
        </p>
        <Link to={paths.sort} className="btn btn-primary">Sort your activities</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="matrix-heading" className="mt-6">
      <h2 id="matrix-heading" className="eyebrow">What to do about it</h2>

      {unsortedCount > 0 ? <PartialPicture unsortedCount={unsortedCount} /> : null}

      <div className="quadrants">
        {populated.map((name) => {
          const quadrant = matrix[name];
          const copy = QUADRANT_COPY[name];

          return (
            <article key={name} className="quadrant" data-quadrant={name}>
              <header className="quadrant__head">
                <h3 className="quadrant__title">{copy.title}</h3>
                <p className="quadrant__meaning">{copy.meaning}</p>
              </header>

              <ul className="quadrant__list">
                {quadrant.activities.map((row) => (
                  <li key={row.activityId} className="quadrant__item">
                    <span className="quadrant__name">{row.name}</span>
                    <span className="quadrant__hours numeric">{formatDuration(row.estimatedMinutes)}</span>
                  </li>
                ))}
              </ul>

              {/*
                The totals are what stop this being a poster. "Four things drain
                you and do not matter" is an observation; the same four with hours
                and a yearly figure is a decision.
              */}
              <p className="quadrant__total">
                <strong className="numeric">{formatDuration(quadrant.estimatedMinutes)}</strong> a week
                {' · '}
                <strong className="numeric">{formatMoney(quadrant.estimatedAnnualCostMinor, currency)}</strong> a year
              </p>

              <p className="quadrant__action">{copy.action}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Shown when some activities still have no answer, so the picture is partial. */
function PartialPicture({ unsortedCount }) {
  return (
    <p className="matrix-gap">
      {unsortedCount === 1
        ? 'One activity has no answer yet, so it is missing from this.'
        : `${unsortedCount} activities have no answer yet, so they are missing from this.`}
      {' '}
      <Link to={paths.sort}>Sort them</Link>
    </p>
  );
}
