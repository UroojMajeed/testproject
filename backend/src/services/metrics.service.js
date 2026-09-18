import { TimeEntry, MetricsDaily } from '../models/index.js';
import { DRIP } from '../config/constants.js';

/** UTC midnight of the day a timestamp falls in. The rollup bucket key. */
export function dayKey(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Monday-start week containing `date`, as [start, end). */
export function weekBounds(date) {
  const d = dayKey(date);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const start = addDays(d, -dow);
  return { start, end: addDays(start, 7) };
}

const EMPTY_QUADRANTS = () => ({
  delegation: 0, replacement: 0, investment: 0, production: 0, unclassified: 0,
});

/**
 * Recomputes one user-day from source. Called after any time-entry mutation
 * and by the nightly rebuild, so a partial write can never leave the rollup
 * permanently wrong.
 */
export async function recomputeDay(workspaceId, userId, date) {
  const start = dayKey(date);
  const end = addDays(start, 1);

  const entries = await TimeEntry.find({
    workspaceId, userId, date: { $gte: start, $lt: end }, status: { $ne: 'ignored' },
  }).lean();

  const doc = {
    trackedMinutes: 0,
    entryCount: entries.length,
    byQuadrant: EMPTY_QUADRANTS(),
    byCategory: new Map(),
    byEnergy: { very_low: 0, low: 0, neutral: 0, high: 0, very_high: 0 },
    costMinor: { delegation: 0, replacement: 0, investment: 0, production: 0 },
    computedAt: new Date(),
  };

  for (const e of entries) {
    const mins = e.durationMinutes ?? 0;
    doc.trackedMinutes += mins;

    const q = e.dripQuadrant ?? 'unclassified';
    doc.byQuadrant[q] = (doc.byQuadrant[q] ?? 0) + mins;
    if (q !== 'unclassified') doc.costMinor[q] += e.estimatedCostMinor ?? 0;

    doc.byCategory.set(e.category ?? 'other', (doc.byCategory.get(e.category ?? 'other') ?? 0) + mins);
    if (e.energy) doc.byEnergy[e.energy] = (doc.byEnergy[e.energy] ?? 0) + mins;
  }

  if (!entries.length) {
    await MetricsDaily.deleteOne({ workspaceId, userId, date: start });
    return null;
  }

  return MetricsDaily.findOneAndUpdate(
    { workspaceId, userId, date: start },
    { $set: doc },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/** Rolls several days up into one total. Every dashboard figure comes through here. */
export async function summarise(workspaceId, { userId, from, to } = {}) {
  const match = { workspaceId, date: { $gte: dayKey(from), $lt: dayKey(addDays(to, 1)) } };
  if (userId) match.userId = userId;

  const rows = await MetricsDaily.find(match).sort({ date: 1 }).lean();

  const total = {
    trackedMinutes: 0,
    entryCount: 0,
    byQuadrant: EMPTY_QUADRANTS(),
    costMinor: { delegation: 0, replacement: 0, investment: 0, production: 0 },
    byCategory: {},
    days: [],
  };

  for (const r of rows) {
    total.trackedMinutes += r.trackedMinutes;
    total.entryCount += r.entryCount;

    for (const q of Object.keys(total.byQuadrant)) total.byQuadrant[q] += r.byQuadrant?.[q] ?? 0;
    for (const q of Object.keys(total.costMinor)) total.costMinor[q] += r.costMinor?.[q] ?? 0;

    const cats = r.byCategory instanceof Map ? Object.fromEntries(r.byCategory) : (r.byCategory ?? {});
    for (const [k, v] of Object.entries(cats)) total.byCategory[k] = (total.byCategory[k] ?? 0) + v;

    total.days.push({
      date: r.date,
      trackedMinutes: r.trackedMinutes,
      byQuadrant: r.byQuadrant,
    });
  }

  const draining = total.byQuadrant.delegation + total.byQuadrant.replacement;
  total.drainingMinutes = draining;
  total.drainingCostMinor = total.costMinor.delegation + total.costMinor.replacement;
  total.drainingShare = total.trackedMinutes ? draining / total.trackedMinutes : 0;

  return total;
}

/** Fills gaps so a chart has one point per day rather than skipping empties. */
export function fillDays(days, from, to) {
  const byDate = new Map(days.map((d) => [dayKey(d.date).toISOString(), d]));
  const out = [];
  for (let d = dayKey(from); d < dayKey(addDays(to, 1)); d = addDays(d, 1)) {
    out.push(
      byDate.get(d.toISOString()) ?? { date: new Date(d), trackedMinutes: 0, byQuadrant: EMPTY_QUADRANTS() },
    );
  }
  return out;
}

export { DRIP };
