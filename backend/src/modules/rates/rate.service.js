import { BuybackRate } from '../../models/index.js';
import { computeBuybackRate } from './rate.formula.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Setting a rate appends a record. It never updates one.
 *
 * If income changes in March, the figure June was shown must not quietly become a
 * different number. Every derived total therefore stamps the rate it used, and the
 * history here is what makes that stamp checkable rather than a claim.
 */
export async function setRate(workspace, userId, { annualIncomeMinor, hoursPerWeek, weeksPerYear }) {
  const computed = computeBuybackRate({ annualIncomeMinor, hoursPerWeek, weeksPerYear });

  return BuybackRate.create({
    workspaceId: workspace._id,
    userId,
    annualIncomeMinor,
    currency: workspace.currency,
    hoursPerWeek,
    weeksPerYear,
    rateMinorPerHour: computed.rateMinorPerHour,
    formulaVersion: computed.formulaVersion,
    effectiveFrom: new Date(),
  });
}

/** The rate in force now — the most recent record, which may not exist yet. */
export async function currentRate(workspaceId, userId) {
  return BuybackRate.findOne({ workspaceId, userId }).sort({ effectiveFrom: -1 });
}

export async function requireCurrentRate(workspaceId, userId) {
  const rate = await currentRate(workspaceId, userId);
  if (!rate) throw ApiError.badRequest('Set your buyback rate before asking what your week costs');
  return rate;
}

export async function history(workspaceId, userId) {
  return BuybackRate.find({ workspaceId, userId }).sort({ effectiveFrom: -1 }).limit(50);
}
