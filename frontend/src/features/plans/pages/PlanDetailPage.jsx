import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  usePlan, usePlanAction, useUpdatePlan, useMembers, usePlaybookMutations,
} from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { formatHours, formatDuration, formatDate } from '../../../lib/formatters.js';
import { PLAN_STATUS_LABEL, ACTION_LABEL } from '../../../lib/constants.js';

/**
 * The honesty screen. Projected sits in a dashed grey panel; verified sits in
 * solid teal with the window and sample size beside it. They are different
 * fields in the database and they look different here.
 */
export default function PlanDetailPage() {
  const { id } = useParams();
  const { canManage } = useWorkspace();
  const { data, isLoading, error } = usePlan(id);
  const approve = usePlanAction('approve');
  const verify = usePlanAction('verify');
  const update = useUpdatePlan();
  const { data: memberData } = useMembers();
  const { draft } = usePlaybookMutations();
  const [failure, setFailure] = useState(null);

  if (isLoading) return <Skeleton height={400} />;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const plan = data.plan;
  const currency = data.currency;
  const frozen = Boolean(plan.estimate?.frozenAt);
  const v = plan.verification ?? {};
  const coverage = v.coverage ?? {};
  const lowCoverage = frozen && v.measuredAt && coverage.ratio < 0.6;

  async function run(action, fn) {
    setFailure(null);
    try { await fn(); } catch (err) { setFailure(err.message ?? `We could not ${action} this plan.`); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Buyback plan"
        title={plan.title}
        subtitle={`${ACTION_LABEL[plan.strategy] ?? plan.strategy} · ${PLAN_STATUS_LABEL[plan.status]}`}
        actions={
          <>
            <Link to={paths.delegation} className="btn btn-outline-ink">Back to the queue</Link>
            {canManage && plan.status === 'draft' && (
              <Button onClick={() => run('approve', () => approve.mutateAsync(plan.id))} loading={approve.isPending} loadingLabel="Freezing baseline">
                Approve and freeze the baseline
              </Button>
            )}
            {canManage && plan.status === 'approved' && (
              <Button onClick={() => run('start', () => update.mutateAsync({ planId: plan.id, status: 'in_progress' }))}>
                Mark the transfer as started
              </Button>
            )}
          </>
        }
      />

      {failure && <Alert tone="error" className="mb-3">{failure}</Alert>}

      {!frozen && (
        <Alert tone="warn" title="No baseline yet" className="mb-3">
          Nothing can be measured until the baseline is frozen. Approving the plan captures what this
          task costs you today — a baseline taken after the work has moved measures nothing at all.
        </Alert>
      )}

      {lowCoverage && (
        <Alert tone="warn" title="Not enough logging to trust this yet" className="mb-3">
          You logged on {coverage.actualLogDays} of about {coverage.expectedLogDays} working days in the
          measurement window. A gap in your entries reads as zero minutes, which would report a bigger
          saving than really happened — so this is held at low confidence until there is more to go on.
        </Alert>
      )}

      <section className="surface p-3 p-sm-4 mb-3" aria-labelledby="proof">
        <h3 id="proof" className="fs-body fw-semibold mb-1">Did the time actually come back?</h3>
        <p className="fs-ui text-muted-3 mb-3">
          The projection is what we expected. The verification is what your own entries show.
        </p>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="rounded p-3 h-100" style={{ border: '1.5px dashed var(--line-strong)', background: 'var(--surface)' }}>
              <span className="eyebrow text-estimated">Projected at approval</span>
              <p className="mb-1 d-flex align-items-baseline gap-1 mt-2">
                <span className="numeral text-estimated" style={{ fontSize: '2.2rem', lineHeight: 1 }}>
                  {frozen ? formatHours(plan.estimate.hoursSavedPerWeek) : '—'}
                </span>
                <span className="numeral text-estimated fs-ui">/week</span>
              </p>
              <p className="fs-caption text-muted-2 mb-0">
                {frozen
                  ? `Estimated when this was approved on ${formatDate(plan.approvedAt)}.`
                  : 'Set when you approve the plan.'}
              </p>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div
              className="rounded p-3 h-100"
              style={{
                border: `1.5px solid ${v.measuredAt && !lowCoverage ? 'var(--verified)' : 'var(--line-strong)'}`,
                background: v.measuredAt && !lowCoverage ? '#f2f8f6' : 'var(--surface)',
              }}
            >
              <span className="eyebrow text-verified">Verified</span>
              <p className="mb-1 d-flex align-items-baseline gap-1 mt-2">
                <span className="numeral text-verified" style={{ fontSize: '2.2rem', lineHeight: 1 }}>
                  {v.measuredAt ? formatHours(v.hoursSavedPerWeek) : '—'}
                </span>
                <span className="numeral text-verified fs-ui">/week</span>
              </p>
              {v.measuredAt ? (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <Chip tone={v.confidence === 'low' ? 'warn' : 'verified'}>{v.confidence} confidence</Chip>
                  <Chip tone="neutral">{v.sampleWeeks} weeks sampled</Chip>
                  <Chip tone="neutral">{Math.round((coverage.ratio ?? 0) * 100)}% logged</Chip>
                </div>
              ) : (
                <p className="fs-caption text-muted-2 mb-0">
                  Measured from your entries once the transfer has been running for a couple of weeks.
                </p>
              )}
            </div>
          </div>
        </div>

        {frozen && (
          <div className="pt-3 mt-3 border-top">
            <span className="eyebrow d-block mb-2">How it was measured</span>
            <ul className="list-unstyled stack gap-3 mb-3">
              <li>
                <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
                  <span className="fs-ui-sm text-muted-2" style={{ width: 92 }}>Baseline</span>
                  <span className="numeral fs-ui">{formatDuration(plan.estimate.baselineMinutesPerWeek)} / wk</span>
                  <span className="fs-caption text-muted-3">
                    {formatDate(plan.estimate.baselineWindow?.start)} – {formatDate(plan.estimate.baselineWindow?.end)},
                    frozen at approval
                  </span>
                </div>
                <div className="rounded-pill overflow-hidden" style={{ height: 9, background: 'var(--sunken)' }}>
                  <div style={{ width: '100%', height: '100%', background: 'var(--ink-3)' }} />
                </div>
              </li>
              <li>
                <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
                  <span className="fs-ui-sm text-muted-2" style={{ width: 92 }}>Now</span>
                  <span className="numeral fs-ui">{formatDuration(v.currentMinutesPerWeek ?? 0)} / wk</span>
                  <span className="fs-caption text-muted-3">
                    {v.measuredAt ? `${formatDate(v.measuredWindow?.start)} – ${formatDate(v.measuredWindow?.end)}` : 'not measured yet'}
                  </span>
                </div>
                <div className="rounded-pill overflow-hidden" style={{ height: 9, background: 'var(--sunken)' }}>
                  <div
                    style={{
                      width: `${Math.min(100, ((v.currentMinutesPerWeek ?? 0) / Math.max(1, plan.estimate.baselineMinutesPerWeek)) * 100)}%`,
                      height: '100%',
                      background: 'var(--verified)',
                    }}
                  />
                </div>
              </li>
            </ul>
            <Button variant="outline" onClick={() => run('verify', () => verify.mutateAsync(plan.id))} loading={verify.isPending} loadingLabel="Measuring">
              Recompute from my entries
            </Button>
          </div>
        )}
      </section>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <section className="surface p-3 p-sm-4 h-100">
            <h3 className="fs-body fw-semibold mb-3">Who it goes to</h3>

            {canManage ? (
              <div className="stack gap-2 mb-3">
                <label className="form-label" htmlFor="owner">New owner</label>
                <select
                  id="owner" className="form-select"
                  value={plan.newOwner?.userId?.id ?? plan.newOwner?.userId ?? ''}
                  onChange={(e) => update.mutate({
                    planId: plan.id,
                    newOwner: e.target.value
                      ? { type: 'user', userId: e.target.value }
                      : { type: 'none', userId: null },
                  })}
                >
                  <option value="">Nobody yet</option>
                  {(memberData?.members ?? []).filter((m) => m.user).map((m) => (
                    <option key={m.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
                <p className="field-hint mb-0">
                  No one to hand it to? Automating and eliminating are first-class outcomes here — and a
                  published playbook is what you would give a contractor.
                </p>
              </div>
            ) : (
              <p className="fs-ui mb-3">
                {plan.newOwner?.userId?.name ?? 'Not assigned yet'}
              </p>
            )}

            <div className="pt-3 border-top">
              <h4 className="eyebrow mb-2">Definition of done</h4>
              <p className="fs-ui text-muted-2 mb-3">
                {plan.successCriteria?.definitionOfDone
                  ?? 'Not written yet — say what "correct" looks like before anyone else runs this.'}
              </p>

              {plan.playbookId ? (
                <Link to={paths.playbook(plan.playbookId.id ?? plan.playbookId)} className="btn btn-outline-ink">
                  Open the playbook
                </Link>
              ) : canManage && (
                <Button
                  variant="outline"
                  loading={draft.isPending}
                  loadingLabel="Drafting"
                  onClick={() => run('draft a playbook for', async () => {
                    const { playbook } = await draft.mutateAsync(plan.taskId?.id ?? plan.taskId);
                    await update.mutateAsync({ planId: plan.id, status: plan.status });
                    window.location.assign(paths.playbook(playbook.id));
                  })}
                >
                  Draft a playbook from this task
                </Button>
              )}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-5">
          <section className="surface p-3 p-sm-4 h-100">
            <h3 className="fs-body fw-semibold mb-3">Plan lifecycle</h3>
            <ol className="list-unstyled stack gap-3 mb-0">
              {[
                ['Plan created', formatDate(plan.createdAt), true],
                ['Baseline frozen', frozen ? formatDate(plan.estimate.frozenAt) : 'pending approval', frozen],
                ['Transfer started', plan.status === 'in_progress' || plan.status === 'completed' || plan.status === 'verified' ? 'done' : 'not yet', ['in_progress', 'completed', 'verified'].includes(plan.status)],
                ['Savings verified', v.measuredAt ? formatDate(v.measuredAt) : 'not yet', Boolean(v.measuredAt) && v.confidence !== 'low'],
              ].map(([label, when, done]) => (
                <li key={label} className="d-flex gap-3">
                  <span
                    className="rounded-circle flex-shrink-0 mt-1"
                    style={{
                      width: 11, height: 11,
                      background: done ? 'var(--verified)' : 'transparent',
                      border: done ? 'none' : '2px solid var(--line-strong)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="stack gap-0">
                    <span className={`fs-ui ${done ? 'fw-semibold' : 'text-muted-3'}`}>{label}</span>
                    <span className="fs-caption text-muted-3">{when}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="fs-caption text-muted-3 mb-0 mt-3 pt-3 border-top">
              Currency: {currency}. Only a verification above low confidence counts towards the
              dashboard headline.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
