import { weekEnding } from '../../utils/weeks.js';

/**
 * Every duration field says `estimated` in its name, and that is not verbosity.
 * This is recall, and the product will later hold measured figures beside it — the
 * two must never be mistaken for one another, in a response body least of all.
 */
export function serializeAuditWeek(week) {
  if (!week) return null;
  return {
    id: String(week._id),
    weekStarting: week.weekStarting,
    weekEnding: weekEnding(week.weekStarting),
    timezone: week.timezone,
    status: week.status,
    isTypical: week.isTypical,
    completedAt: week.completedAt,
    entries: week.entries.map((entry) => ({
      activityId: String(entry.activityId),
      estimatedMinutes: entry.estimatedMinutes,
      energy: entry.energy,
      note: entry.note ?? null,
    })),
    totalEstimatedMinutes: week.entries.reduce((sum, entry) => sum + entry.estimatedMinutes, 0),
  };
}
