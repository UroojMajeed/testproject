import { costOfMinutes, annualisedCost } from '../rates/rate.formula.js';
import { classify, averageEnergy, QUADRANTS, valueRank } from '../drip/drip.js';
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

  const byId = new Map(activityRows.map((row) => [String(row._id), row]));

  /**
   * Every energy an activity has been given, across the weeks on record.
   *
   * Collected before the headline week is picked, because a quadrant is a
   * statement about an activity over time and the headline is a statement about
   * one week. Atypical weeks are excluded: the week everything caught fire should
   * not decide that client work drains you.
   */
  const energyHistory = new Map();
  for (const week of weeks.filter((candidate) => candidate.isTypical)) {
    for (const entry of week.entries) {
      const key = String(entry.activityId);
      if (!energyHistory.has(key)) energyHistory.set(key, []);
      energyHistory.get(key).push(entry.energy);
    }
  }

  // The most recent finished week is the headline. Weeks the owner marked atypical
  // are still shown, but they do not get to be the number everything is judged by.
  const latest = weeks.find((week) => week.isTypical) ?? weeks[0] ?? null;

  if (!latest) {
    return {
      week: null,
      rate: rateSummary(rate),
      activities: [],
      matrix: buildMatrix([], rate),
      unsortedCount: 0,
      totals: { estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
      worst: null,
      weeksRecorded: 0,
    };
  }

  const rows = latest.entries.map((entry) => {
    const id = String(entry.activityId);
    const activity = byId.get(id);
    const energies = energyHistory.get(id) ?? [entry.energy];

    return {
      activityId: id,
      name: activity?.name ?? 'Removed activity',
      estimatedMinutes: entry.estimatedMinutes,
      energy: entry.energy,
      averageEnergy: averageEnergy(energies),
      value: activity?.value ?? null,
      // null while nobody has answered the value question for it. The client shows
      // that as a gap rather than filing it somewhere it does not belong.
      quadrant: classify({ value: activity?.value, energies }),
      estimatedWeeklyCostMinor: costOfMinutes(entry.estimatedMinutes, rate.rateMinorPerHour),
      estimatedAnnualCostMinor: annualisedCost(entry.estimatedMinutes, rate.rateMinorPerHour, rate.weeksPerYear),
    };
  });

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
    matrix: buildMatrix(ranked, rate),
    unsortedCount: rows.filter((row) => row.quadrant === null).length,
    totals: {
      estimatedMinutes,
      estimatedWeeklyCostMinor: costOfMinutes(estimatedMinutes, rate.rateMinorPerHour),
      estimatedAnnualCostMinor: annualisedCost(estimatedMinutes, rate.rateMinorPerHour, rate.weeksPerYear),
    },
    worst,
    weeksRecorded: weeks.length,
  };
}

/**
 * Each quadrant with its own totals.
 *
 * The totals are what stop this being a poster. "Four things drain you and do not
 * matter" is an observation; "four things, nine hours a week, £7,000 a year" is a
 * decision — and it is the number a person costs being compared against, which is
 * what step 4 turns into a plan.
 */
function buildMatrix(rows, rate) {
  const quadrants = Object.fromEntries(Object.values(QUADRANTS).map((name) => [name, []]));

  for (const row of rows) {
    if (row.quadrant) quadrants[row.quadrant].push(row);
  }

  return Object.fromEntries(Object.entries(quadrants).map(([name, members]) => {
    // Most valuable first, then most expensive — so the top of a Replace list is
    // the thing that pays most and hurts most, not merely the longest.
    const ordered = [...members].sort((a, b) =>
      valueRank(b.value) - valueRank(a.value)
      || b.estimatedWeeklyCostMinor - a.estimatedWeeklyCostMinor);

    const estimatedMinutes = ordered.reduce((sum, row) => sum + row.estimatedMinutes, 0);

    return [name, {
      activities: ordered,
      count: ordered.length,
      estimatedMinutes,
      estimatedWeeklyCostMinor: costOfMinutes(estimatedMinutes, rate.rateMinorPerHour),
      estimatedAnnualCostMinor: annualisedCost(estimatedMinutes, rate.rateMinorPerHour, rate.weeksPerYear),
    }];
  }));
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
