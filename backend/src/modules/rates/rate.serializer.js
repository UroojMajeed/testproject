/**
 * The inputs travel with the result, always.
 *
 * A bare number invites argument and cannot be re-checked. Returning what it was
 * computed from lets the client show its working — which matters because this is a
 * planning estimate people are asked to act on, not a fact handed down.
 */
export function serializeRate(rate) {
  if (!rate) return null;
  return {
    id: String(rate._id),
    rateMinorPerHour: rate.rateMinorPerHour,
    currency: rate.currency,
    annualIncomeMinor: rate.annualIncomeMinor,
    hoursPerWeek: rate.hoursPerWeek,
    weeksPerYear: rate.weeksPerYear,
    formulaVersion: rate.formulaVersion,
    effectiveFrom: rate.effectiveFrom,
  };
}
