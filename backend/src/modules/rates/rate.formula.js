import { RATE_FORMULA_VERSION } from '../../models/BuybackRate.js';

/**
 * The buyback rate.
 *
 *     effective hourly = annual income ÷ (hours a week × weeks a year)
 *     buyback rate     = effective hourly ÷ 4
 *
 * The divide by four is the whole idea, and it is worth understanding before
 * anyone argues with the number. It is not what an hour of your time is worth on
 * the open market, and it is not a wage. It is the threshold above which buying an
 * hour back stops making sense — hand a task to someone for less than this and the
 * trade is worth making. Being deliberately conservative is the point: it makes
 * the recommendation defensible rather than flattering.
 *
 * Integer minor units in, integer minor units out. No floats touch money; the
 * division rounds once, at the end.
 */
const BUYBACK_DIVISOR = 4;

export function computeBuybackRate({ annualIncomeMinor, hoursPerWeek, weeksPerYear }) {
  const hoursPerYear = hoursPerWeek * weeksPerYear;

  // The schema forbids this, but a formula that can divide by zero should say so
  // rather than return Infinity and poison every figure downstream.
  if (!Number.isFinite(hoursPerYear) || hoursPerYear <= 0) {
    throw new Error('hoursPerWeek × weeksPerYear must be greater than zero');
  }

  const effectiveHourlyMinor = annualIncomeMinor / hoursPerYear;

  return {
    rateMinorPerHour: Math.round(effectiveHourlyMinor / BUYBACK_DIVISOR),
    effectiveHourlyMinor: Math.round(effectiveHourlyMinor),
    formulaVersion: RATE_FORMULA_VERSION,
  };
}

/** What a number of minutes costs at a given rate. Rounded once, at the end. */
export function costOfMinutes(minutes, rateMinorPerHour) {
  return Math.round((minutes / 60) * rateMinorPerHour);
}

/** A week's figure annualised. Weeks a year, not 52, so holidays are not billed. */
export function annualisedCost(weeklyMinutes, rateMinorPerHour, weeksPerYear) {
  return Math.round((weeklyMinutes / 60) * rateMinorPerHour * weeksPerYear);
}
