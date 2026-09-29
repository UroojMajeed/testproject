import { useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { VALUE_ANSWERS } from '../../lib/drip.js';
import { useUnsortedActivities, useSetActivityValue, useRefreshWorkspace } from '../../lib/api/hooks.js';

/**
 * The value question, asked where the answer visibly does something.
 *
 * This used to be a screen of its own between the audit and the dashboard, and it
 * was one more thing standing between a person and the figures they came for. Here
 * the matrix is directly underneath: answer a row and watch the activity drop into
 * a quadrant with a price on it. Same question, same three answers, and now the
 * reason for asking is on screen while it is being asked.
 */
export function NeedsAnswer() {
  const { data, isPending } = useUnsortedActivities();
  const setValue = useSetActivityValue();
  const refresh = useRefreshWorkspace();

  // Held locally so a row does not vanish under the cursor the instant it is
  // answered — it fades out on the next refetch instead.
  const [answered, setAnswered] = useState({});
  const [failure, setFailure] = useState(null);

  const activities = (data?.activities ?? []).filter((a) => !answered[a.id]);

  if (isPending || !activities.length) return null;

  const answer = async (id, value) => {
    setFailure(null);
    setAnswered((current) => ({ ...current, [id]: value }));
    try {
      await setValue.mutateAsync({ id, value });
      // The matrix below is built from this answer, so it has to be told.
      await refresh();
    } catch (err) {
      setAnswered((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setFailure(err?.userMessage ?? 'Could not save that. Try again.');
    }
  };

  return (
    <section className="needs" aria-labelledby="needs-heading">
      <h2 id="needs-heading" className="needs__title">
        {activities.length === 1
          ? 'One activity still needs an answer'
          : `${activities.length} activities still need an answer`}
      </h2>
      <p className="needs__lede">
        If you stopped doing it for a month, what happens? Asked once — hours and energy
        change every week, this barely does. Each answer places it below.
      </p>

      <Alert tone="error">{failure}</Alert>

      <ul className="needs__list">
        {activities.map((activity) => (
          <li key={activity.id} className="needs__item">
            <p className="needs__name" id={`needs-${activity.id}`}>{activity.name}</p>
            <div className="needs__answers" role="group" aria-labelledby={`needs-${activity.id}`}>
              {VALUE_ANSWERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="needs__choice"
                  title={option.description}
                  onClick={() => answer(activity.id, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
