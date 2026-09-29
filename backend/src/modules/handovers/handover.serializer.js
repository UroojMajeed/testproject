import { HANDOVER_STEPS } from './handover.steps.js';

const BY_KEY = new Map(HANDOVER_STEPS.map((step) => [step.key, step]));

/**
 * The wording lives on the server and travels with the data.
 *
 * The client could hold its own copy of the titles, keyed by the same strings —
 * and then the two would drift, and a step renamed here would show the old words
 * there until somebody noticed. The keys are the contract; the sentences come
 * with them.
 */
export function serializeHandover(handover) {
  if (!handover) return null;

  const steps = handover.steps.map((step) => {
    const template = BY_KEY.get(step.key);
    return {
      key: step.key,
      title: template?.title ?? step.key,
      detail: template?.detail ?? '',
      done: Boolean(step.done),
      doneAt: step.doneAt ?? null,
    };
  });

  return {
    id: String(handover._id),
    activityId: String(handover.activityId),
    status: handover.status,
    assignee: handover.assignee ?? '',
    notes: handover.notes ?? '',
    steps,
    // Sent rather than left to the client to count: it is on screen beside the
    // list, and two places computing "3 of 7" is one place to get it wrong.
    doneCount: steps.filter((step) => step.done).length,
    stepCount: steps.length,

    estimatedMinutesPerWeek: handover.estimatedMinutesPerWeek,
    estimatedAnnualCostMinor: handover.estimatedAnnualCostMinor,
    rateMinorPerHour: handover.rateMinorPerHour,
    currency: handover.currency,
    quadrant: handover.quadrant ?? null,

    startedAt: handover.startedAt ?? null,
    completedAt: handover.completedAt ?? null,
    createdAt: handover.createdAt,
  };
}
