import { Link } from 'react-router-dom';
import { useDashboard } from '../../../lib/api/hooks.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { StatCard } from '../../../components/ui/StatCard.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { SkeletonGrid, Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { StackedWeekChart } from '../../../components/chart/StackedWeekChart.jsx';
import { formatDuration, formatMoney, formatHours } from '../../../lib/formatters.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const { currency } = useWorkspace();
  const { data, isLoading, error } = useDashboard(14);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const greetingBlock = (
    <div className="stack gap-1 mb-4">
      <h2 className="display-serif mb-0" style={{ fontSize: '1.9rem' }}>{greeting}, {firstName}</h2>
      <p className="fs-ui text-muted-3 mb-0">
        {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
      </p>
    </div>
  );

  if (isLoading) {
    return <>{greetingBlock}<SkeletonGrid /><Skeleton height={180} className="mt-3" /></>;
  }
  if (error) return <>{greetingBlock}<Alert tone="error">{error.message}</Alert></>;

  const { summary, reclaimed, potentialHoursPerWeek, tasksToTransfer, publishedPlaybooks, nextBestAction } = data;
  const hasData = summary.trackedMinutes > 0;

  if (!hasData) {
    return (
      <>
        {greetingBlock}
        <EmptyState
          title="Let's find out where your week goes"
          action={<Link to={paths.sortStart} className="btn btn-primary">Sort last week — about 10 minutes</Link>}
        >
          Nothing is tracked yet. Walk through last week once and you will see your matrix, what it cost,
          and the single best hour to buy back — in this session, not in two weeks.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {greetingBlock}

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="Time reclaimed" tone="verified"
            value={reclaimed.verifiedHoursPerWeek ? formatHours(reclaimed.verifiedHoursPerWeek) : '—'}
            caption={reclaimed.verifiedPlanCount
              ? `Verified across ${reclaimed.verifiedPlanCount} ${reclaimed.verifiedPlanCount === 1 ? 'plan' : 'plans'}`
              : 'Nothing verified yet'}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard
            label="Buyback potential" tone="estimated"
            value={potentialHoursPerWeek ? formatHours(potentialHoursPerWeek) : '—'}
            caption="Identified, not yet actioned"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Tasks to transfer" value={tasksToTransfer} caption="Awaiting your decision" />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <StatCard label="Playbooks" value={publishedPlaybooks} caption="Published processes" />
        </div>
      </div>

      {nextBestAction && (
        <section className="surface p-4 mb-3">
          <div className="d-flex flex-wrap align-items-start gap-4">
            <div className="stack gap-2 flex-grow-1" style={{ minWidth: 260 }}>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="eyebrow">Your next best action</span>
                <Chip tone="estimated">
                  projected {formatHours(nextBestAction.estimatedHoursSavedPerWeek)}/week
                </Chip>
              </div>
              <h3 className="display-serif mb-0" style={{ fontSize: '1.6rem' }}>{nextBestAction.title}</h3>
              <p className="fs-ui text-muted-2 mb-0 max-ch">{nextBestAction.reason}</p>
            </div>
            <div className="stack gap-2" style={{ minWidth: 160 }}>
              <Link to={paths.advisor} className="btn btn-primary">Review it</Link>
              <Link to={paths.drip} className="btn btn-outline-ink">See the matrix</Link>
            </div>
          </div>
        </section>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <section className="surface p-3 p-sm-4 h-100">
            <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
              <h3 className="fs-body fw-semibold mb-0">Where your fortnight went</h3>
              <span className="numeral fs-ui-sm text-muted-3">
                {formatDuration(summary.trackedMinutes)} tracked
              </span>
            </div>
            <StackedWeekChart days={summary.days} />
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="surface p-3 p-sm-4 h-100">
            <h3 className="fs-body fw-semibold mb-3">What it is costing</h3>
            <p className="mb-1 d-flex align-items-baseline gap-2">
              <span className="numeral text-warn" style={{ fontSize: '1.9rem', lineHeight: 1 }}>
                {formatMoney(summary.drainingCostMinor, currency)}
              </span>
              <span className="fs-ui text-muted-3">over 14 days</span>
            </p>
            <p className="fs-ui text-muted-2 mb-3">
              {formatDuration(summary.drainingMinutes)} in Delegation and Replacement —{' '}
              {Math.round(summary.drainingShare * 100)}% of everything you tracked.
            </p>
            <p className="fs-caption text-muted-3 mb-0 pt-3 border-top">
              Priced at your buyback rate, which is a planning estimate for comparing options — not a
              wage and not a valuation.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
