import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { VALUE_ANSWERS } from './value.js';
import { useUnsortedActivities, useSetActivityValue, useRefreshWorkspace } from '../../lib/api/hooks.js';
import { paths } from '../../routes/paths.js';

/**
 * One activity at a time, one question, three answers.
 *
 * A card rather than a list, because this is the only reflective thinking the
 * product asks for and a grid of twelve dropdowns turns it into data entry. The
 * question is the same every time; only the name changes, so the reader settles
 * into a rhythm rather than re-reading.
 *
 * Each answer saves immediately. Somebody who gives up after five has sorted five,
 * and comes back to seven — which matters, because this is the one screen people
 * will abandon halfway.
 */
export default function SortPage() {
  const navigate = useNavigate();
  const { data, isPending, isError, error } = useUnsortedActivities();
  const setValue = useSetActivityValue();
  const refreshWorkspace = useRefreshWorkspace();

  const [index, setIndex] = useState(0);
  const [saveError, setSaveError] = useState(null);

  const activities = data?.activities ?? [];
  const activity = activities[index];

  const finish = async () => {
    await refreshWorkspace();
    navigate(paths.app, { replace: true });
  };

  const answer = async (value) => {
    setSaveError(null);
    try {
      await setValue.mutateAsync({ id: activity.id, value });
      if (index + 1 < activities.length) setIndex(index + 1);
      else await finish();
    } catch (err) {
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

  // Nothing to sort: reached by someone who already finished, or by typing the URL.
  if (!activity) {
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

  return (
    <main id="main" tabIndex={-1} className="page-width app-page measure">

      <h1 className="app-header__title">What matters?</h1>
      <p className="app-header__subtitle">
        One question each, asked once. Hours and energy change every week; this barely does.
      </p>

      <p className="sort-progress" aria-live="polite">
        {index + 1} of {activities.length}
      </p>

      <Alert tone="error">{saveError}</Alert>

      <section className="sort-card" aria-labelledby="sort-question">
        <p className="sort-card__activity">{activity.name}</p>

        <h2 id="sort-question" className="sort-card__question">
          If you stopped doing this for a month, what happens?
        </h2>

        <div className="sort-card__answers">
          {VALUE_ANSWERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="sort-answer"
              disabled={setValue.isPending}
              onClick={() => answer(option.value)}
            >
              <span className="sort-answer__label">{option.label}</span>
              <span className="sort-answer__description">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sort-actions">
        {/* Saved as you go, so leaving loses nothing. Saying so is what makes it
            true for the reader as well as for the database. */}
        <button type="button" className="btn btn-link" onClick={finish}>
          Finish later — answers so far are saved
        </button>
      </div>
    </main>
  );
}
