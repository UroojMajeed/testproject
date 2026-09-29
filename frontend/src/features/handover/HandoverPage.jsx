import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { formatMoney, formatDuration } from '../../lib/money.js';
import { QUADRANT_COPY } from '../../lib/drip.js';
import { useHandoverPlan, useHandovers, useStartHandover } from '../../lib/api/hooks.js';
import { HandoverCard } from './HandoverCard.jsx';
import { paths } from '../../routes/paths.js';

/**
 * What to hand over, and how far along each one is.
 *
 * The dashboard has been ending on an IOU — it names the worst activity, prices a
 * year of it, and then says the next step is "the next step of the build", at the
 * moment somebody is most likely to act. This is that step.
 *
 * Two halves, in the order they are used: the things still costing the owner
 * their own hours, then the ones already on their way out. Not a hiring plan and
 * not a salary estimate — the only figure needed is one the workspace already
 * has, and inventing a market rate would be a number somebody hires on.
 */
export default function HandoverPage() {
  const plan = useHandoverPlan();
  const handovers = useHandovers();
  const start = useStartHandover();

  if (plan.isPending || handovers.isPending) return <FullPageSpinner label="Working out what to hand over" />;

  if (plan.isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{plan.error?.userMessage ?? 'Could not work out what to hand over.'}</Alert>
      </main>
    );
  }

  const { candidates, totals, breakEvenMinorPerHour, rate } = plan.data;
  const waiting = candidates.filter((row) => !row.handoverId);
  const started = handovers.data?.handovers ?? [];
  const currency = rate.currency;

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <header className="app-header">
        <div>
          <h1 className="app-header__title">What to hand over</h1>
          <p className="app-header__subtitle">
            The parts of your week that drain you. Everything else is yours to keep.
          </p>
        </div>
      </header>

      {!candidates.length ? (
        <section className="notice">
          <h2 className="notice__title">Nothing to hand over yet</h2>
          <p className="notice__body mb-4">
            This fills in from the draining half of your matrix. Record a week and answer
            what each activity is worth, and whatever costs you most shows up here.
          </p>
          <Link to={paths.app} className="btn btn-primary">Go to your week</Link>
        </section>
      ) : (
        <>
          {waiting.length ? (
            <section className="verdict" aria-labelledby="case-heading">
              <h2 id="case-heading" className="verdict__title">
                {formatDuration(totals.estimatedMinutes)} a week is costing you{' '}
                {formatMoney(totals.estimatedAnnualCostMinor, currency)} a year
              </h2>
              {/*
                The whole decision in one sentence. Not "hire a VA for £X" — we do
                not know what anybody charges, and a figure we made up is one
                somebody would hire on.
              */}
              <p className="verdict__body">
                Anyone who will do this work for less than{' '}
                <strong className="numeric">{formatMoney(breakEvenMinorPerHour, currency)}</strong> an
                hour makes you money from the first week. That is your buyback rate, which is
                deliberately the conservative end.
              </p>
              <p className="verdict__next">
                {waiting.length === 1
                  ? 'One activity is waiting on a decision.'
                  : `${waiting.length} activities are waiting on a decision.`}
              </p>
            </section>
          ) : null}

          {waiting.length ? (
            <section aria-labelledby="waiting-heading" className="mt-6">
              <h2 id="waiting-heading" className="eyebrow">Worth handing over</h2>

              <Alert tone="error">{start.error?.userMessage}</Alert>

              <ul className="candidates">
                {waiting.map((row) => (
                  <li key={row.activityId} className="candidate" data-quadrant={row.quadrant}>
                    <div className="candidate__what">
                      <p className="candidate__name">{row.name}</p>
                      <p className="candidate__meaning">{QUADRANT_COPY[row.quadrant]?.meaning}</p>
                    </div>

                    <p className="candidate__cost">
                      <strong className="numeric">{formatDuration(row.estimatedMinutes)}</strong> a week
                      {' · '}
                      <strong className="numeric">{formatMoney(row.estimatedAnnualCostMinor, currency)}</strong> a year
                    </p>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={start.isPending}
                      onClick={() => start.mutate(row.activityId)}
                    >
                      Hand this over
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {started.length ? (
            <section aria-labelledby="started-heading" className="mt-6">
              <h2 id="started-heading" className="eyebrow">On their way out</h2>
              <ul className="handovers">
                {started.map((handover) => (
                  <li key={handover.id}>
                    <HandoverCard
                      handover={handover}
                      name={candidates.find((c) => c.activityId === handover.activityId)?.name}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
