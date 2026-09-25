import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { VALUE_ANSWERS } from './value.js';
import { useUnsortedActivities, useSetActivityValue, useRefreshWorkspace } from '../../lib/api/hooks.js';
import { paths } from '../../routes/paths.js';

/**
 * One question about each activity, all on one screen.
 *
 * This was a deck of cards, one at a time, and it was the wrong shape: it arrives
 * straight after the audit, so somebody has just finished filling in a form and is
 * then made to click through five more screens before they are allowed to see the
 * figures they came for. Being able to see how much is left, and to answer it in
 * whatever order suits, turns a gauntlet into a list.
 *
 * Each answer still saves the moment it is given, so leaving halfway keeps every
 * answer already made.
 */
export default function SortPage() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useUnsortedActivities();
  const setValue = useSetActivityValue();
  const refreshWorkspace = useRefreshWorkspace();

  // Answers held locally as they are given: refetching the list between answers
  // would pull rows out from under the reader mid-question.
  const [answers, setAnswers] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const activities = data?.activities ?? [];
  const answered = activities.filter((a) => answers[a.id]).length;

  const finish = async () => {
    setLeaving(true);
    await refreshWorkspace();
    navigate(paths.app, { replace: true });
  };

  const answer = async (id, value) => {
    setSaveError(null);
    setAnswers((current) => ({ ...current, [id]: value }));
    try {
      await setValue.mutateAsync({ id, value });
    } catch (err) {
      setAnswers((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setSaveError(err?.userMessage ?? 'Could not save that. Try again.');
    }
  };

  if (isPending) return <FullPageSpinner label="Loading your activities" />;

  if (isError) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <Alert tone="error">{error?.userMessage ?? 'Could not load your activities.'}</Alert>
      </main>
    );
  }

  if (!activities.length) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page measure">
        <h1 className="app-header__title">Everything is sorted</h1>
        <p className="app-header__subtitle mb-5">
          Every activity has an answer. New ones will appear here as you add them.
        </p>
        <button type="button" className="btn btn-primary" onClick={finish}>Back to your week</button>
      </main>
    );
  }

  const all = answered === activities.length;

  return (
    <main id="main" tabIndex={-1} className="page-width app-page">
      <h1 className="app-header__title">One more question each</h1>
      <p className="app-header__subtitle">
        If you stopped doing it for a month, what happens? Asked once — hours and energy
        change every week, this barely does.
      </p>

      <Alert tone="error">{saveError}</Alert>

      <p className="sort-progress" aria-live="polite">
        {answered} of {activities.length} answered
      </p>

      <ul className="sort-list">
        {activities.map((activity) => (
          <li key={activity.id} className={`sort-item${answers[activity.id] ? ' is-answered' : ''}`}>
            <p className="sort-item__name" id={`sort-${activity.id}`}>{activity.name}</p>

            <div className="sort-item__answers" role="group" aria-labelledby={`sort-${activity.id}`}>
              {VALUE_ANSWERS.map((option) => {
                const chosen = answers[activity.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`sort-choice${chosen ? ' is-chosen' : ''}`}
                    // Not disabled while saving: answering five in a row should not
                    // mean waiting for each request before the next can be given.
                    aria-pressed={chosen}
                    title={option.description}
                    onClick={() => answer(activity.id, option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="sort-actions">
        <button type="button" className="btn btn-primary" disabled={leaving} onClick={finish}>
          {all ? 'See what it costs' : 'Done for now'}
        </button>
        {/* Saved as you go, so leaving loses nothing. Saying so is what makes that
            true for the reader as well as for the database. */}
        <p className="sort-actions__note">
          {all
            ? 'Every activity has an answer.'
            : 'Answers are saved as you give them — the rest can wait.'}
        </p>
      </div>
    </main>
  );
}
