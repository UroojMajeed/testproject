import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../../../lib/api/endpoints.js';
import { qk } from '../../../lib/queryKeys.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { useClassifyGroup, useSkipGroup, useCompleteSort } from '../../../lib/api/hooks.js';
import { paths } from '../../../routes/paths.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';
import { FullPageSpinner } from '../../../components/ui/FullPageSpinner.jsx';
import { DripDot } from '../../../components/ui/Chip.jsx';
import { formatDuration, formatMoney } from '../../../lib/formatters.js';

const ENERGY = [
  { value: 'low', label: 'Draining', hint: 'costs you', key: 'D', color: 'var(--drip-delegation)' },
  { value: 'neutral', label: 'Neutral', hint: 'neither way', key: 'N', color: 'var(--line-strong)' },
  { value: 'high', label: 'Energising', hint: 'gives back', key: 'E', color: 'var(--drip-production)' },
];

const VALUE = [
  { value: 'low', label: 'Low', key: '1' },
  { value: 'medium', label: 'Medium', key: '2' },
  { value: 'high', label: 'High', key: '3' },
  { value: 'strategic', label: 'Strategic', key: '4' },
];

const QUADRANT_OF = (energy, value) => {
  const drains = energy === 'low' || energy === 'very_low';
  const worth = value === 'high' || value === 'strategic';
  if (drains) return worth ? 'replacement' : 'delegation';
  return worth ? 'production' : 'investment';
};

export default function SortSessionPage() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { workspaceId, currency, buybackRateMinor } = useWorkspace();

  const { data, isLoading, error } = useQuery({
    queryKey: qk.sortSession(workspaceId, sessionId),
    queryFn: () => endpoints.getSort(workspaceId, sessionId),
    enabled: Boolean(workspaceId && sessionId),
  });

  const classify = useClassifyGroup(sessionId);
  const skip = useSkipGroup(sessionId);
  const complete = useCompleteSort();

  const [energy, setEnergy] = useState(null);
  const [value, setValue] = useState(null);
  const [failure, setFailure] = useState(null);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const current = groups.find((g) => !g.decidedAt) ?? null;
  const done = groups.filter((g) => g.decidedAt);
  const decidedMinutes = done.reduce((s, g) => s + (g.skipped ? 0 : g.totalMinutes), 0);
  const drainingMinutes = done
    .filter((g) => g.dripQuadrant === 'delegation' || g.dripQuadrant === 'replacement')
    .reduce((s, g) => s + g.totalMinutes, 0);

  // A fresh group means fresh answers.
  useEffect(() => { setEnergy(null); setValue(null); }, [current?.id]);

  const submit = useCallback(async () => {
    if (!current || !energy || !value) return;
    setFailure(null);
    try {
      await classify.mutateAsync({ groupId: current.id, energy, value });
    } catch (err) {
      setFailure(err.message ?? 'We could not save that classification.');
    }
  }, [current, energy, value, classify]);

  // Keyboard-first: D/N/E for energy, 1–4 for value, Enter to move on.
  useEffect(() => {
    function onKey(e) {
      if (e.target.matches('input, textarea, select')) return;
      const k = e.key.toUpperCase();
      const en = ENERGY.find((x) => x.key === k);
      if (en) { setEnergy(en.value); return; }
      const va = VALUE.find((x) => x.key === e.key);
      if (va) { setValue(va.value); return; }
      if (e.key === 'Enter' && energy && value) submit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [energy, value, submit]);

  if (isLoading) return <FullPageSpinner label="Loading your week" />;
  if (error) return <Alert tone="error" className="m-4">{error.message}</Alert>;

  const total = groups.length;
  const progress = total ? Math.round((done.length / total) * 100) : 0;
  const remainingMin = Math.max(1, Math.ceil((total - done.length) * 0.4));

  async function finish() {
    await complete.mutateAsync(sessionId);
    navigate(paths.sortResult(sessionId));
  }

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--ground)' }}>
      <header className="d-flex flex-wrap align-items-center gap-3 px-4 py-3 bg-white border-bottom">
        <Logo size="1.2rem" />
        <span className="fs-ui text-muted-3 d-none d-md-inline">Where did last week go?</span>
        <div className="ms-auto d-flex align-items-center gap-3">
          <span className="numeral fs-ui">{done.length} of {total}</span>
          <div
            className="rounded-pill overflow-hidden" style={{ width: 150, height: 5, background: 'var(--sunken)' }}
            role="progressbar" aria-valuenow={done.length} aria-valuemin={0} aria-valuemax={total}
            aria-label="Groups classified"
          >
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--verified)' }} />
          </div>
          {current && <span className="fs-caption text-muted-3 d-none d-sm-inline">about {remainingMin} min left</span>}
        </div>
      </header>

      <main id="main" className="flex-grow-1 px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>
          {failure && <Alert tone="error" className="mb-3">{failure}</Alert>}

          <div className="row g-4">
            <div className="col-12 col-lg-8">
              {current ? (
                <>
                  <section className="surface p-4 mb-3">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className="chip chip-neutral">
                        {current.eventCount} {current.eventCount === 1 ? 'occurrence' : 'occurrences'} grouped
                      </span>
                      <span className="chip chip-neutral">{current.frequency.replace('_', ' ')}</span>
                    </div>
                    <h1 className="display-serif mb-2" style={{ fontSize: '2rem' }}>{current.title}</h1>
                    <p className="numeral fs-ui text-muted-2 mb-3">
                      {formatDuration(current.totalMinutes)} last week
                    </p>

                    {current.occurrences?.length > 1 && (
                      <ul className="list-unstyled mb-0 border rounded p-2" style={{ background: 'var(--ground)' }}>
                        {current.occurrences.slice(0, 6).map((o, i) => (
                          <li key={i} className="d-flex gap-3 fs-ui-sm py-1 text-muted-2">
                            <span className="flex-grow-1 text-truncate">{o.label}</span>
                            <span className="numeral">{formatDuration(o.durationMinutes)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="surface p-4">
                    <fieldset className="border-0 p-0 m-0 mb-4">
                      <legend className="fs-body fw-semibold mb-3">How does this work feel?</legend>
                      <div className="d-flex flex-wrap gap-2">
                        {ENERGY.map((e) => (
                          <button
                            key={e.value}
                            type="button"
                            onClick={() => setEnergy(e.value)}
                            aria-pressed={energy === e.value}
                            className="btn flex-grow-1 flex-column gap-1 py-3"
                            style={{
                              minWidth: 150, minHeight: 78,
                              border: energy === e.value ? `2px solid ${e.color}` : '1.5px solid var(--line-strong)',
                              background: energy === e.value ? 'var(--sunken)' : 'var(--surface)',
                            }}
                          >
                            <span className="drip-dot" style={{ background: e.color, width: 11, height: 11 }} aria-hidden="true" />
                            <span className="fs-body fw-semibold">{e.label}</span>
                            <span className="fs-caption text-muted-3">{e.hint} · press {e.key}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="border-0 p-0 m-0">
                      <legend className="fs-body fw-semibold mb-3">And what is it worth to the business?</legend>
                      <div className="d-flex flex-wrap gap-2">
                        {VALUE.map((v) => (
                          <button
                            key={v.value}
                            type="button"
                            onClick={() => setValue(v.value)}
                            aria-pressed={value === v.value}
                            className="btn flex-grow-1 flex-column gap-0 py-2"
                            style={{
                              minWidth: 110,
                              border: value === v.value ? '2px solid var(--ink)' : '1.5px solid var(--line-strong)',
                              background: 'var(--surface)',
                            }}
                          >
                            <span className="fs-ui fw-semibold">{v.label}</span>
                            <span className="fs-caption text-muted-3">{v.key}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <div className="d-flex flex-wrap align-items-center gap-2 pt-3 mt-3 border-top">
                      <span className="fs-caption text-muted-3">
                        Classifying {current.eventCount} {current.eventCount === 1 ? 'entry' : 'entries'} at once ·
                        you can change any of this later
                      </span>
                      <div className="ms-auto d-flex gap-2">
                        <Button
                          variant="quiet"
                          onClick={() => skip.mutate(current.id)}
                          disabled={skip.isPending || classify.isPending}
                        >
                          Not work — skip
                        </Button>
                        <Button
                          onClick={submit}
                          disabled={!energy || !value}
                          loading={classify.isPending}
                          loadingLabel="Saving"
                        >
                          Next group
                        </Button>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <section className="surface p-4 p-sm-5 text-center">
                  <h1 className="display-serif mb-2" style={{ fontSize: '2rem' }}>That is your week, sorted.</h1>
                  <p className="fs-ui text-muted-2 mb-4">
                    {done.length} {done.length === 1 ? 'group' : 'groups'} classified in one sitting.
                  </p>
                  <Button onClick={finish} loading={complete.isPending} loadingLabel="Finishing">
                    See what it cost you
                  </Button>
                </section>
              )}
            </div>

            <div className="col-12 col-lg-4">
              <section className="surface p-3 mb-3">
                <h2 className="eyebrow mb-2">So far</h2>
                <p className="mb-1 d-flex align-items-baseline gap-2">
                  <span className="numeral" style={{ fontSize: '1.75rem', color: 'var(--warn)' }}>
                    {formatDuration(drainingMinutes)}
                  </span>
                  <span className="fs-ui text-muted-3">in draining work</span>
                </p>
                <p className="fs-caption text-muted-2 mb-0">
                  That is{' '}
                  <span className="numeral text-warn">
                    {formatMoney(Math.round((drainingMinutes / 60) * buybackRateMinor), currency)}
                  </span>{' '}
                  of your week at your buyback rate — a planning estimate, not a valuation.
                </p>
              </section>

              <section className="surface p-3">
                <h2 className="eyebrow mb-2">Groups</h2>
                <ul className="list-unstyled stack gap-1 mb-0">
                  {groups.map((g) => {
                    const isCurrent = current?.id === g.id;
                    return (
                      <li
                        key={g.id}
                        className="d-flex align-items-center gap-2 px-2 py-1 rounded"
                        style={{
                          background: isCurrent ? 'var(--sunken)' : 'transparent',
                          fontWeight: isCurrent ? 600 : 400,
                        }}
                      >
                        {g.decidedAt && !g.skipped
                          ? <DripDot quadrant={g.dripQuadrant} size={9} />
                          : <span className="drip-dot" style={{ background: 'var(--line-strong)', width: 9, height: 9 }} aria-hidden="true" />}
                        <span className="fs-ui-sm flex-grow-1 text-truncate">{g.title}</span>
                        <span className="numeral fs-caption text-muted-3">{formatDuration(g.totalMinutes)}</span>
                      </li>
                    );
                  })}
                </ul>
                {decidedMinutes > 0 && (
                  <p className="fs-caption text-muted-3 mb-0 mt-2 pt-2 border-top">
                    <span className="numeral">{formatDuration(decidedMinutes)}</span> classified so far
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
