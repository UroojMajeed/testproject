import { Link } from 'react-router-dom';
import { useDelegationQueue, usePlans } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { QuadrantChip, Chip } from '../../../components/ui/Chip.jsx';
import { formatDuration, formatHours } from '../../../lib/formatters.js';

const COLUMNS = [
  ['needsDecision', 'Needs decision', 'Nobody owns this yet'],
  ['readyToDelegate', 'Ready to delegate', 'Approved, baseline frozen'],
  ['inProgress', 'In progress', 'Someone else is running it'],
  ['needsReview', 'Needs review', 'Waiting on you'],
  ['done', 'Verified', 'Measured and holding'],
];

export default function DelegationPage() {
  const { currency } = useWorkspace();
  const { data, isLoading, error } = useDelegationQueue();
  const { data: planData } = usePlans('all');

  if (isLoading) return <><PageHeader eyebrow="Delegation" title="What is moving off your plate" /><Skeleton height={320} /></>;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const cols = data?.columns ?? {};
  const totals = planData?.totals ?? {};
  const isEmpty = Object.values(cols).every((c) => !c?.length);

  if (isEmpty) {
    return (
      <>
        <PageHeader eyebrow="Delegation" title="What is moving off your plate" />
        <EmptyState
          title="Nothing in transfer yet"
          action={<Link to={paths.advisor} className="btn btn-primary">See what to buy back first</Link>}
        >
          The queue fills from the advisor. Accept a recommendation and it arrives here as a plan.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Delegation"
        title="What is moving off your plate"
        subtitle="Needs decision comes first: work stalls far more often for want of an owner than for want of effort."
      />

      <section className="surface p-3 mb-4">
        <dl className="row g-3 mb-0">
          <div className="col-6 col-lg-3">
            <dt className="fs-caption text-muted-3 fw-normal">Verified back</dt>
            <dd className="numeral fs-lead text-verified mb-0">{formatHours(totals.verifiedHoursPerWeek ?? 0)}/wk</dd>
          </div>
          <div className="col-6 col-lg-3">
            <dt className="fs-caption text-muted-3 fw-normal">Projected</dt>
            <dd className="numeral fs-lead text-estimated mb-0">{formatHours(totals.projectedHoursPerWeek ?? 0)}/wk</dd>
          </div>
          <div className="col-6 col-lg-3">
            <dt className="fs-caption text-muted-3 fw-normal">Active plans</dt>
            <dd className="numeral fs-lead mb-0">{totals.planCount ?? 0}</dd>
          </div>
          <div className="col-6 col-lg-3">
            <dt className="fs-caption text-muted-3 fw-normal">Verified plans</dt>
            <dd className="numeral fs-lead mb-0">{totals.verifiedPlanCount ?? 0}</dd>
          </div>
        </dl>
      </section>

      <div className="row g-3">
        {COLUMNS.map(([key, title, hint]) => {
          const items = cols[key] ?? [];
          return (
            <section key={key} className="col-12 col-md-6 col-xl" aria-labelledby={`col-${key}`}>
              <div className="d-flex align-items-baseline gap-2 mb-2">
                <h3 id={`col-${key}`} className="eyebrow mb-0">{title}</h3>
                <span className="numeral fs-caption text-muted-3">{items.length}</span>
              </div>

              {!items.length && <p className="fs-caption text-muted-3">{hint}</p>}

              <ul className="list-unstyled stack gap-2 mb-0">
                {items.map((item) => {
                  const isPlan = Boolean(item.strategy);
                  const task = isPlan ? item.taskId : item;
                  return (
                    <li key={item._id ?? item.id} className="surface p-3 stack gap-2">
                      <span className="fs-ui fw-medium">{isPlan ? item.title : item.title}</span>

                      <div className="d-flex flex-wrap gap-1">
                        {task?.drip?.quadrant && <QuadrantChip quadrant={task.drip.quadrant} />}
                        {isPlan && item.estimate?.hoursSavedPerWeek > 0 && (
                          <Chip tone="estimated">~{formatHours(item.estimate.hoursSavedPerWeek)}/wk</Chip>
                        )}
                        {isPlan && item.verification?.hoursSavedPerWeek > 0 && item.verification.confidence !== 'low' && (
                          <Chip tone="verified">{formatHours(item.verification.hoursSavedPerWeek)}/wk verified</Chip>
                        )}
                      </div>

                      <div className="d-flex align-items-center gap-2 pt-2 border-top">
                        <span className="fs-caption text-muted-3 flex-grow-1">
                          {isPlan
                            ? (item.newOwner?.userId?.name ?? 'Unassigned')
                            : `${formatDuration(item.actualMinutes ?? 0)} logged`}
                        </span>
                        {(task?.interventionCount ?? 0) > 0 && (
                          <Chip tone="warn">{task.interventionCount} step-ins</Chip>
                        )}
                      </div>

                      {isPlan && (
                        <Link to={paths.plan(item._id ?? item.id)} className="btn btn-outline-ink fs-ui-sm py-1">
                          Open plan
                        </Link>
                      )}
                      {!isPlan && (
                        <Link to={paths.advisor} className="btn btn-outline-ink fs-ui-sm py-1">Decide what to do</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="fs-caption text-muted-3 mt-4 mb-0">
        Step-ins count how often you had to take the work back. It is the signal that a transfer has not
        really completed, whatever the column says. Figures in {currency}.
      </p>
    </>
  );
}
