import { SortSession, SortGroup, TimeEntry } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { groupByFingerprint, inferFrequency } from '../../services/fingerprint.js';
import { toQuadrant } from '../../config/constants.js';
import { costOfMinutes } from '../../utils/format.js';
import { dayKey, addDays, recomputeDay } from '../../services/metrics.service.js';
import { upsertTaskForTitle, recomputeTaskRollups } from '../../services/task.service.js';

/**
 * Starts a sort: takes a flat list of activities and collapses them into
 * fingerprint groups, so the user classifies about a dozen things rather than
 * thirty. This is the whole reason a two-week audit becomes a ten-minute
 * sitting.
 */
export async function startSession(workspace, userId, { source, windowDays, activities }) {
  const existing = await SortSession.findOne({
    workspaceId: workspace._id, userId, status: 'in_progress',
  });
  if (existing) throw ApiError.conflict('You already have a sort in progress');

  const periodEnd = dayKey(new Date());
  const periodStart = addDays(periodEnd, -(windowDays - 1));

  const session = await SortSession.create({
    workspaceId: workspace._id,
    userId,
    periodStart,
    periodEnd,
    source,
    eventCount: activities.length,
    startedAt: new Date(),
  });

  const buckets = groupByFingerprint(activities);

  const groups = await SortGroup.insertMany(
    buckets.map((b, index) => ({
      workspaceId: workspace._id,
      sessionId: session._id,
      userId,
      fingerprint: b.fingerprint,
      title: b.title,
      category: b.items.find((i) => i.category)?.category ?? 'other',
      occurrences: b.items.map((i) => ({
        label: i.title,
        startAt: i.startAt ? new Date(i.startAt) : null,
        durationMinutes: i.durationMinutes,
        externalId: i.externalId ?? null,
      })),
      eventCount: b.eventCount,
      totalMinutes: b.totalMinutes,
      frequency: inferFrequency(b.eventCount, windowDays),
      order: index,
    })),
  );

  session.groupCount = groups.length;
  await session.save();

  return { session, groups };
}

export async function getSession(workspaceId, userId, sessionId) {
  const session = await SortSession.findOne({ workspaceId, _id: sessionId, userId });
  if (!session) throw ApiError.notFound('Sort session not found');
  const groups = await SortGroup.find({ workspaceId, sessionId: session._id }).sort({ order: 1 });
  return { session, groups };
}

export async function getActiveSession(workspaceId, userId) {
  const session = await SortSession.findOne({ workspaceId, userId, status: 'in_progress' });
  if (!session) return null;
  const groups = await SortGroup.find({ workspaceId, sessionId: session._id }).sort({ order: 1 });
  return { session, groups };
}

/**
 * Classifies one group — and writes a time entry per occurrence, so the sort
 * produces the same shape of data a timer would. `precision` records that these
 * are coarser estimates.
 */
export async function classifyGroup(workspace, userId, sessionId, groupId, { energy, value, category }) {
  const session = await SortSession.findOne({
    workspaceId: workspace._id, _id: sessionId, userId, status: 'in_progress',
  });
  if (!session) throw ApiError.notFound('Sort session not found or already finished');

  const group = await SortGroup.findOne({ workspaceId: workspace._id, _id: groupId, sessionId });
  if (!group) throw ApiError.notFound('Group not found');
  if (group.decidedAt) throw ApiError.conflict('That group is already classified');

  const quadrant = toQuadrant(energy, value);
  if (category) group.category = category;
  group.energy = energy;
  group.value = value;
  group.dripQuadrant = quadrant;
  group.decidedAt = new Date();

  const task = await upsertTaskForTitle(workspace._id, userId, {
    title: group.title, category: group.category, energy, value,
  });
  group.taskId = task?._id ?? null;
  await group.save();

  const precision = session.source === 'calendar' ? 'calendar_sorted' : 'recalled';
  const rate = workspace.buybackRate?.amountMinor ?? 0;
  const touchedDays = new Set();

  for (const occ of group.occurrences) {
    const when = occ.startAt ?? session.periodEnd;
    const date = dayKey(when);
    touchedDays.add(date.toISOString());

    await TimeEntry.create({
      workspaceId: workspace._id,
      userId,
      taskId: group.taskId,
      title: occ.label || group.title,
      date,
      startAt: occ.startAt ?? null,
      durationMinutes: occ.durationMinutes,
      category: group.category,
      energy,
      value,
      dripQuadrant: quadrant,
      source: 'sort',
      precision,
      sortGroupId: group._id,
      estimatedCostMinor: costOfMinutes(occ.durationMinutes, rate),
    });
  }

  for (const iso of touchedDays) await recomputeDay(workspace._id, userId, new Date(iso));
  if (group.taskId) await recomputeTaskRollups(workspace._id, group.taskId);

  session.classifiedCount += 1;
  await session.save();

  return { group, session };
}

export async function skipGroup(workspaceId, userId, sessionId, groupId) {
  const session = await SortSession.findOne({ workspaceId, _id: sessionId, userId, status: 'in_progress' });
  if (!session) throw ApiError.notFound('Sort session not found');

  const group = await SortGroup.findOne({ workspaceId, _id: groupId, sessionId });
  if (!group) throw ApiError.notFound('Group not found');

  group.skipped = true;
  group.decidedAt = new Date();
  await group.save();

  session.skippedCount += 1;
  await session.save();
  return { group, session };
}

export async function completeSession(workspaceId, userId, sessionId) {
  const session = await SortSession.findOne({ workspaceId, _id: sessionId, userId });
  if (!session) throw ApiError.notFound('Sort session not found');
  if (session.status === 'completed') return session;

  session.status = 'completed';
  session.completedAt = new Date();
  // The activation metric the entry-path redesign exists to move.
  session.durationSeconds = Math.round((session.completedAt - session.startedAt) / 1000);
  await session.save();
  return session;
}
