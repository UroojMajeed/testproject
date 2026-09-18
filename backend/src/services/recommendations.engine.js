/**
 * The buyback recommendation engine.
 *
 * Deliberately deterministic. Every number a user sees — hours, cost,
 * confidence — is computed here from their own entries, so it can be explained,
 * tested, and reproduced. A language model is optional and is only ever allowed
 * to phrase the narrative sentence (see narrator.js); it never decides the
 * action, the saving, or the confidence.
 */
import { DRIP, ENERGY_SCORE, VALUE_SCORE } from '../config/constants.js';

export const ENGINE_VERSION = 'engine.v1';

/**
 * Share of a task's hours that realistically comes back per strategy. These are
 * assumptions, stated once, rather than numbers scattered through the code.
 *  - eliminate: the work stops entirely
 *  - automate:  a little supervision remains
 *  - delegate:  the founder keeps final review
 *  - simplify:  the work stays, with less of it
 */
export const RECOVERY_RATE = Object.freeze({
  eliminate: 1.0, automate: 0.85, delegate: 0.75, replace: 0.75, simplify: 0.3, keep: 0,
});

/** Rough setup cost per strategy, in minutes. Shown as "effort" on the card. */
const EFFORT_MINUTES = Object.freeze({
  eliminate: 15, automate: 120, delegate: 90, replace: 120, simplify: 60, keep: 0,
});

const CONFIDENCE_WEIGHTS = Object.freeze({
  sampleSize: 0.25,
  frequency: 0.2,
  energyConsistency: 0.25,
  durationVariance: 0.2,
  volume: 0.1,
});

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Confidence from declared signals, never asserted by a model.
 * Each signal is normalised to 0..1 and then weighted.
 */
export function computeConfidence(stats) {
  const { occurrences, frequency, drainingRatio, durationStdDev, avgMinutes, hoursPerWeek } = stats;

  const signals = [
    {
      name: 'sampleSize',
      detail: `${occurrences} ${occurrences === 1 ? 'entry' : 'entries'}`,
      // Six occurrences is where a pattern stops being an anecdote.
      value: clamp01(occurrences / 6),
    },
    {
      name: 'frequency',
      detail: frequency,
      value: { daily: 1, weekly: 0.9, biweekly: 0.65, monthly: 0.4, irregular: 0.25, ad_hoc: 0.1 }[frequency] ?? 0.25,
    },
    {
      name: 'energyConsistency',
      detail: `${Math.round(Math.abs(drainingRatio - 0.5) * 200)}% consistent`,
      // A task marked draining 8 of 9 times is a clearer signal than 5 of 9.
      value: clamp01(Math.abs(drainingRatio - 0.5) * 2),
    },
    {
      name: 'durationVariance',
      detail: avgMinutes ? `±${Math.round(durationStdDev)} min` : 'n/a',
      // Low variance means a repeatable process; high variance means judgement.
      value: avgMinutes ? clamp01(1 - durationStdDev / Math.max(avgMinutes, 1)) : 0.3,
    },
    {
      name: 'volume',
      detail: `${hoursPerWeek.toFixed(1)}h per week`,
      value: clamp01(hoursPerWeek / 4),
    },
  ].map((s) => ({ ...s, weight: CONFIDENCE_WEIGHTS[s.name] }));

  const score = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const level = score >= 0.68 ? 'high' : score >= 0.42 ? 'medium' : 'low';

  return { level, score: Number(score.toFixed(3)), signals };
}

/**
 * Chooses the action. Order matters: the first rule that fits wins, and the
 * rules run from "stop doing this" to "keep doing this".
 */
export function decideAction(stats) {
  const { quadrant, category, drainingRatio, occurrences, durationStdDev, avgMinutes, valueScore } = stats;

  const repeatable = avgMinutes > 0 && durationStdDev / Math.max(avgMinutes, 1) < 0.35;
  const drains = drainingRatio >= 0.5;

  // Low-value recurring meetings are the cheapest hours in the week to reclaim.
  if (category === 'meetings' && valueScore <= 1 && occurrences >= 3 && drains) {
    return { type: 'eliminate', rationale: 'recurring low-value meeting' };
  }

  if (quadrant === DRIP.DELEGATION) {
    // Repetitive and rule-shaped → software. Variable → a person.
    return repeatable && occurrences >= 3
      ? { type: 'automate', rationale: 'repetitive and consistent in length' }
      : { type: 'delegate', rationale: 'low value to you, and it drains you' };
  }

  if (quadrant === DRIP.REPLACEMENT) {
    // Valuable work you dislike: hand off the doing, keep the judgement.
    return { type: 'delegate', rationale: 'high value but draining — transfer the work, keep the review' };
  }

  if (drains && occurrences >= 3 && !repeatable) {
    return { type: 'simplify', rationale: 'draining and inconsistent — worth tightening before transferring' };
  }

  return { type: 'keep', rationale: 'this is the work only you should be doing' };
}

/**
 * Builds one recommendation from a task's aggregated stats.
 * Returns null for `keep` — the queue is for things to act on.
 */
export function buildRecommendation(stats, { buybackRateMinor = 0, windowDays = 14 } = {}) {
  const action = decideAction(stats);
  if (action.type === 'keep') return null;

  const recovery = RECOVERY_RATE[action.type];
  const hoursSaved = Number((stats.hoursPerWeek * recovery).toFixed(2));
  const confidence = computeConfidence(stats);

  const evidence = [
    { signal: 'frequency', label: `occurrences in ${windowDays} days`, value: stats.occurrences },
    { signal: 'duration', label: 'hours per week', value: Number(stats.hoursPerWeek.toFixed(1)) },
    {
      signal: 'energy',
      label: 'marked draining',
      value: `${Math.round(stats.drainingRatio * 100)}% of the time`,
    },
    { signal: 'value', label: 'business value', value: stats.value ?? 'unrated' },
    {
      signal: 'variance',
      label: 'length varies by',
      value: stats.avgMinutes ? `±${Math.round(stats.durationStdDev)} min` : 'n/a',
    },
  ];

  // Priority is an internal ordering only. It is never shown as a score.
  const priorityScore = Number(
    (hoursSaved * (0.5 + confidence.score * 0.5) * (stats.drainingRatio + 0.5)).toFixed(3),
  );

  return {
    type: action.type,
    rationaleKey: action.rationale,
    estimatedHoursSavedPerWeek: hoursSaved,
    estimatedValueSavedMinor: Math.round(hoursSaved * buybackRateMinor),
    implementationEffortMinutes: EFFORT_MINUTES[action.type],
    evidence,
    confidence,
    priorityScore,
  };
}

/** Aggregates one task's entries into the shape the engine consumes. */
export function statsForTask(task, entries, windowDays = 14) {
  const durations = entries.map((e) => e.durationMinutes ?? 0);
  const totalMinutes = durations.reduce((s, v) => s + v, 0);
  const occurrences = entries.length;
  const avgMinutes = occurrences ? totalMinutes / occurrences : 0;

  const draining = entries.filter((e) => ENERGY_SCORE[e.energy] < 0).length;
  const mean = avgMinutes;
  const variance = occurrences > 1
    ? durations.reduce((s, v) => s + (v - mean) ** 2, 0) / occurrences
    : 0;

  return {
    taskId: task._id,
    title: task.title,
    category: task.category,
    quadrant: task.drip?.quadrant ?? null,
    energy: task.drip?.energy ?? null,
    value: task.drip?.value ?? null,
    valueScore: VALUE_SCORE[task.drip?.value] ?? 1,
    occurrences,
    totalMinutes,
    avgMinutes,
    durationStdDev: Math.sqrt(variance),
    drainingRatio: occurrences ? draining / occurrences : 0,
    hoursPerWeek: (totalMinutes / 60) / Math.max(1, windowDays / 7),
    frequency: task.recurrence?.frequency ?? 'irregular',
  };
}
