import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { VALUE_ANSWERS } from '../sort/value.js';
import { formatDate } from '../../lib/formatters.js';
import {
  useActivities, useRenameActivity, useArchiveActivity, useSetActivityValue, useRefreshWorkspace,
} from '../../lib/api/hooks.js';
import { paths } from '../../routes/paths.js';

/**
 * The activities, as a place rather than an event.
 *
 * Until now an activity's value could be set exactly once, on a funnel screen you
 * could only reach while something was unanswered. Change your mind about
 * invoicing and there was no way to say so — which is a strange thing for a
 * product whose whole output is a judgement to make about each activity.
 *
 * So: one row each, the answer changeable, the name changeable, and archiving for
 * the things you have stopped doing. The sort screen keeps its job — the first
 * pass, one card at a time — and this is where corrections happen.
 */
export default function ActivitiesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isPending, isError, error } = useActivities({ includeArchived: showArchived });
  const [failure, setFailure] = useState(null);

  if (isPending) return <FullPageSpinner label="Loading your activities" />;

  if (isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{error?.userMessage ?? 'Could not load your activities.'}</Alert>
      </main>
    );
  }

  const activities = data.activities ?? [];
  const live = activities.filter((a) => !a.archived);
  const unanswered = live.filter((a) => !a.value).length;

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <header className="app-header">
        <div>
          <h1 className="app-header__title">Your activities</h1>
          <p className="app-header__subtitle">
            The things that keep coming back. Hours and energy are recorded every week;
            what each one is worth is answered once and changed here.
          </p>
        </div>
      </header>

      <Alert tone="error">{failure}</Alert>

      {unanswered > 0 ? (
        <p className="activities-gap">
          {unanswered === 1
            ? 'One activity has no answer yet, so it is missing from the matrix.'
            : `${unanswered} activities have no answer yet, so they are missing from the matrix.`}
          {' '}
          <Link to={paths.sort}>Answer them one at a time</Link>
        </p>
      ) : null}

      {!activities.length ? (
        <section className="notice">
          <h2 className="notice__title">Nothing here yet</h2>
          <p className="notice__body mb-4">
            Activities appear as you name them in a weekly audit. There is nothing to
            keep a list of until you have recorded a week.
          </p>
          <Link to={paths.audit} className="btn btn-primary">Record a week</Link>
        </section>
      ) : (
        <ul className="activity-rows">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} onFailure={setFailure} />
          ))}
        </ul>
      )}

      <label className="activities-archived">
        <input
          type="checkbox"
          className="form-check-input"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        <span>Show the ones I have archived</span>
      </label>
    </main>
  );
}

function ActivityRow({ activity, onFailure }) {
  const rename = useRenameActivity();
  const archive = useArchiveActivity();
  const setValue = useSetActivityValue();
  const refresh = useRefreshWorkspace();

  const [name, setName] = useState(activity.name);
  const [confirming, setConfirming] = useState(false);
  /**
   * The chosen answer, held locally until the refetch lands.
   *
   * The select is controlled by the server's copy, and invalidating means the new
   * one arrives a moment later — so without this the option visibly snaps back to
   * the old answer and then forward again, which reads as a failure.
   *
   * `fromServer` is what makes it safe. Seeded once, this broke badly: the audit
   * screen and this one share a query key, so arriving from the audit renders the
   * rows from cache that predates the sort — every answer null — and the values
   * that landed a moment later were never picked up. Every activity read as
   * unanswered. Re-seeding when the server's copy changes is the fix, and it still
   * lets a local choice win immediately.
   */
  const [chosen, setChosen] = useState(activity.value ?? '');
  const [fromServer, setFromServer] = useState(activity.value ?? '');
  if ((activity.value ?? '') !== fromServer) {
    setFromServer(activity.value ?? '');
    setChosen(activity.value ?? '');
  }

  const busy = rename.isPending || archive.isPending || setValue.isPending;
  const report = (err, fallback) => onFailure(err?.userMessage ?? fallback);

  /**
   * Saved on blur rather than behind an Edit button and a Save button.
   *
   * The guard matters more than it looks: without it every visit to the field and
   * away again is a PATCH, and the server answers 409 if the name is unchanged and
   * already taken — by this same row.
   */
  const commitName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === activity.name) {
      setName(activity.name);
      return;
    }
    onFailure(null);
    try {
      await rename.mutateAsync({ id: activity.id, name: trimmed });
    } catch (err) {
      setName(activity.name);
      report(err, 'Could not rename that.');
    }
  };

  const answer = async (value) => {
    onFailure(null);
    setChosen(value);
    try {
      await setValue.mutateAsync({ id: activity.id, value });
      /*
       * The sort screen's mutation deliberately invalidates nothing — refetching
       * between cards would reorder the deck under the reader's hand. Here the
       * opposite is true: an answer changes which quadrant the activity is in, and
       * without this the dashboard kept showing a matrix that no longer matched.
       */
      await refresh();
    } catch (err) {
      setChosen(activity.value ?? '');
      report(err, 'Could not save that answer.');
    }
  };

  const doArchive = async () => {
    onFailure(null);
    try {
      await archive.mutateAsync(activity.id);
    } catch (err) {
      report(err, 'Could not archive that.');
    }
  };

  return (
    <li className={`activity-row${activity.archived ? ' is-archived' : ''}`}>
      <div className="activity-row__main">
        <label className="activity-row__name">
          <span className="visually-hidden">Name of {activity.name}</span>
          <input
            className="form-control"
            value={name}
            disabled={activity.archived || busy}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </label>

        <label className="activity-row__value">
          <span className="visually-hidden">If you stopped {activity.name} for a month</span>
          <select
            className="form-select"
            value={chosen}
            disabled={activity.archived || busy}
            onChange={(e) => answer(e.target.value)}
          >
            {/*
              No way back to "not answered": the API takes one of three answers and
              nothing else, and an option that always fails is worse than none.
            */}
            {chosen ? null : <option value="" disabled>Not answered</option>}
            {VALUE_ANSWERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="activity-row__foot">
        {/*
          Not a repeat of the answer — the select beside it already says that, and
          a line that only echoes the control above it is a wasted row. When the
          answer was given is what the select cannot say, and it matters for a
          field that is meant to hold still: an answer from eight months ago is
          worth a second look.
        */}
        <p className="activity-row__meta">
          {activity.archived
            ? 'Archived — name it in an audit and it comes back'
            : activity.valueSetAt
              ? `Answered ${formatDate(activity.valueSetAt)}`
              : 'Not answered yet'}
        </p>

        {activity.archived ? null : confirming ? (
          <span className="activity-row__confirm">
            <span className="fs-sm">Archive it?</span>
            <button type="button" className="btn btn-link btn-sm" disabled={busy} onClick={doArchive}>
              Yes, archive
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-link btn-sm activity-row__archive"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <span className="visually-hidden">Archive {activity.name}</span>
            <span aria-hidden="true">Archive</span>
          </button>
        )}
      </div>
    </li>
  );
}
