import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { useDashboard, useWorkspaceState } from '../../lib/api/hooks.js';
import { useAuth } from '../../context/useAuth.js';
import { formatMoney, formatDuration, formatWeekRange } from '../../lib/money.js';
import { energyLabel } from '../audit/energy.js';
import { Matrix } from './Matrix.jsx';
import { QUADRANT_COPY } from '../sort/value.js';
import { paths } from '../../routes/paths.js';

/**
 * What last week cost.
 *
 * Every figure here says "estimated" somewhere near it, because every figure here
 * came from somebody's memory. The product will hold measured numbers beside these
 * later and the two must never be read as the same thing.
 *
 * It ends by pointing at one activity and asking a question. A diagnosis with no
 * treatment is how a tool like this loses people — they see a large number, feel
 * worse, and close the tab.
 */
export default function DashboardPage() {
  const { data, isPending, isError, error } = useDashboard();
  const { data: state } = useWorkspaceState();
  const { user } = useAuth();

  if (isPending) return <FullPageSpinner label="Adding up your week" />;

  if (isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{error?.userMessage ?? 'Could not load your figures.'}</Alert>
      </main>
    );
  }

  const { week, rate, activities, totals, worst, weeksRecorded, matrix, unsortedCount } = data;
  const currency = rate.currency;

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <header className="app-header">
        <div>
          <h1 className="app-header__title">Hello, {user?.name?.split(' ')[0]}</h1>
          <p className="app-header__subtitle">
            {week
              ? `Week of ${formatWeekRange(week.weekStarting, week.weekEnding)}`
              : 'No week recorded yet.'}
          </p>
        </div>
      </header>

      {state?.currentWeekFiled === false && weeksRecorded > 0 ? (
        <Alert tone="info" className="mb-5">
          This week is not filed yet. <Link to={paths.audit}>Two minutes — last week is pre-filled.</Link>
        </Alert>
      ) : null}

      {!week ? (
        <section className="notice">
          <h2 className="notice__title">Nothing to add up yet</h2>
          <p className="notice__body mb-4">Once you file a week, this is where it gets priced.</p>
          <Link to={paths.audit} className="btn btn-primary">Record last week</Link>
        </section>
      ) : (
        <>
          <section className="figures" aria-label="Last week in total">
            <div className="figure-card">
              <p className="figure-card__label">Hours accounted for</p>
              <p className="figure-card__value numeric">{formatDuration(totals.estimatedMinutes)}</p>
              <p className="figure-card__note">estimated, from your recall</p>
            </div>

            <div className="figure-card">
              <p className="figure-card__label">What that week cost</p>
              <p className="figure-card__value numeric">
                {formatMoney(totals.estimatedWeeklyCostMinor, currency)}
              </p>
              <p className="figure-card__note">at your buyback rate</p>
            </div>

            <div className="figure-card figure-card--lead">
              <p className="figure-card__label">Over a year</p>
              <p className="figure-card__value numeric">
                {formatMoney(totals.estimatedAnnualCostMinor, currency)}
              </p>
              <p className="figure-card__note">if every week looked like this one</p>
            </div>
          </section>

          {!week.isTypical ? (
            <Alert tone="info">
              You marked this week unusual, so it is shown but not used as the yardstick.
            </Alert>
          ) : null}

          <section aria-labelledby="ranked-heading" className="mt-6">
            <h2 id="ranked-heading" className="eyebrow">Where it went</h2>

            <table className="ledger">
              <caption className="visually-hidden">
                Activities from last week, most costly first. All figures are estimates.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col" className="ledger__num">Hours</th>
                  <th scope="col">How it felt</th>
                  <th scope="col" className="ledger__num">A year of it</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((row) => (
                  <tr key={row.activityId} className={row.activityId === worst?.activityId ? 'is-worst' : undefined}>
                    <th scope="row">{row.name}</th>
                    <td className="ledger__num numeric">{formatDuration(row.estimatedMinutes)}</td>
                    <td>
                      {/* The value carries the meaning, not the colour. */}
                      <span className="energy-tag" data-energy={row.energy}>{energyLabel(row.energy)}</span>
                    </td>
                    <td className="ledger__num numeric">
                      {formatMoney(row.estimatedAnnualCostMinor, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Matrix matrix={matrix} currency={currency} unsortedCount={unsortedCount} />

          {worst ? (
            <section className="verdict" aria-labelledby="verdict-heading">
              <h2 id="verdict-heading" className="verdict__title">Start with {worst.name}</h2>
              <p className="verdict__body">
                It takes {formatDuration(worst.estimatedMinutes)} a week, it drains you, and over a year
                it costs about <strong className="numeric">{formatMoney(worst.estimatedAnnualCostMinor, currency)}</strong> of
                your time. Not the largest number on the page — the one most worth handing over.
              </p>
              {/*
                Said after the matrix, so it has to agree with it. Once an activity
                is sorted the matrix has already named what to do; what is still
                missing is who takes it on and what that costs, which is step 4.
              */}
              <p className="verdict__next">
                {worst.quadrant
                  ? `${QUADRANT_COPY[worst.quadrant].title} is the move. Who takes it on, and what that costs, is the next step of the build.`
                  : 'Answer one question about it and this page will say what to do with it.'}
              </p>
            </section>
          ) : (
            <section className="verdict">
              <h2 className="verdict__title">Nothing here is draining you</h2>
              <p className="verdict__body">
                Every activity you recorded is neutral or better, so there is nothing worth handing
                off yet. That is a good week, not a missing answer.
              </p>
            </section>
          )}

          <p className="rate-footnote">
            Priced at <strong className="numeric">{formatMoney(rate.rateMinorPerHour, currency)}</strong> an hour
            over {rate.weeksPerYear} working weeks — a planning estimate, not a wage.{' '}
            <Link to={paths.rate}>Change it</Link>
          </p>
        </>
      )}
    </main>
  );
}
