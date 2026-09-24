import { AuditWeek } from '../../models/index.js';
import { weekToAudit, shiftWeeks, weekEnding } from '../../utils/weeks.js';
import * as activities from '../activities/activity.service.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * The weekly audit: last week, recalled.
 *
 * Hours and energy only. Judging an activity's *value* is slow, reflective
 * thinking and belongs to the sort step — mixing it in here makes the weekly habit
 * heavy, and the habit is the product.
 */

function scopeOf(workspace, userId) {
  return { workspaceId: workspace._id, userId };
}

/**
 * The week now open for filing, with last week's answers carried forward.
 *
 * The pre-fill is the difference between a habit and a chore. Week one takes ten
 * minutes; week two should take two, because the twelve activities are already
 * listed with the hours they took last time and all that is left is to adjust.
 * Energy is deliberately *not* carried forward — it is the thing most likely to
 * have changed, and a pre-filled answer is an answer nobody re-reads.
 */
export async function currentWeek(workspace, userId, now = new Date()) {
  const weekStarting = weekToAudit(now, workspace.timezone, workspace.auditDay);
  const scope = scopeOf(workspace, userId);

  const existing = await AuditWeek.findOne({ ...scope, weekStarting });
  if (existing) return { week: existing, suggestions: [], isNew: false };

  const previous = await AuditWeek.findOne({ ...scope, weekStarting: shiftWeeks(weekStarting, -1) });

  const draft = await AuditWeek.create({
    ...scope,
    weekStarting,
    timezone: workspace.timezone,
    status: 'draft',
    entries: [],
  });

  const suggestions = (previous?.entries ?? []).map((entry) => ({
    activityId: entry.activityId,
    estimatedMinutes: entry.estimatedMinutes,
  }));

  return { week: draft, suggestions, isNew: true };
}

export async function findWeek(workspace, userId, weekStarting) {
  const week = await AuditWeek.findOne({ ...scopeOf(workspace, userId), weekStarting });
  if (!week) throw ApiError.notFound('No audit for that week');
  return week;
}

/**
 * Saves a week's entries.
 *
 * Entries arrive naming either an existing activity or a new one typed inline, and
 * the names are resolved to rows here so that "Invoicing" typed on two different
 * Fridays is one activity with a trend rather than two with none.
 */
export async function saveWeek(workspace, userId, weekStarting, { entries, isTypical, status }) {
  const week = await AuditWeek.findOne({ ...scopeOf(workspace, userId), weekStarting });
  if (!week) throw ApiError.notFound('No audit for that week');

  // Fetched once. Looking each one up inside the loop would be a dozen round trips
  // to answer a question one round trip already answered.
  const known = new Map(
    (await activities.list(workspace._id, { includeArchived: true }))
      .map((activity) => [String(activity._id), activity]),
  );

  const resolved = [];
  const seen = new Set();

  for (const entry of entries) {
    const activity = entry.activityId
      ? known.get(String(entry.activityId))
      // Typed inline on the form. findOrCreate is what stops the same name becoming
      // two rows and splitting the trend.
      : await activities.findOrCreate(workspace._id, entry.activityName);

    if (!activity) throw ApiError.notFound(`No such activity: ${entry.activityId}`);

    // One row per activity per week. Two entries for the same thing would double
    // its hours and quietly inflate what it costs.
    const key = String(activity._id);
    if (seen.has(key)) {
      throw ApiError.unprocessable('The same activity appears twice in this week', [
        { field: 'body.entries', message: `"${activity.name}" is listed more than once` },
      ]);
    }
    seen.add(key);

    resolved.push({
      activityId: activity._id,
      estimatedMinutes: entry.estimatedMinutes,
      energy: entry.energy,
      note: entry.note ?? null,
    });
  }

  week.entries = resolved;
  if (isTypical !== undefined) week.isTypical = isTypical;

  if (status === 'complete') {
    if (!resolved.length) {
      throw ApiError.unprocessable('Add at least one activity before finishing the week', [
        { field: 'body.entries', message: 'A finished week needs at least one activity' },
      ]);
    }
    week.status = 'complete';
    week.completedAt = week.completedAt ?? new Date();
  }

  await week.save();
  return week;
}

export async function listWeeks(workspace, userId, { limit = 26 } = {}) {
  return AuditWeek.find({ ...scopeOf(workspace, userId), status: 'complete' })
    .sort({ weekStarting: -1 })
    .limit(limit);
}

export { weekEnding };
