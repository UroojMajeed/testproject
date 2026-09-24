import { describe, it, expect } from 'vitest';
import { computeBuybackRate, costOfMinutes, annualisedCost } from '../../src/modules/rates/rate.formula.js';

/**
 * The number every other figure in the product is priced against, so it is worth
 * being able to check the arithmetic by hand from these cases.
 */

describe('the buyback rate', () => {
  it('is a quarter of the effective hourly rate', () => {
    // $120,000 over 50 weeks of 40 hours = 2,000 hours = $60/hour effective.
    // A quarter of that is $15/hour, which is the buyback rate.
    const rate = computeBuybackRate({
      annualIncomeMinor: 12_000_000, // $120,000 in cents
      hoursPerWeek: 40,
      weeksPerYear: 50,
    });

    expect(rate.effectiveHourlyMinor).toBe(6_000); // $60.00
    expect(rate.rateMinorPerHour).toBe(1_500);     // $15.00
  });

  it('rises when the same income is earned in fewer hours', () => {
    const many = computeBuybackRate({ annualIncomeMinor: 12_000_000, hoursPerWeek: 60, weeksPerYear: 50 });
    const few = computeBuybackRate({ annualIncomeMinor: 12_000_000, hoursPerWeek: 20, weeksPerYear: 50 });

    expect(few.rateMinorPerHour).toBeGreaterThan(many.rateMinorPerHour);
    expect(few.rateMinorPerHour).toBe(3_000); // $30/hour — three times the 60-hour figure
  });

  it('counts weeks actually worked, so holidays are not billed', () => {
    const allYear = computeBuybackRate({ annualIncomeMinor: 12_000_000, hoursPerWeek: 40, weeksPerYear: 52 });
    const withLeave = computeBuybackRate({ annualIncomeMinor: 12_000_000, hoursPerWeek: 40, weeksPerYear: 46 });

    expect(withLeave.rateMinorPerHour).toBeGreaterThan(allYear.rateMinorPerHour);
  });

  it('returns whole minor units — money is never a float', () => {
    const rate = computeBuybackRate({ annualIncomeMinor: 10_000_000, hoursPerWeek: 37, weeksPerYear: 47 });

    expect(Number.isInteger(rate.rateMinorPerHour)).toBe(true);
    expect(Number.isInteger(rate.effectiveHourlyMinor)).toBe(true);
  });

  it('stamps the formula version onto the result', () => {
    // Stored with every rate, so a row stays readable as what it was when the
    // arithmetic changes later.
    expect(computeBuybackRate({ annualIncomeMinor: 1, hoursPerWeek: 1, weeksPerYear: 1 }).formulaVersion)
      .toBeGreaterThanOrEqual(1);
  });

  it('refuses to divide by zero rather than returning Infinity', () => {
    // The schema forbids it, but a poisoned rate would silently ruin every figure
    // downstream, so the formula says so itself.
    expect(() => computeBuybackRate({ annualIncomeMinor: 100, hoursPerWeek: 0, weeksPerYear: 50 }))
      .toThrow(/greater than zero/);
  });

  it('handles an income of zero without blowing up', () => {
    expect(computeBuybackRate({ annualIncomeMinor: 0, hoursPerWeek: 40, weeksPerYear: 50 }).rateMinorPerHour)
      .toBe(0);
  });
});

describe('what time costs at that rate', () => {
  const RATE = 1_500; // $15.00 an hour

  it('prices an hour at the rate', () => {
    expect(costOfMinutes(60, RATE)).toBe(1_500);
  });

  it('prices part of an hour proportionally', () => {
    expect(costOfMinutes(30, RATE)).toBe(750);
    expect(costOfMinutes(90, RATE)).toBe(2_250);
  });

  it('rounds once, at the end', () => {
    // 7 minutes is $1.75 exactly; the danger is rounding the hours first and
    // getting zero.
    expect(costOfMinutes(7, RATE)).toBe(175);
    expect(Number.isInteger(costOfMinutes(7, RATE))).toBe(true);
  });

  it('costs nothing for no time', () => {
    expect(costOfMinutes(0, RATE)).toBe(0);
  });
});

describe('annualising a week', () => {
  it('multiplies by the weeks actually worked', () => {
    // Four hours a week at $15, over 50 weeks = $3,000 a year.
    expect(annualisedCost(240, 1_500, 50)).toBe(300_000);
  });

  it('does not assume 52 weeks', () => {
    expect(annualisedCost(240, 1_500, 46)).toBeLessThan(annualisedCost(240, 1_500, 52));
  });

  it('returns whole minor units', () => {
    expect(Number.isInteger(annualisedCost(97, 1_337, 47))).toBe(true);
  });
});
