/**
 * The DRIP matrix: value against energy.
 *
 * Pure, and deterministic. Given the same activity it returns the same quadrant
 * every time, with no model and no judgement in the middle — which matters,
 * because this is the thing that will tell somebody to hire a person.
 */

export const QUADRANTS = Object.freeze({
  DELEGATE: 'delegate',   // drains you, does not matter much → hand it off
  REPLACE: 'replace',     // drains you, and it matters → a real hire, carefully
  INVEST: 'invest',       // does not drain you, does not pay yet → grow it or drop it
  PRODUCE: 'produce',     // does not drain you, and it matters → protect this
});

/**
 * Three answers, two positions on the axis.
 *
 * The matrix is 2×2, so the axis has to be binary — but keeping three answers is
 * not waste. "Something slips" and "revenue stops" both sit on the high side and
 * both mean Replace, yet they are not equally urgent, and the third level is what
 * orders the list inside the quadrant.
 */
const HIGH_VALUE = new Set(['important', 'critical']);

export const isHighValue = (value) => HIGH_VALUE.has(value);

/**
 * Whether an activity drains its owner, across the weeks on record.
 *
 * Averaged rather than read from the latest week, because one bad week is not a
 * pattern — and because this is the payoff for asking every Friday. Exactly zero
 * counts as not draining: a neutral task is not costing anybody anything.
 */
export function averageEnergy(energies) {
  if (!energies.length) return null;
  return energies.reduce((sum, value) => sum + value, 0) / energies.length;
}

export const drains = (average) => average !== null && average < 0;

/**
 * The quadrant, or null when there is not enough to say.
 *
 * Null for an activity nobody has sorted yet, and null when no week records it.
 * Guessing either way would be worse than an honest gap: the whole point of the
 * Delegate/Replace split is that the two look identical until somebody answers.
 */
export function classify({ value, energies = [] }) {
  if (!value) return null;

  const average = averageEnergy(energies);
  if (average === null) return null;

  if (drains(average)) return isHighValue(value) ? QUADRANTS.REPLACE : QUADRANTS.DELEGATE;
  return isHighValue(value) ? QUADRANTS.PRODUCE : QUADRANTS.INVEST;
}

/** Most urgent first, for ordering a list inside a quadrant. */
const VALUE_RANK = { critical: 2, important: 1, low: 0 };
export const valueRank = (value) => VALUE_RANK[value] ?? -1;
