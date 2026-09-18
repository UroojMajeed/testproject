import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEntries, useCreateEntry, useDeleteEntry, useEntrySummary } from '../../../lib/api/hooks.js';
import { useWorkspace } from '../../../context/WorkspaceContext.jsx';
import { paths } from '../../../routes/paths.js';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { QuadrantChip } from '../../../components/ui/Chip.jsx';
import { formatDuration, formatMoney, formatDate } from '../../../lib/formatters.js';
import { CATEGORY_OPTIONS } from '../../../lib/constants.js';

const ENERGY_OPTIONS = [
  { value: 'low', label: 'Draining' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'high', label: 'Energising' },
];
const VALUE_OPTIONS = [
  { value: 'low', label: 'Low value' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'strategic', label: 'Strategic' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function AuditPage() {
  const { currency } = useWorkspace();
  const { data, isLoading, error } = useEntries({ limit: 100 });
  const { data: summary } = useEntrySummary({});
  const createEntry = useCreateEntry();
  const deleteEntry = useDeleteEntry();

  const [form, setForm] = useState({
    title: '', durationMinutes: 60, category: 'other', energy: 'neutral', value: 'medium', date: today(),
  });
  const [formError, setFormError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim()) { setFormError('What did you work on?'); return; }

    try {
      await createEntry.mutateAsync({
        ...form,
        title: form.title.trim(),
        durationMinutes: Number(form.durationMinutes),
        date: new Date(`${form.date}T12:00:00Z`).toISOString(),
        source: 'manual',
        precision: 'timed',
      });
      setForm((f) => ({ ...f, title: '' }));
    } catch (err) {
      setFormError(err.message ?? 'We could not save that entry.');
    }
  }

  const entries = data?.entries ?? [];
  const byDay = entries.reduce((acc, entry) => {
    const key = new Date(entry.date).toISOString().slice(0, 10);
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="Time audit"
        title="What you actually did"
        subtitle={summary ? `${formatDuration(summary.summary.trackedMinutes)} tracked in the last 14 days` : undefined}
        actions={<Link to={paths.sortStart} className="btn btn-outline-ink">Sort a whole week instead</Link>}
      />

      <section className="surface p-3 p-sm-4 mb-4" aria-labelledby="add-entry">
        <h3 id="add-entry" className="fs-body fw-semibold mb-3">Add an entry</h3>
        {formError && <Alert tone="error" className="mb-3">{formError}</Alert>}

        <form onSubmit={onSubmit} noValidate className="row g-2 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label" htmlFor="e-title">What did you work on?</label>
            <input
              id="e-title" className="form-control" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Weekly client report" required
            />
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <label className="form-label" htmlFor="e-date">Date</label>
            <input
              id="e-date" type="date" max={today()} className="form-control" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="col-6 col-sm-4 col-lg-1">
            <label className="form-label" htmlFor="e-mins">Minutes</label>
            <input
              id="e-mins" type="number" min={1} max={1440} step={5} className="form-control"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <label className="form-label" htmlFor="e-cat">Category</label>
            <select id="e-cat" className="form-select" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-sm-6 col-lg-1">
            <label className="form-label" htmlFor="e-energy">Energy</label>
            <select id="e-energy" className="form-select" value={form.energy}
              onChange={(e) => setForm({ ...form, energy: e.target.value })}>
              {ENERGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-sm-6 col-lg-1">
            <label className="form-label" htmlFor="e-value">Value</label>
            <select id="e-value" className="form-select" value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}>
              {VALUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-12 col-lg-1 d-grid">
            <Button type="submit" loading={createEntry.isPending} loadingLabel="Saving">Add</Button>
          </div>
        </form>
      </section>

      {isLoading && <Skeleton height={240} />}
      {error && <Alert tone="error">{error.message}</Alert>}

      {!isLoading && !entries.length && (
        <EmptyState
          title="Nothing logged yet"
          action={<Link to={paths.sortStart} className="btn btn-primary">Sort last week in one go</Link>}
        >
          Add an entry above, or walk through a whole week at once — it takes about ten minutes and
          fills the matrix immediately.
        </EmptyState>
      )}

      {Object.entries(byDay).map(([day, dayEntries]) => {
        const total = dayEntries.reduce((s, e) => s + e.durationMinutes, 0);
        return (
          <section key={day} className="mb-4" aria-labelledby={`day-${day}`}>
            <div className="d-flex align-items-baseline gap-2 mb-2">
              <h3 id={`day-${day}`} className="fs-ui fw-semibold mb-0">{formatDate(day)}</h3>
              <span className="numeral fs-ui-sm text-muted-3">{formatDuration(total)}</span>
            </div>

            <ul className="list-unstyled stack gap-2 mb-0">
              {dayEntries.map((entry) => (
                <li key={entry.id} className="surface p-3 d-flex flex-wrap align-items-center gap-3">
                  <div className="stack gap-1 flex-grow-1" style={{ minWidth: 180 }}>
                    <span className="fs-ui fw-medium">{entry.title}</span>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <QuadrantChip quadrant={entry.dripQuadrant} />
                      <span className="chip chip-neutral">{entry.category}</span>
                      {entry.precision !== 'timed' && (
                        <span className="chip chip-estimated" title="A sorted estimate, not a timed measurement">
                          {entry.precision === 'calendar_sorted' ? 'from calendar' : 'recalled'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="numeral fs-ui">{formatDuration(entry.durationMinutes)}</span>
                  <span className="numeral fs-ui-sm text-muted-3" style={{ width: 70, textAlign: 'right' }}>
                    {formatMoney(entry.estimatedCostMinor, currency)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-quiet px-2"
                    onClick={() => deleteEntry.mutate(entry.id)}
                    aria-label={`Delete entry: ${entry.title}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
