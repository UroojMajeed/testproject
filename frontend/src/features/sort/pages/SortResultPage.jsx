import { Link, useNavigate } from 'react-router-dom';
import { useDrip, useAnalyse, useRecommendations } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';
import { FullPageSpinner } from '../../../components/ui/FullPageSpinner.jsx';
import { DripMatrix } from '../../drip/components/DripMatrix.jsx';
import { QuadrantChip } from '../../../components/ui/Chip.jsx';
import { formatDuration, formatMoney } from '../../../lib/formatters.js';
import { useEffect } from 'react';

/** The payoff screen: one number, its cost, the matrix they just built, one move. */
export default function SortResultPage() {
  const navigate = useNavigate();
  const { currency } = useWorkspace();
  const { data: drip, isLoading } = useDrip(14);
  const { data: recs } = useRecommendations('pending');
  const analyse = useAnalyse();

  // The sort has produced entries; run the engine once so there is a move to make.
  useEffect(() => {
    if (!isLoading && drip && !recs?.recommendations?.length && analyse.isIdle) {
      analyse.mutate(14);
    }
  }, [isLoading, drip, recs, analyse]);

  if (isLoading) return <FullPageSpinner label="Working out what your week cost" />;

  const q = drip?.quadrants ?? {};
  const drainingMinutes = (q.delegation?.minutes ?? 0) + (q.replacement?.minutes ?? 0);
  const drainingCost = (q.delegation?.costMinor ?? 0) + (q.replacement?.costMinor ?? 0);
  const totalMinutes = Object.values(q).reduce((s, v) => s + (v.minutes ?? 0), 0);
  const share = totalMinutes ? Math.round((drainingMinutes / totalMinutes) * 100) : 0;

  const top = recs?.recommendations?.[0] ?? null;

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--ground)' }}>
      <header className="d-flex align-items-center gap-3 px-4 py-3 bg-white border-bottom">
        <Logo size="1.2rem" />
        <span className="fs-ui text-muted-3">Your week</span>
        <Link to={paths.app} className="btn btn-outline-ink fs-ui ms-auto">Go to dashboard</Link>
      </header>

      <main id="main" className="flex-grow-1 px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          <div className="row g-4">
            <div className="col-12 col-lg-7">
              <h1 className="display-serif mb-3" style={{ fontSize: 'clamp(1.9rem, 4vw, 2.5rem)' }}>
                <span className="numeral text-warn">{formatDuration(drainingMinutes)}</span> of your week
                went to work that drains you.
              </h1>
              <p className="fs-lead text-muted-2 max-ch mb-4">
                That is {share}% of the {formatDuration(totalMinutes)} you logged, and about{' '}
                <span className="numeral text-warn">{formatMoney(drainingCost, currency)}</span> at the
                rate you set.
              </p>

              <section className="surface p-3 p-sm-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <h2 className="fs-body fw-semibold mb-0">Your week, by energy and value</h2>
                  <Link to={paths.drip} className="fs-ui-sm ms-auto">Open the matrix</Link>
                </div>
                <DripMatrix points={drip?.points ?? []} quadrants={q} currency={currency} compact />
              </section>
            </div>

            <div className="col-12 col-lg-5">
              {top ? (
                <section className="surface p-4 mb-3">
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <span className="eyebrow">Start here</span>
                  </div>
                  <h2 className="display-serif mb-2" style={{ fontSize: '1.6rem' }}>{top.title}</h2>
                  <p className="fs-ui text-muted-2 mb-3">{top.reason}</p>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {top.evidence.slice(0, 4).map((e, i) => (
                      <span key={i} className="chip chip-neutral">
                        {e.label}: {String(e.value)}
                      </span>
                    ))}
                  </div>

                  <div className="d-flex align-items-baseline gap-2 pb-3 mb-3 border-bottom">
                    <span className="numeral fs-lead text-estimated">
                      ~{top.estimatedHoursSavedPerWeek}h
                    </span>
                    <span className="fs-caption text-muted-3">projected back each week, if you act on it</span>
                  </div>

                  <div className="stack gap-2">
                    <Button onClick={() => navigate(paths.advisor)}>Review this and decide</Button>
                    <Button variant="quiet" onClick={() => navigate(paths.app)}>Later — take me to the dashboard</Button>
                  </div>
                </section>
              ) : (
                <section className="surface p-4 mb-3">
                  <h2 className="display-serif mb-2" style={{ fontSize: '1.5rem' }}>Looking for your first move</h2>
                  <p className="fs-ui text-muted-2 mb-3">
                    {analyse.isPending
                      ? 'Working through your entries…'
                      : 'Nothing recurring enough to act on yet. One more week of data and the advisor will have something concrete.'}
                  </p>
                  <Button variant="outline" onClick={() => navigate(paths.advisor)}>Open the advisor</Button>
                </section>
              )}

              <section className="surface p-3">
                <h2 className="eyebrow mb-2">Where your hours sit</h2>
                <ul className="list-unstyled stack gap-2 mb-0">
                  {['delegation', 'replacement', 'investment', 'production'].map((key) => (
                    <li key={key} className="d-flex align-items-center gap-2">
                      <QuadrantChip quadrant={key} />
                      <span className="numeral fs-ui ms-auto">{formatDuration(q[key]?.minutes ?? 0)}</span>
                      <span className="numeral fs-caption text-muted-3" style={{ width: 72, textAlign: 'right' }}>
                        {formatMoney(q[key]?.costMinor ?? 0, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="fs-caption text-muted-3 mb-0 mt-3 pt-2 border-top">
                  Per week, at your buyback rate. A planning estimate for comparing options — not a wage.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
