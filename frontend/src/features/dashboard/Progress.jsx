import { formatDuration, formatMoney } from '../../lib/money.js';

/**
 * What is changing, rather than what is true this week.
 *
 * A single week's figures are a fact; two weeks are a direction, and a direction is
 * the only thing that tells somebody whether any of this is working. Everything
 * here is computed from weeks already on record — no new endpoint, and no figure
 * that is not derived from what was actually filed.
 *
 * Draining hours are the headline rather than total hours: the goal was never to
 * work less, it was to spend less of the week on the parts that cost you something
 * to do.
 */
export function Progress({ weeks, rate, currency }) {
  // Newest first from the API; `complete` only, and atypical weeks are excluded
  // from the comparison for the same reason they are excluded from the headline.
  const usable = weeks.filter((week) => week.isTypical);
  const [latest, previous] = usable;

  if (!latest) return null;

  const draining = (week) => week.entries
    .filter((entry) => entry.energy < 0)
    .reduce((sum, entry) => sum + entry.estimatedMinutes, 0);

  const nowDraining = draining(latest);
  const wasDraining = previous ? draining(previous) : null;
  const change = wasDraining === null ? null : nowDraining - wasDraining;

  const annual = (minutes) =>
    Math.round((minutes / 60) * rate.rateMinorPerHour * rate.weeksPerYear);

  return (
    <section className="progress" aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="eyebrow">How it is going</h2>

      <div className="progress__cards">
        <article className="progress-card">
          <p className="progress-card__label">Weeks on record</p>
          <p className="progress-card__value numeric">{usable.length}</p>
          <p className="progress-card__note">
            {usable.length === 1
              ? 'One more and this page starts showing a direction.'
              : 'Enough to compare one week against another.'}
          </p>
        </article>

        <article className="progress-card" data-trend={change === null ? 'none' : change < 0 ? 'down' : change > 0 ? 'up' : 'flat'}>
          <p className="progress-card__label">Draining hours this week</p>
          <p className="progress-card__value numeric">{formatDuration(nowDraining)}</p>
          <p className="progress-card__note">
            {change === null
              ? 'No earlier week to compare against yet.'
              : change === 0
                ? 'Exactly the same as the week before.'
                /* Down is the win, and it is said in hours rather than a percentage:
                   "two hours less" is a thing somebody can picture. */
                : `${formatDuration(Math.abs(change))} ${change < 0 ? 'less' : 'more'} than the week before.`}
          </p>
        </article>

        <article className="progress-card">
          <p className="progress-card__label">A year of those hours</p>
          <p className="progress-card__value numeric">{formatMoney(annual(nowDraining), currency)}</p>
          <p className="progress-card__note">
            What the draining part of your week costs over {rate.weeksPerYear} weeks, at your rate.
          </p>
        </article>
      </div>
    </section>
  );
}
