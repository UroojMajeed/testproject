import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDrip, useReclassify } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { QuadrantChip } from '../../../components/ui/Chip.jsx';
import { DripMatrix } from '../components/DripMatrix.jsx';
import { formatDuration, formatMoney } from '../../../lib/formatters.js';

const ENERGY = [
  { value: 'low', label: 'Draining' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'high', label: 'Energising' },
];
const VALUE = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'strategic', label: 'Strategic' },
];

export default function DripPage() {
  const { currency } = useWorkspace();
  const { data, isLoading, error } = useDrip(14);
  const reclassify = useReclassify();
  const [selected, setSelected] = useState(null);

  if (isLoading) return <><PageHeader eyebrow="DRIP matrix" title="Where your work sits" /><Skeleton height={420} /></>;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const points = data?.points ?? [];
  const quadrants = data?.quadrants ?? {};
  const active = points.find((p) => p.taskId === selected) ?? null;

  if (!points.length) {
    return (
      <>
        <PageHeader eyebrow="DRIP matrix" title="Where your work sits" />
        <EmptyState
          title="Nothing to plot yet"
          action={<Link to={paths.sortStart} className="btn btn-primary">Sort last week</Link>}
        >
          The matrix fills in as soon as you have classified a week. It takes about ten minutes.
        </EmptyState>
      </>
    );
  }

  async function move(energy, value) {
    if (!active) return;
    await reclassify.mutateAsync({ taskId: active.taskId, energy, value });
  }

  return (
    <>
      <PageHeader
        eyebrow="DRIP matrix"
        title="Where your work sits"
        subtitle="Last 14 days. A move you make by hand always beats the derived classification."
      />

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <section className="surface p-3 p-sm-4">
            <DripMatrix
              points={points}
              quadrants={quadrants}
              currency={currency}
              selectedId={selected}
              onSelect={(p) => setSelected(p.taskId === selected ? null : p.taskId)}
            />
          </section>
        </div>

        <div className="col-12 col-xl-4">
          {active ? (
            <section className="surface p-3 p-sm-4" aria-live="polite">
              <div className="d-flex align-items-start gap-2 mb-3">
                <div className="stack gap-2 flex-grow-1">
                  <QuadrantChip quadrant={active.quadrant} />
                  <h3 className="display-serif mb-0" style={{ fontSize: '1.4rem' }}>{active.title}</h3>
                </div>
                <button type="button" className="btn btn-quiet px-2" onClick={() => setSelected(null)} aria-label="Close details">
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <dl className="row g-3 mb-3">
                <div className="col-6">
                  <dt className="fs-caption text-muted-3 fw-normal">Per week</dt>
                  <dd className="numeral fs-lead mb-0">{formatDuration(active.minutesPerWeek)}</dd>
                </div>
                <div className="col-6">
                  <dt className="fs-caption text-muted-3 fw-normal">Cost per week</dt>
                  <dd className="numeral fs-lead mb-0 text-warn">{formatMoney(active.costMinorPerWeek, currency)}</dd>
                </div>
                <div className="col-6">
                  <dt className="fs-caption text-muted-3 fw-normal">Occurrences</dt>
                  <dd className="numeral fs-lead mb-0">{active.occurrences}</dd>
                </div>
                <div className="col-6">
                  <dt className="fs-caption text-muted-3 fw-normal">Classified by</dt>
                  <dd className="fs-ui mb-0">{active.source === 'user' ? 'You' : 'Your entries'}</dd>
                </div>
              </dl>

              <div className="pt-3 border-top">
                <h4 className="eyebrow mb-2">Move it</h4>
                <div className="stack gap-2">
                  <div>
                    <span className="form-label d-block">Energy</span>
                    <div className="d-flex gap-1">
                      {ENERGY.map((e) => (
                        <Button
                          key={e.value} variant={active.energy === e.value ? 'primary' : 'outline'}
                          className="flex-grow-1 fs-ui-sm px-2"
                          onClick={() => move(e.value, active.value ?? 'medium')}
                          disabled={reclassify.isPending}
                        >
                          {e.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="form-label d-block">Value</span>
                    <div className="d-flex gap-1">
                      {VALUE.map((v) => (
                        <Button
                          key={v.value} variant={active.value === v.value ? 'primary' : 'outline'}
                          className="flex-grow-1 fs-ui-sm px-2"
                          onClick={() => move(active.energy ?? 'neutral', v.value)}
                          disabled={reclassify.isPending}
                        >
                          {v.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Link to={paths.advisor} className="btn btn-primary w-100 mt-3">See what to do about it</Link>
            </section>
          ) : (
            <section className="surface p-3 p-sm-4">
              <h3 className="eyebrow mb-3">By quadrant</h3>
              <ul className="list-unstyled stack gap-3 mb-0">
                {['delegation', 'replacement', 'investment', 'production'].map((key) => (
                  <li key={key} className="stack gap-1">
                    <div className="d-flex align-items-center gap-2">
                      <QuadrantChip quadrant={key} />
                      <span className="numeral fs-ui ms-auto">{formatDuration(quadrants[key]?.minutes ?? 0)}</span>
                    </div>
                    <span className="fs-caption text-muted-3">
                      {quadrants[key]?.taskCount ?? 0} {quadrants[key]?.taskCount === 1 ? 'activity' : 'activities'} ·{' '}
                      <span className="numeral">{formatMoney(quadrants[key]?.costMinor ?? 0, currency)}</span> a week
                    </span>
                  </li>
                ))}
              </ul>
              <p className="fs-caption text-muted-3 mb-0 mt-3 pt-3 border-top">
                Select any point to see its detail and move it between quadrants.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
