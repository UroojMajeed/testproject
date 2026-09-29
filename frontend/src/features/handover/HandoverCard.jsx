import { useState } from 'react';
import { Alert } from '../../components/ui/Alert.jsx';
import { formatMoney, formatDuration } from '../../lib/money.js';
import { useSetHandoverStep, useUpdateHandover, useDropHandover } from '../../lib/api/hooks.js';

/**
 * One activity on its way out, and the list of what that takes.
 *
 * The checklist is the product here. A person who has decided to hand invoicing
 * over does not need persuading again — they need to know what the next concrete
 * thing is, and to be able to put it down and come back to it. So every tick
 * saves on the spot, and the card holds the server's answer rather than
 * refetching the list, which would reorder the cards under the cursor of
 * somebody working down one.
 */
export function HandoverCard({ handover: initial, name }) {
  const [handover, setHandover] = useState(initial);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [failure, setFailure] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const setStep = useSetHandoverStep();
  const update = useUpdateHandover();
  const drop = useDropHandover();

  const tick = async (key, done) => {
    setFailure(null);
    // Ticked on screen first, because a checkbox that waits for a round trip
    // before moving feels broken. Put back if the save fails.
    const before = handover;
    setHandover({
      ...handover,
      steps: handover.steps.map((s) => (s.key === key ? { ...s, done } : s)),
      doneCount: handover.doneCount + (done ? 1 : -1),
    });

    try {
      const { handover: saved } = await setStep.mutateAsync({ id: handover.id, key, done });
      setHandover(saved);
    } catch (err) {
      setHandover(before);
      setFailure(err?.userMessage ?? 'Could not save that.');
    }
  };

  const saveAssignee = async () => {
    if (assignee.trim() === handover.assignee) return;
    setFailure(null);
    try {
      const { handover: saved } = await update.mutateAsync({ id: handover.id, assignee: assignee.trim() });
      setHandover(saved);
    } catch (err) {
      setAssignee(handover.assignee);
      setFailure(err?.userMessage ?? 'Could not save that.');
    }
  };

  const done = handover.status === 'done';

  return (
    <article className={`handover${done ? ' is-done' : ''}`}>
      <header className="handover__head">
        <div>
          <h3 className="handover__name">{name ?? 'This activity'}</h3>
          <p className="handover__cost">
            Was costing <strong className="numeric">{formatDuration(handover.estimatedMinutesPerWeek)}</strong> a week
            {' · '}
            <strong className="numeric">{formatMoney(handover.estimatedAnnualCostMinor, handover.currency)}</strong> a year
            {/* The figure that justified the decision, kept as it was. */}
            <span className="handover__stamp"> at the rate when you decided</span>
          </p>
        </div>

        <p className="handover__progress numeric" aria-live="polite">
          {handover.doneCount} of {handover.stepCount}
        </p>
      </header>

      <Alert tone="error">{failure}</Alert>

      <ol className="handover__steps">
        {handover.steps.map((step) => (
          <li key={step.key} className={`handover__step${step.done ? ' is-done' : ''}`}>
            <label className="handover__check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={step.done}
                onChange={(e) => tick(step.key, e.target.checked)}
              />
              {/* Both spans are direct children so the label's text is its own,
                  rather than buried a level down where nothing can see it. */}
              <span className="handover__step-title">{step.title}</span>
              <span className="handover__step-detail">{step.detail}</span>
            </label>
          </li>
        ))}
      </ol>

      <div className="handover__foot">
        <label className="handover__assignee">
          <span className="handover__assignee-label">Who is taking it on</span>
          <input
            className="form-control"
            placeholder="A name, once you know it"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onBlur={saveAssignee}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </label>

        {confirming ? (
          <span className="handover__confirm">
            <span className="fs-sm">Call it off?</span>
            <button type="button" className="btn btn-link btn-sm" onClick={() => drop.mutate(handover.id)}>
              Yes, stop
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => setConfirming(false)}>
              Keep going
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-link btn-sm handover__drop" onClick={() => setConfirming(true)}>
            <span className="visually-hidden">Stop handing over {name ?? 'this activity'}</span>
            <span aria-hidden="true">Call it off</span>
          </button>
        )}
      </div>

      {done ? (
        <p className="handover__done">
          Handed over. That is {formatDuration(handover.estimatedMinutesPerWeek)} a week back.
        </p>
      ) : null}
    </article>
  );
}
