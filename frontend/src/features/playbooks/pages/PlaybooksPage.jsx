import { Link } from 'react-router-dom';
import { usePlaybooks } from '../../../lib/api/hooks.js';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { formatDuration, formatDate } from '../../../lib/formatters.js';

export default function PlaybooksPage() {
  const { data, isLoading, error } = usePlaybooks('all');

  if (isLoading) return <><PageHeader eyebrow="Playbooks" title="How the work gets done" /><Skeleton height={260} /></>;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const playbooks = data?.playbooks ?? [];

  if (!playbooks.length) {
    return (
      <>
        <PageHeader eyebrow="Playbooks" title="How the work gets done" />
        <EmptyState
          title="No playbooks yet"
          action={<Link to={paths.advisor} className="btn btn-primary">Start from a recommendation</Link>}
        >
          A playbook is what makes a transfer stick. Accept a recommendation, open its plan, and draft
          one from the task&rsquo;s own history.
        </EmptyState>
      </>
    );
  }

  const overdue = playbooks.filter((p) => p.reviewDueAt && new Date(p.reviewDueAt) < new Date());

  return (
    <>
      <PageHeader
        eyebrow="Playbooks"
        title="How the work gets done"
        subtitle={`${playbooks.length} total · ${playbooks.filter((p) => p.status === 'published').length} published`}
      />

      {overdue.length > 0 && (
        <Alert tone="warn" className="mb-3">
          {overdue.length} {overdue.length === 1 ? 'playbook has' : 'playbooks have'} not been reviewed in
          60 days. Stale instructions are how a transfer quietly comes back to you.
        </Alert>
      )}

      <ul className="list-unstyled row g-3 mb-0">
        {playbooks.map((pb) => (
          <li key={pb.id} className="col-12 col-md-6 col-xl-4">
            <Link to={paths.playbook(pb.id)} className="surface p-3 h-100 d-block text-decoration-none stack gap-2">
              <div className="d-flex flex-wrap gap-2">
                <Chip tone={pb.status === 'published' ? 'verified' : 'warn'}>
                  {pb.status === 'published' ? `Published v${pb.version}` : 'Draft'}
                </Chip>
                {pb.generated && <Chip tone="neutral">Drafted for you</Chip>}
              </div>

              <h3 className="fs-body fw-semibold mb-0" style={{ fontFamily: 'inherit', color: 'var(--ink)' }}>
                {pb.name}
              </h3>
              <p className="fs-ui-sm text-muted-2 mb-0">
                {pb.purpose ?? 'No purpose written yet'}
              </p>

              <dl className="d-flex flex-wrap gap-3 mb-0 mt-auto pt-2 border-top">
                <div>
                  <dt className="fs-caption text-muted-3 fw-normal">Steps</dt>
                  <dd className="numeral fs-ui mb-0">{pb.steps?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="fs-caption text-muted-3 fw-normal">Runs</dt>
                  <dd className="numeral fs-ui mb-0">{pb.stats?.runCount ?? 0}</dd>
                </div>
                {pb.stats?.avgDurationMinutes > 0 && (
                  <div>
                    <dt className="fs-caption text-muted-3 fw-normal">Average</dt>
                    <dd className="numeral fs-ui mb-0">{formatDuration(pb.stats.avgDurationMinutes)}</dd>
                  </div>
                )}
                <div className="ms-auto text-end">
                  <dt className="fs-caption text-muted-3 fw-normal">Updated</dt>
                  <dd className="fs-ui mb-0">{formatDate(pb.updatedAt, { day: 'numeric', month: 'short' })}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
