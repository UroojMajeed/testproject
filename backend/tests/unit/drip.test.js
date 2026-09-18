import { describe, it, expect } from 'vitest';
import { toQuadrant, DRIP, ENERGY, VALUE } from '../../src/config/constants.js';

describe('toQuadrant', () => {
  it.each([
    [ENERGY.LOW, VALUE.LOW, DRIP.DELEGATION],
    [ENERGY.VERY_LOW, VALUE.MEDIUM, DRIP.DELEGATION],
    [ENERGY.LOW, VALUE.HIGH, DRIP.REPLACEMENT],
    [ENERGY.VERY_LOW, VALUE.STRATEGIC, DRIP.REPLACEMENT],
    [ENERGY.HIGH, VALUE.LOW, DRIP.INVESTMENT],
    [ENERGY.NEUTRAL, VALUE.MEDIUM, DRIP.INVESTMENT],
    [ENERGY.HIGH, VALUE.HIGH, DRIP.PRODUCTION],
    [ENERGY.VERY_HIGH, VALUE.STRATEGIC, DRIP.PRODUCTION],
  ])('%s energy + %s value → %s', (energy, value, expected) => {
    expect(toQuadrant(energy, value)).toBe(expected);
  });

  it('covers every combination without returning undefined', () => {
    for (const e of Object.values(ENERGY)) {
      for (const v of Object.values(VALUE)) {
        expect(Object.values(DRIP)).toContain(toQuadrant(e, v));
      }
    }
  });

  it('treats neutral energy as not draining', () => {
    // The book's axis is drains/gives; neutral must not be filed as a drain.
    expect(toQuadrant(ENERGY.NEUTRAL, VALUE.HIGH)).toBe(DRIP.PRODUCTION);
  });
});
