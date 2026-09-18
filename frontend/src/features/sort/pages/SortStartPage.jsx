import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStartSort, useActiveSort } from '../../../lib/api/hooks.js';
import { paths } from '../../../routes/paths.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';
import { FullPageSpinner } from '../../../components/ui/FullPageSpinner.jsx';
import { formatDuration } from '../../../lib/formatters.js';

const SUGGESTIONS = [
  { title: 'Inbox and email', minutes: 45, times: 5 },
  { title: 'Client calls', minutes: 45, times: 4 },
  { title: 'Weekly reporting', minutes: 90, times: 2 },
  { title: 'Invoicing and chasing payment', minutes: 30, times: 2 },
  { title: 'Team standup', minutes: 30, times: 4 },
  { title: 'Proposal writing', minutes: 75, times: 2 },
  { title: 'Deep work — product', minutes: 120, times: 2 },
  { title: 'Admin and scheduling', minutes: 30, times: 3 },
];

const blank = () => ({ key: crypto.randomUUID(), title: '', minutes: 60, times: 1 });

export default function SortStartPage() {
  const navigate = useNavigate();
  const { data: activeData, isLoading } = useActiveSort();
  const startSort = useStartSort();
  const [rows, setRows] = useState([blank()]);
  const [error, setError] = useState(null);

  if (isLoading) return <FullPageSpinner label="Checking for a sort in progress" />;
  if (activeData?.session) {
    navigate(paths.sortSession(activeData.session.id), { replace: true });
    return <FullPageSpinner label="Resuming your sort" />;
  }

  const filled = rows.filter((r) => r.title.trim());
  const totalMinutes = filled.reduce((s, r) => s + r.minutes * r.times, 0);

  const patch = (key, next) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));
  const addSuggestion = (s) =>
    setRows((rs) => [...rs.filter((r) => r.title.trim()), { ...s, key: crypto.randomUUID() }, blank()]);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!filled.length) { setError('Add at least one activity before continuing.'); return; }

    // The server does the grouping — the client only supplies raw occurrences.
    const activities = filled.flatMap((r) =>
      Array.from({ length: r.times }, (_, i) => ({
        title: r.title.trim(),
        durationMinutes: r.minutes,
        startAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
      })),
    );

    try {
      const { session } = await startSort.mutateAsync({ source: 'recall', windowDays: 7, activities });
      navigate(paths.sortSession(session.id));
    } catch (err) {
      setError(err.message ?? 'We could not start the sort.');
    }
  }

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--ground)' }}>
      <header className="d-flex align-items-center gap-3 px-4 py-3">
        <Logo />
        <span className="fs-ui text-muted-3">Where did last week go?</span>
      </header>

      <main id="main" className="flex-grow-1 px-4 pb-5">
        <div className="mx-auto" style={{ maxWidth: 760 }}>
          <div className="stack gap-2 mb-4">
            <h1 className="display-serif mb-0" style={{ fontSize: '2.25rem' }}>
              What did last week actually look like?
            </h1>
            <p className="fs-ui text-muted-2 mb-0 max-ch">
              Rough is fine. List what you did and roughly how long — we group the repeats for you, so
              the next screen asks about a dozen things rather than thirty.
            </p>
          </div>

          {error && <Alert tone="error" className="mb-3">{error}</Alert>}

          <form onSubmit={onSubmit} noValidate>
            <div className="surface p-3 p-sm-4 mb-3">
              <div className="d-none d-sm-flex gap-2 mb-2 fs-caption text-muted-3">
                <span className="flex-grow-1">Activity</span>
                <span style={{ width: 110 }}>Minutes each</span>
                <span style={{ width: 96 }}>How many</span>
                <span style={{ width: 44 }} />
              </div>

              <ul className="list-unstyled stack gap-2 mb-3">
                {rows.map((row, index) => (
                  <li key={row.key} className="d-flex flex-wrap gap-2 align-items-end">
                    <div className="stack flex-grow-1" style={{ minWidth: 200 }}>
                      <label className="form-label d-sm-none" htmlFor={`t-${row.key}`}>Activity</label>
                      <input
                        id={`t-${row.key}`}
                        className="form-control"
                        placeholder="e.g. Weekly client report"
                        value={row.title}
                        onChange={(e) => patch(row.key, { title: e.target.value })}
                        onBlur={() => {
                          if (row.title.trim() && index === rows.length - 1) setRows((rs) => [...rs, blank()]);
                        }}
                      />
                    </div>
                    <div className="stack" style={{ width: 110 }}>
                      <label className="form-label d-sm-none" htmlFor={`m-${row.key}`}>Minutes</label>
                      <input
                        id={`m-${row.key}`} type="number" min={5} max={600} step={5}
                        className="form-control"
                        value={row.minutes}
                        onChange={(e) => patch(row.key, { minutes: Number(e.target.value) || 5 })}
                      />
                    </div>
                    <div className="stack" style={{ width: 96 }}>
                      <label className="form-label d-sm-none" htmlFor={`n-${row.key}`}>How many</label>
                      <input
                        id={`n-${row.key}`} type="number" min={1} max={20}
                        className="form-control"
                        value={row.times}
                        onChange={(e) => patch(row.key, { times: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-quiet px-2"
                      style={{ width: 44 }}
                      onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== row.key) : [blank()]))}
                      aria-label={`Remove ${row.title || 'this row'}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="d-flex flex-wrap align-items-center gap-2 pt-3 border-top">
                <span className="fs-ui text-muted-2">
                  {filled.length} {filled.length === 1 ? 'activity' : 'activities'} ·{' '}
                  <span className="numeral">{formatDuration(totalMinutes)}</span> total
                </span>
                <Button
                  type="submit"
                  className="ms-auto"
                  loading={startSort.isPending}
                  loadingLabel="Grouping"
                  disabled={!filled.length}
                >
                  Group and start sorting
                </Button>
              </div>
            </div>

            <section aria-labelledby="suggestions" className="surface p-3">
              <h2 id="suggestions" className="eyebrow mb-2">Common ones, if it helps</h2>
              <ul className="list-unstyled d-flex flex-wrap gap-2 mb-0">
                {SUGGESTIONS.map((s) => (
                  <li key={s.title}>
                    <button
                      type="button"
                      className="btn btn-outline-ink fs-ui-sm py-1 px-2"
                      style={{ minHeight: '2.25rem' }}
                      onClick={() => addSuggestion(s)}
                    >
                      + {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </form>
        </div>
      </main>
    </div>
  );
}
