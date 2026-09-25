import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  // Returning to a week already recorded. Without saying so the screen offered to
  // "finish" a week that was finished, and looked identical to never having filed.
  const filed = week?.status === 'complete';

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

    // One row, not three. Three identical empty cards is a form to be filled in;
    // one is a question to be answered, and the next appears as soon as it is.
    // A seeded week gets a trailing empty row for the same reason — and because
    // without it a week already filed had nowhere to add anything.
    setRows(source.length ? [...source, newRow()] : [newRow()]);
    setIsTypical(week.isTypical);
  }, [audit.data, activities.data, week, names, rows.length]);

  /**
   * Patch a row, and keep exactly one empty row at the end.
   *
   * Naming the last activity means there is probably another, so the next box is
   * already there to type into — no reaching for a button between every entry.
   */
  const update = (key, patch) =>
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));
      const last = next[next.length - 1];
      return last && last.activityName.trim() ? [...next, newRow()] : next;
    });

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
    <main id="main" tabIndex={-1} className="page-width app-page app-page--wide">

      <h1 className="app-header__title">{filed ? 'This week is filed' : 'Where did last week go?'}</h1>
      <p className="app-header__subtitle mb-2">
        {formatWeekRange(week.weekStarting, week.weekEnding)}
        {filed
          ? ' — already recorded. Change anything you got wrong and save it again.'
          : ' — about a dozen things you did more than once. Rough hours are fine; this is recall, not a timesheet.'}
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
          <li
            key={row.key}
            className={`audit-row${row.activityName.trim() || row.hours !== '' ? '' : ' is-empty'}`}
          >
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

              {/*
                In the same grid as the name and the hours, so one activity reads
                as one line. It used to sit in a block of its own underneath, which
                made every row four times as tall and a dozen of them a scroll.
              */}
              {row.activityName.trim() ? (
                <EnergyPicker
                  name={row.key}
                  value={row.energy}
                  activityLabel={row.activityName}
                  onChange={(energy) => update(row.key, { energy })}
                />
              ) : <span className="audit-row__spacer" />}

            {/*
              Only for a row with something in it. Remove on an empty box offers to
              delete nothing, and the trailing box is always empty — so every list
              ended with an action that could not do anything.

              Last in the DOM, and last visually, so the two agree. It used to sit
              beside the hours field, which put "Remove" between the hours and the
              energy choice in the tab order — a keyboard user filling in a row met
              the delete button halfway through.
            */}
              {row.activityName.trim() || row.hours !== '' ? (
                <button
                  type="button"
                  className="btn btn-link audit-row__remove"
                  onClick={() => setRows((current) => {
                    const kept = current.filter((r) => r.key !== row.key);
                    // Never leave the list with nothing to type into.
                    return kept.length ? kept : [newRow()];
                  })}
                >
                  <span className="visually-hidden">Remove {row.activityName || `activity ${index + 1}`}</span>
                  <span aria-hidden="true">Remove</span>
                </button>
              ) : <span className="audit-row__spacer-remove" />}
            </div>
          </li>
        ))}
      </ol>

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
          {filed ? 'Save the changes' : 'Finish the week'}
        </SubmitButton>
        {/* A filed week has nothing to come back to: it is already saved. */}
        {filed ? null : (
          <button type="button" className="btn btn-link" disabled={pending} onClick={() => submit('draft')}>
            Save and come back to it
          </button>
        )}
      </div>
    </main>
  );
}
