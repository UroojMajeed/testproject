import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { SubmitButton } from '../../components/ui/SubmitButton.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { EnergyPicker } from './EnergyPicker.jsx';
import { useCurrentAudit, useActivities, useSaveAudit } from '../../lib/api/hooks.js';
import { useSubmit } from '../auth/useSubmit.js';
import { formatWeekRange, hoursToMinutes, minutesToHours, formatDuration } from '../../lib/money.js';
import { paths } from '../../routes/paths.js';

/**
 * Last week, recalled.
 *
 * The design constraint is the whole product: this has to be a ten-minute job the
 * first time and a two-minute one every Friday after. That is why the rows arrive
 * pre-filled from last week's answers, why hours are typed in hours rather than
 * minutes, and why there is exactly one judgement per activity instead of three.
 */

let rowKey = 0;
const newRow = (over = {}) => ({
  key: `row-${(rowKey += 1)}`,
  activityId: null,
  activityName: '',
  hours: '',
  energy: null,
  ...over,
});

export default function AuditPage() {
  const navigate = useNavigate();
  const audit = useCurrentAudit();
  const activities = useActivities();
  const [rows, setRows] = useState([]);
  const [isTypical, setIsTypical] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  const week = audit.data?.week;
  const save = useSaveAudit(week?.weekStarting);

  const names = useMemo(
    () => new Map((activities.data?.activities ?? []).map((a) => [a.id, a.name])),
    [activities.data],
  );

  /**
   * Seed the form once both calls have landed.
   *
   * Entries already saved win over suggestions — somebody returning to a draft
   * should see what they typed, not last week's numbers again.
   */
  useEffect(() => {
    if (!audit.data || !activities.data || rows.length) return;

    const source = week.entries.length
      ? week.entries.map((entry) => newRow({
        activityId: entry.activityId,
        activityName: names.get(entry.activityId) ?? '',
        hours: minutesToHours(entry.estimatedMinutes),
        energy: entry.energy,
      }))
      // Hours carry forward; energy deliberately does not. It is the thing most
      // likely to have changed, and a pre-filled answer is one nobody re-reads.
      : (audit.data.suggestions ?? []).map((s) => newRow({
        activityId: s.activityId,
        activityName: names.get(s.activityId) ?? '',
        hours: minutesToHours(s.estimatedMinutes),
        energy: null,
      }));

    setRows(source.length ? source : [newRow(), newRow(), newRow()]);
    setIsTypical(week.isTypical);
  }, [audit.data, activities.data, week, names, rows.length]);

  const update = (key, patch) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const filled = rows.filter((row) => row.activityName.trim() && row.hours !== '');
  const incomplete = filled.filter((row) => row.energy === null);
  const totalMinutes = filled.reduce((sum, row) => sum + hoursToMinutes(row.hours), 0);

  const { pending, formError, run } = useSubmit({
    onSuccess: () => navigate(paths.app, { replace: true }),
  });

  const submit = (status) => {
    if (status === 'complete') {
      setShowErrors(true);
      if (!filled.length || incomplete.length) return;
    }

    run(() => save.mutateAsync({
      isTypical,
      status,
      entries: filled.map((row) => ({
        // An id when the row came from an existing activity, a name when it was
        // typed. Never both — the API refuses that, because it would silently
        // create a duplicate beside the one that was picked.
        ...(row.activityId ? { activityId: row.activityId } : { activityName: row.activityName.trim() }),
        estimatedMinutes: hoursToMinutes(row.hours),
        energy: row.energy ?? 0,
      })),
    }));
  };

  if (audit.isPending || activities.isPending) return <FullPageSpinner label="Opening last week" />;

  if (audit.isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{audit.error?.userMessage ?? 'Could not open this week.'}</Alert>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <p className="mb-5"><Logo /></p>

      <h1 className="app-header__title">What did last week go on?</h1>
      <p className="app-header__subtitle mb-2">
        {formatWeekRange(week.weekStarting, week.weekEnding)} — about a dozen things you did more than once.
        Rough hours are fine; this is recall, not a timesheet.
      </p>

      <Alert tone="error">{formError}</Alert>
      {showErrors && !filled.length ? (
        <Alert tone="error">Add at least one activity before finishing the week.</Alert>
      ) : null}
      {showErrors && incomplete.length ? (
        <Alert tone="error">
          Say how {incomplete.length === 1 ? 'one activity' : `${incomplete.length} activities`} felt before finishing.
        </Alert>
      ) : null}

      <ol className="audit-rows">
        {rows.map((row, index) => (
          <li key={row.key} className="audit-row">
            <div className="audit-row__top">
              <label className="audit-row__name">
                <span className="visually-hidden">Activity {index + 1}</span>
                <input
                  className="form-control"
                  placeholder="Invoicing, sales calls, answering email…"
                  value={row.activityName}
                  // Typing over a suggested activity makes it a new one, otherwise
                  // a rename here would silently retitle last week's history too.
                  onChange={(e) => update(row.key, {
                    activityName: e.target.value,
                    activityId: names.get(row.activityId) === e.target.value ? row.activityId : null,
                  })}
                />
              </label>

              <label className="audit-row__hours">
                <span className="visually-hidden">Hours on {row.activityName || `activity ${index + 1}`}</span>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    // A week holds 168 hours. The spinner should not offer more,
                    // and it should certainly not offer less than none.
                    max="168"
                    placeholder="0"
                    value={row.hours}
                    onChange={(e) => update(row.key, { hours: e.target.value })}
                  />
                  <span className="input-group-text" aria-hidden="true">h</span>
                </div>
              </label>

            </div>

            {row.activityName.trim() ? (
              <EnergyPicker
                name={row.key}
                value={row.energy}
                activityLabel={row.activityName}
                onChange={(energy) => update(row.key, { energy })}
              />
            ) : null}

            {/*
              Last in the DOM, and last visually, so the two agree.
              It used to sit beside the hours field, which put "Remove" between the
              hours and the energy choice in the tab order — a keyboard user filling
              in a row met the delete button halfway through.
            */}
            <div className="audit-row__actions">
              <button
                type="button"
                className="btn btn-link audit-row__remove"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                <span className="visually-hidden">Remove {row.activityName || `activity ${index + 1}`}</span>
                <span aria-hidden="true">Remove</span>
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn-outline-secondary" onClick={() => setRows((c) => [...c, newRow()])}>
        Add another activity
      </button>

      <div className="audit-total" aria-live="polite">
        <span className="audit-total__label">Accounted for so far</span>
        <span className="audit-total__value numeric">{formatDuration(totalMinutes)}</span>
      </div>

      <label className="audit-typical">
        <input type="checkbox" className="form-check-input" checked={!isTypical}
          onChange={(e) => setIsTypical(!e.target.checked)} />
        <span>
          <strong>Last week was not typical.</strong>{' '}
          A holiday, a launch, the week everything caught fire — say so and it will not be
          used as the yardstick everything else is measured against.
        </span>
      </label>

      <div className="audit-actions">
        <SubmitButton type="button" pending={pending} pendingLabel="Saving…"
          className="audit-actions__primary" onClick={() => submit('complete')}>
          Finish the week
        </SubmitButton>
        <button type="button" className="btn btn-link" disabled={pending} onClick={() => submit('draft')}>
          Save and come back to it
        </button>
      </div>
    </main>
  );
}
