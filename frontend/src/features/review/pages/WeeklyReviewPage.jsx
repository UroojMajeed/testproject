import { Link } from 'react-router-dom';
import { useWeeklyReview } from '../../../lib/api/hooks.js';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { StackedWeekChart } from '../../../components/chart/StackedWeekChart.jsx';
import { formatDuration, formatHours, formatDate } from '../../../lib/formatters.js';

export default function WeeklyReviewPage() {
  const { data, isLoading, error } = useWeeklyReview();

  if (isLoading) return <><PageHeader eyebrow="Weekly review" title="How the week went" /><Skeleton height={320} /></>;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const { thisWeek, lastWeek, reclaimed, topDrain, plans, nextStep, week } = data;

  if (!thisWeek.trackedMinutes) {
    return (
      <>
        <PageHeader eyebrow="Weekly review" title="How the week went" />
        <EmptyState
          title="Nothing tracked this week"
          action={<Link to={paths.sortStart} className="btn btn-primary">Sort this week</Link>}
        >
          The review compares this week against last. Once there is a week of entries it will tell you
          not just how many hours came back, but where they went.
        </EmptyState>
      </>
    );
  }

  const delta = thisWeek.trackedMinutes - lastWeek.trackedMinutes;
  const production = thisWeek.byQuadrant.production ?? 0;
  const draining = thisWeek.drainingMinutes;

  return (
    <>
      <PageHeader
        eyebrow="Weekly review"
        title="How the week went"
        subtitle={`${formatDate(week.start)} – ${formatDate(week.end)}`}
      />

      <section className="surface p-3 p-sm-4 mb-3">
        <p className="display-serif mb-3" style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.1rem)', lineHeight: 1.2 }}>
          You tracked <span className="numeral">{formatDuration(thisWeek.trackedMinutes)}</span>, and{' '}
          <span className="numeral text-verified">{formatDuration(production)}</span> of it went to
          Production work.
        </p>
        <p className="fs-ui text-muted-2 max-ch mb-0">
          {formatDuration(draining)} went to work you have marked as draining —{' '}
          {Math.round(thisWeek.drainingShare * 100)}% of the week.
          {delta !== 0 && ` That is ${formatDuration(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} tracked than last week.`}
          {reclaimed.verifiedHoursPerWeek > 0 && ` Across your plans, ${formatHours(reclaimed.verifiedHoursPerWeek)} a week is now verified as reclaimed.`}
        </p>
      </section>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-7">
          <section className="surface p-3 p-sm-4 h-100">
            <h3 className="fs-body fw-semibold mb-3">Your week, day by day</h3>
            <StackedWeekChart days={thisWeek.days} height={190} />
          </section>
        </div>

        <div className="col-12 col-lg-5">
          <section className="surface p-3 p-sm-4 h-100">
            <h3 className="fs-body fw-semibold mb-3">Biggest drain</h3>
            {topDrain ? (
              <>
                <p className="mb-1 d-flex align-items-baseline gap-2">
                  <span className="numeral text-warn" style={{ fontSize: '1.9rem', lineHeight: 1 }}>
                    {formatDuration(topDrain.minutes)}
                  </span>
                  <span className="fs-ui text-muted-3 text-capitalize">{topDrain.category}</span>
                </p>
                <p className="fs-ui text-muted-2 mb-0">
                  The single category that took most of your week.
                </p>
              </>
            ) : (
              <p className="fs-ui text-muted-3 mb-0">Not enough entries to name one.</p>
            )}
          </section>
        </div>
      </div>

      {plans.length > 0 && (
        <section className="surface p-3 p-sm-4 mb-3" aria-labelledby="plan-proof">
          <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
            <h3 id="plan-proof" className="fs-body fw-semibold mb-0">Projected against verified</h3>
            <div className="d-flex gap-3 ms-auto">
              <span className="d-inline-flex align-items-center gap-2 fs-caption text-muted-2">
                <span style={{ width: 10, height: 10, border: '1.5px dashed var(--estimated)', display: 'inline-block' }} aria-hidden="true" />
                Projected
              </span>
              <span className="d-inline-flex align-items-center gap-2 fs-caption text-muted-2">
                <span className="drip-dot" style={{ background: 'var(--verified)', width: 10, height: 10 }} aria-hidden="true" />
                Verified
              </span>
            </div>
          </div>

          <ul className="list-unstyled stack gap-3 mb-0">
            {plans.map((p) => {
              const peak = Math.max(p.projectedHoursPerWeek, p.verifiedHoursPerWeek ?? 0, 1);
              const measurable = p.verifiedHoursPerWeek !== null && p.confidence !== 'low';
              return (
                <li key={p.id} className="d-flex flex-wrap align-items-center gap-3">
                  <Link to={paths.plan(p.id)} className="fs-ui" style={{ width: 190 }}>{p.title}</Link>
                  <div className="flex-grow-1 stack gap-1" style={{ minWidth: 140 }}>
                    <div style={{ height: 10, width: `${(p.projectedHoursPerWeek / peak) * 100}%`, border: '1.5px dashed var(--estimated)', borderRadius: 3 }} />
                    {measurable ? (
                      <div style={{ height: 10, width: `${((p.verifiedHoursPerWeek ?? 0) / peak) * 100}%`, background: 'var(--verified)', borderRadius: 3 }} />
                    ) : (
                      <div className="rounded d-flex align-items-center px-2" style={{ height: 10, background: 'var(--sunken)' }}>
                        <span className="fs-caption text-muted-3" style={{ fontSize: 9 }}>
                          not yet measurable — {p.sampleWeeks || 0} week{p.sampleWeeks === 1 ? '' : 's'} of data
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="numeral fs-ui-sm" style={{ width: 92, textAlign: 'right' }}>
                    {measurable
                      ? <span className="text-verified">{formatHours(p.verifiedHoursPerWeek)} / {formatHours(p.projectedHoursPerWeek)}</span>
                      : <span className="text-muted-3">— / {formatHours(p.projectedHoursPerWeek)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {nextStep && (
        <section className="surface p-3 p-sm-4">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="stack gap-2 flex-grow-1">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="eyebrow">Recommended next step</span>
                <Chip tone="estimated">projected {formatHours(nextStep.estimatedHoursSavedPerWeek)}/week</Chip>
              </div>
              <p className="display-serif mb-0" style={{ fontSize: '1.4rem' }}>{nextStep.title}</p>
            </div>
            <Link to={paths.advisor} className="btn btn-primary">Review it</Link>
          </div>
        </section>
      )}
    </>
  );
}
