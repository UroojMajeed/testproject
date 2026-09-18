import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlaybook, usePlaybookMutations } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { formatDuration } from '../../../lib/formatters.js';

const emptyStep = () => ({
  title: '', instructions: '', estimatedMinutes: 15, approvalRequired: false, key: crypto.randomUUID(),
});

export default function PlaybookDetailPage() {
  const { id } = useParams();
  const { canManage } = useWorkspace();
  const { data, isLoading, error } = usePlaybook(id);
  const { update, publish } = usePlaybookMutations();

  const [draft, setDraft] = useState(null);
  const [failure, setFailure] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data?.playbook) return;
    const pb = data.playbook;
    setDraft({
      name: pb.name,
      purpose: pb.purpose ?? '',
      trigger: pb.trigger ?? '',
      steps: (pb.steps ?? []).map((s) => ({ ...s, key: s.id ?? crypto.randomUUID() })),
    });
  }, [data]);

  if (isLoading || !draft) return <Skeleton height={380} />;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const pb = data.playbook;
  const totalMinutes = draft.steps.reduce((s, x) => s + (Number(x.estimatedMinutes) || 0), 0);
  const hasPlaceholders = draft.steps.some((s) => s.instructions?.includes('[Replace this]'));

  const patchStep = (key, next) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.key === key ? { ...s, ...next } : s)) }));

  async function save() {
    setFailure(null); setSaved(false);
    try {
      await update.mutateAsync({
        pbId: pb.id,
        name: draft.name,
        purpose: draft.purpose || null,
        trigger: draft.trigger || null,
        steps: draft.steps.map(({ key: _key, id: _id, ...s }) => ({
          ...s, estimatedMinutes: Number(s.estimatedMinutes) || 0,
        })),
      });
      setSaved(true);
    } catch (err) {
      setFailure(err.message ?? 'We could not save the playbook.');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Playbook"
        title={pb.name}
        subtitle={`${draft.steps.length} steps · about ${formatDuration(totalMinutes)} a run`}
        actions={
          <>
            <Link to={paths.playbooks} className="btn btn-outline-ink">All playbooks</Link>
            {canManage && (
              <>
                <Button variant="outline" onClick={save} loading={update.isPending} loadingLabel="Saving">Save</Button>
                <Button
                  onClick={() => publish.mutate(pb.id)}
                  loading={publish.isPending}
                  loadingLabel="Publishing"
                  disabled={!draft.steps.length}
                >
                  {pb.status === 'published' ? `Publish v${pb.version + 1}` : 'Publish'}
                </Button>
              </>
            )}
          </>
        }
      />

      {failure && <Alert tone="error" className="mb-3">{failure}</Alert>}
      {saved && <Alert tone="success" className="mb-3">Saved.</Alert>}

      {pb.generated && hasPlaceholders && (
        <Alert tone="warn" title="This is a draft skeleton, not a finished process" className="mb-3">
          The structure came from this task&rsquo;s own history — the frequency, the average duration,
          the category. The wording is placeholder text for you to replace. Nothing here is published
          until a person has read it.
        </Alert>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <section className="surface p-3 p-sm-4 stack gap-3">
            <h3 className="eyebrow mb-0">Playbook</h3>

            <div className="stack">
              <label className="form-label" htmlFor="pb-name">Name</label>
              <input id="pb-name" className="form-control" value={draft.name} readOnly={!canManage}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            <div className="stack">
              <label className="form-label" htmlFor="pb-purpose">Purpose</label>
              <textarea id="pb-purpose" className="form-control" rows={3} value={draft.purpose} readOnly={!canManage}
                onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
            </div>

            <div className="stack">
              <label className="form-label" htmlFor="pb-trigger">When does it run?</label>
              <input id="pb-trigger" className="form-control" value={draft.trigger} readOnly={!canManage}
                onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} />
            </div>

            <div className="pt-3 border-top d-flex flex-wrap gap-2">
              <Chip tone={pb.status === 'published' ? 'verified' : 'warn'}>
                {pb.status === 'published' ? `Published v${pb.version}` : 'Draft'}
              </Chip>
              {pb.stats?.runCount > 0 && <Chip tone="neutral">{pb.stats.runCount} runs</Chip>}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-8">
          <section className="surface p-3 p-sm-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              <h3 className="fs-body fw-semibold mb-0">Steps</h3>
              <span className="numeral fs-ui-sm text-muted-3">{draft.steps.length}</span>
              {canManage && (
                <Button
                  variant="outline" className="ms-auto fs-ui-sm py-1"
                  onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, emptyStep()] }))}
                >
                  Add step
                </Button>
              )}
            </div>

            <ol className="list-unstyled stack gap-3 mb-0">
              {draft.steps.map((step, i) => (
                <li key={step.key} className="d-flex gap-3">
                  <span
                    className="numeral fs-ui-sm rounded d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 26, height: 26, background: 'var(--sunken)', color: 'var(--ink-2)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>

                  <div className="stack gap-2 flex-grow-1">
                    <label className="visually-hidden" htmlFor={`s-title-${step.key}`}>Step {i + 1} title</label>
                    <input
                      id={`s-title-${step.key}`} className="form-control fw-semibold"
                      value={step.title} readOnly={!canManage} placeholder="What happens in this step?"
                      onChange={(e) => patchStep(step.key, { title: e.target.value })}
                    />

                    <label className="visually-hidden" htmlFor={`s-inst-${step.key}`}>Step {i + 1} instructions</label>
                    <textarea
                      id={`s-inst-${step.key}`} className="form-control" rows={2}
                      value={step.instructions} readOnly={!canManage}
                      placeholder="Short sentences, one action each."
                      onChange={(e) => patchStep(step.key, { instructions: e.target.value })}
                    />

                    <div className="d-flex flex-wrap align-items-center gap-3">
                      <div className="d-flex align-items-center gap-2">
                        <label className="form-label mb-0" htmlFor={`s-min-${step.key}`}>Minutes</label>
                        <input
                          id={`s-min-${step.key}`} type="number" min={0} max={480} step={5}
                          className="form-control" style={{ width: 90 }}
                          value={step.estimatedMinutes} readOnly={!canManage}
                          onChange={(e) => patchStep(step.key, { estimatedMinutes: e.target.value })}
                        />
                      </div>

                      <label className="d-flex align-items-center gap-2 fs-ui-sm mb-0">
                        <input
                          type="checkbox" checked={Boolean(step.approvalRequired)} disabled={!canManage}
                          style={{ accentColor: 'var(--verified)', width: 15, height: 15 }}
                          onChange={(e) => patchStep(step.key, { approvalRequired: e.target.checked })}
                        />
                        Needs approval
                      </label>

                      {canManage && (
                        <button
                          type="button" className="btn btn-quiet ms-auto px-2 fs-ui-sm"
                          onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((s) => s.key !== step.key) }))}
                        >
                          Remove step {i + 1}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {!draft.steps.length && (
              <p className="fs-ui text-muted-3 mb-0">
                No steps yet. A playbook needs at least one before it can be published.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
