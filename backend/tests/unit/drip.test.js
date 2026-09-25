import { describe, it, expect } from 'vitest';
import { classify, QUADRANTS, averageEnergy, drains, isHighValue, valueRank } from '../../src/modules/drip/drip.js';

/**
 * The classification that will eventually tell somebody to hire a person, so it is
 * worth being able to check every cell of the matrix by hand from these cases.
 */

describe('the four quadrants', () => {
  it.each([
    ['drains you and does not matter', 'low', [-2, -1], QUADRANTS.DELEGATE],
    ['drains you and matters', 'important', [-2, -1], QUADRANTS.REPLACE],
    ['drains you and pays the bills', 'critical', [-1], QUADRANTS.REPLACE],
    ['does not drain you and does not pay yet', 'low', [1, 2], QUADRANTS.INVEST],
    ['does not drain you and matters', 'critical', [2], QUADRANTS.PRODUCE],
  ])('%s → %s', (_label, value, energies, expected) => {
    expect(classify({ value, energies })).toBe(expected);
  });

  /**
   * The distinction the whole step exists for. Both drain you; one goes to a VA on
   * Friday and the other is a hire that breaks the business if it goes to the wrong
   * person. Energy alone cannot tell them apart.
   */
  it('separates Delegate from Replace on value alone', () => {
    const energies = [-2, -2];

    expect(classify({ value: 'low', energies })).toBe(QUADRANTS.DELEGATE);
    expect(classify({ value: 'critical', energies })).toBe(QUADRANTS.REPLACE);
  });

  it('separates Invest from Produce on value alone', () => {
    const energies = [2, 2];

    expect(classify({ value: 'low', energies })).toBe(QUADRANTS.INVEST);
    expect(classify({ value: 'critical', energies })).toBe(QUADRANTS.PRODUCE);
  });
});

describe('what counts as high value', () => {
  it('puts both "something slips" and "revenue stops" on the high side', () => {
    // The matrix is 2×2, so the axis is binary — but "important" still means
    // Replace rather than Delegate, and that is the consequential call.
    expect(isHighValue('important')).toBe(true);
    expect(isHighValue('critical')).toBe(true);
    expect(isHighValue('low')).toBe(false);
  });

  it('ranks the three answers, so a quadrant can be ordered inside itself', () => {
    expect(valueRank('critical')).toBeGreaterThan(valueRank('important'));
    expect(valueRank('important')).toBeGreaterThan(valueRank('low'));
  });
});

describe('whether something drains you', () => {
  it('averages the weeks rather than reading the latest', () => {
    // One bad week is not a pattern, and averaging is the payoff for asking
    // every Friday rather than once.
    expect(averageEnergy([-2, 1, 1])).toBeCloseTo(0);
    expect(drains(averageEnergy([-2, 1, 1]))).toBe(false);
    expect(drains(averageEnergy([-2, -2, 1]))).toBe(true);
  });

  it('treats exactly neutral as not draining', () => {
    // A task that costs nobody anything is not a problem to be solved.
    expect(drains(0)).toBe(false);
    expect(classify({ value: 'low', energies: [0] })).toBe(QUADRANTS.INVEST);
  });

  it('has no opinion when no week records the activity', () => {
    expect(averageEnergy([])).toBeNull();
    expect(drains(null)).toBe(false);
  });
});

describe('when it refuses to answer', () => {
  it('returns null for an activity nobody has sorted', () => {
    // An unsorted activity is not low-value; nobody has been asked. Defaulting
    // would file every new thing under Delegate and recommend handing it off.
    expect(classify({ value: null, energies: [-2] })).toBeNull();
    expect(classify({ energies: [-2] })).toBeNull();
  });

  it('returns null when the activity appears in no week', () => {
    expect(classify({ value: 'critical', energies: [] })).toBeNull();
  });
});
