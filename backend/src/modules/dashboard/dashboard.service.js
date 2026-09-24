import { costOfMinutes, annualisedCost } from '../rates/rate.formula.js';
import * as rates from '../rates/rate.service.js';
import * as audits from '../audits/audit.service.js';
import * as activities from '../activities/activity.service.js';

/**
 * What the week cost, ranked.
 *
 * Every figure here is built from recall — somebody's memory of last week — so
 * every field is named `estimated`. When measured data arrives it must be
 * impossible to confuse the two, and the time to make that impossible is before
 * there is anything to confuse it with.
 *
 * The rate used is read from the stored record and returned alongside the totals.
 * A reader should be able to check the arithmetic, and a figure quoted in June
 * should still be explicable after the rate changes in July.
 */
export async function forWorkspace(workspace, userId) {
  const rate = await rates.requireCurrentRate(workspace._id, userId);

  const [weeks, activityRows] = await Promise.all([
    audits.listWeeks(workspace, userId, { limit: 26 }),
    activities.list(workspace._id, { includeArchived: true }),
  ]);

  const names = new Map(activityRows.map((row) => [String(row._id), row.name]));

  // The most recent finished week is the headline. Weeks the owner marked atypical
  // are still shown, but they do not get to be the number everything is judged by.
  const latest = weeks.find((week) => week.isTypical) ?? weeks[0] ?? null;

  if (!latest) {
    return {
      week: null,
      rate: rateSummary(rate),
      activities: [],
      totals: { estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
      worst: null,
      weeksRecorded: 0,
    };
  }

  const rows = latest.entries.map((entry) => ({
    activityId: String(entry.activityId),
    name: names.get(String(entry.activityId)) ?? 'Removed activity',
    estimatedMinutes: entry.estimatedMinutes,
    energy: entry.energy,
    estimatedWeeklyCostMinor: costOfMinutes(entry.estimatedMinutes, rate.rateMinorPerHour),
    estimatedAnnualCostMinor: annualisedCost(entry.estimatedMinutes, rate.rateMinorPerHour, rate.weeksPerYear),
  }));

  const estimatedMinutes = rows.reduce((sum, row) => sum + row.estimatedMinutes, 0);

  /**
   * Worst is not simply most expensive.
   *
   * An hour that drains you is worse than an hour that does not, and a task you
   * enjoy is not a problem however long it takes. Ranking on cost alone would keep
   * recommending that people delegate the work they most want to keep — so cost is
   * weighted by how much the activity takes out of them, and anything energising
   * is excluded from being "worst" entirely.
   */
  const drain = (row) => (row.energy < 0 ? 1 + Math.abs(row.energy) * 0.5 : 1);
  const ranked = [...rows].sort((a, b) =>
    b.estimatedWeeklyCostMinor * drain(b) - a.estimatedWeeklyCostMinor * drain(a));

  const worst = ranked.find((row) => row.energy < 0) ?? null;

  return {
    week: {
      weekStarting: latest.weekStarting,
      weekEnding: audits.weekEnding(latest.weekStarting),
      isTypical: latest.isTypical,
      completedAt: latest.completedAt,
    },
    rate: rateSummary(rate),
    activities: ranked,
    totals: {
      estimatedMinutes,
      estimatedWeeklyCostMinor: costOfMinutes(estimatedMinutes, rate.rateMinorPerHour),
      estimatedAnnualCostMinor: annualisedCost(estimatedMinutes, rate.rateMinorPerHour, rate.weeksPerYear),
    },
    worst,
    weeksRecorded: weeks.length,
  };
}

/** The rate that produced these figures, so the arithmetic can be checked. */
function rateSummary(rate) {
  return {
    rateMinorPerHour: rate.rateMinorPerHour,
    currency: rate.currency,
    weeksPerYear: rate.weeksPerYear,
    effectiveFrom: rate.effectiveFrom,
    formulaVersion: rate.formulaVersion,
  };
}
