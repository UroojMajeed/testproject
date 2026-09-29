import { QUADRANT_COPY } from '../../lib/drip.js';
import { formatMoney, formatDuration } from '../../lib/money.js';

/**
 * The DRIP matrix, as the matrix.
 *
 * It was four blocks in a column for a while, on the argument that a quadrant
 * diagram spends its space on the axes and leaves none for the numbers. That was
 * half right: the numbers do have to be in it. So this is a real 2×2 — the axes
 * drawn and labelled, each activity sitting in the quadrant its answers put it in
 * — and every cell carries its own hours and its yearly cost, which is what turns
 * a picture into a decision.
 *
 * The rows are ordered so the two quadrants with something to do about them are
 * the top of the grid, where the eye lands first: Replace and Delegate above,
 * Produce and Invest below.
 */
const LAYOUT = [
  ['replace', 'produce'],
  ['delegate', 'invest'],
];

export function Matrix({ matrix, currency, unsortedCount }) {
  const total = Object.values(matrix).reduce((sum, q) => sum + q.count, 0);

  if (!total) {
    return (
      <section className="notice mt-6" aria-labelledby="matrix-empty">
        <h2 id="matrix-empty" className="notice__title">The matrix fills in as you answer</h2>
        <p className="notice__body">
          One question about each activity — above — and this becomes the picture of what to
          hand over, what to protect, and what to replace yourself on.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="matrix-heading" className="mt-6">
      <h2 id="matrix-heading" className="eyebrow">What to do about it</h2>

      {unsortedCount > 0 ? (
        <p className="matrix-gap">
          {unsortedCount === 1
            ? 'One activity has no answer yet, so it is not placed below.'
            : `${unsortedCount} activities have no answer yet, so they are not placed below.`}
        </p>
      ) : null}

      <div className="drip">
        {/*
          The axes are labelled rather than left implied. "High value" and "drains
          you" are the two questions that were actually asked, in the words they
          were asked in, so the grid can be checked against the answers given.
        */}
        <p className="drip__axis drip__axis--y" aria-hidden="true">
          <span>Matters more</span>
          <span>Matters less</span>
        </p>
        <p className="drip__axis drip__axis--x" aria-hidden="true">
          <span>Drains you</span>
          <span>Energises you</span>
        </p>

        <div className="drip__grid">
          {LAYOUT.flat().map((name) => {
            const quadrant = matrix[name] ?? { activities: [], count: 0, estimatedMinutes: 0, estimatedAnnualCostMinor: 0 };
            const copy = QUADRANT_COPY[name];

            return (
              <article key={name} className="drip__cell" data-quadrant={name}>
                <header className="drip__head">
                  <h3 className="drip__title">{copy.title}</h3>
                  <p className="drip__meaning">{copy.meaning}</p>
                </header>

                {quadrant.count ? (
                  <>
                    <ul className="drip__list">
                      {quadrant.activities.map((row) => (
                        <li key={row.activityId} className="drip__item">
                          <span className="drip__name">{row.name}</span>
                          <span className="drip__hours numeric">{formatDuration(row.estimatedMinutes)}</span>
                        </li>
                      ))}
                    </ul>

                    {/*
                      The totals are what stop this being a poster. "Four things
                      drain you and do not matter" is an observation; the same four
                      with hours and a yearly figure is a decision.
                    */}
                    <p className="drip__total">
                      <strong className="numeric">{formatDuration(quadrant.estimatedMinutes)}</strong> a week
                      {' · '}
                      <strong className="numeric">{formatMoney(quadrant.estimatedAnnualCostMinor, currency)}</strong> a year
                    </p>
                  </>
                ) : (
                  /* Drawn empty rather than hidden: an empty Replace quadrant is
                     itself worth seeing, and a 2×2 missing a corner is not a 2×2. */
                  <p className="drip__empty">Nothing here.</p>
                )}
                {/*
                  No action sentence in the cell. It is spelled out once in the
                  glossary under the grid, and saying it in both places made every
                  cell three lines taller for words the reader had just read.
                */}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
