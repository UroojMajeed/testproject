import { Task, TimeEntry, Recommendation, Analysis } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { statsForTask, buildRecommendation, ENGINE_VERSION } from '../../services/recommendations.engine.js';
import { narrate, NARRATOR_NAME } from '../../services/narrator.js';
import { dayKey, addDays } from '../../services/metrics.service.js';

const MAX_RECOMMENDATIONS = 5;

/**
 * Runs the engine over every recurring task in the window and replaces the
 * pending queue. Accepted, rejected and snoozed decisions are left alone — a
 * re-analysis must not resurrect something the founder already dismissed.
 */
export async function analyse(workspace, userId, { windowDays = 14 } = {}) {
  const startedAt = Date.now();
  const periodEnd = dayKey(new Date());
  const periodStart = addDays(periodEnd, -(windowDays - 1));

  const tasks = await Task.find({
    workspaceId: workspace._id,
    'recurrence.occurrences': { $gte: 2 },
    actualMinutes: { $gt: 0 },
  });

  const decided = await Recommendation.find({
    workspaceId: workspace._id,
    status: { $in: ['rejected', 'snoozed', 'accepted', 'implemented', 'verified'] },
  }).select('taskId status snoozedUntil').lean();

  const now = new Date();
  const excluded = new Set(
    decided
      .filter((d) => d.status !== 'snoozed' || (d.snoozedUntil && d.snoozedUntil > now))
      .map((d) => String(d.taskId)),
  );

  const drafts = [];
  for (const task of tasks) {
    if (excluded.has(String(task._id))) continue;

    const entries = await TimeEntry.find({
      workspaceId: workspace._id,
      taskId: task._id,
      date: { $gte: periodStart, $lte: periodEnd },
      status: { $ne: 'ignored' },
    }).lean();

    if (!entries.length) continue;

    const stats = statsForTask(task, entries, windowDays);
    const rec = buildRecommendation(stats, {
      buybackRateMinor: workspace.buybackRate?.amountMinor ?? 0,
      windowDays,
    });
    if (!rec) continue;

    const { title, reason } = narrate(stats, rec, { windowDays });
    drafts.push({ ...rec, taskId: task._id, title, reason });
  }

  drafts.sort((a, z) => z.priorityScore - a.priorityScore);
  const top = drafts.slice(0, MAX_RECOMMENDATIONS);

  const analysis = await Analysis.create({
    workspaceId: workspace._id,
    requestedBy: userId,
    periodStart,
    periodEnd,
    engineVersion: ENGINE_VERSION,
    narrator: NARRATOR_NAME,
    inputSummary: {
      tasksConsidered: tasks.length,
      tasksExcluded: excluded.size,
      windowDays,
    },
    candidateCount: drafts.length,
    producedCount: top.length,
    durationMs: Date.now() - startedAt,
  });

  // Only the pending queue is rebuilt; decisions already made are preserved.
  await Recommendation.deleteMany({ workspaceId: workspace._id, status: 'pending' });

  const saved = await Recommendation.insertMany(
    top.map((d) => ({ ...d, workspaceId: workspace._id, analysisId: analysis._id })),
  );

  return { analysis, recommendations: saved };
}

export async function listRecommendations(workspaceId, { status = 'pending' } = {}) {
  const filter = { workspaceId };
  if (status !== 'all') filter.status = status;
  return Recommendation.find(filter).sort({ priorityScore: -1 }).populate('taskId', 'title category drip recurrence actualMinutes');
}

export async function getRecommendation(workspaceId, id) {
  const rec = await Recommendation.findOne({ workspaceId, _id: id })
    .populate('taskId', 'title category drip recurrence actualMinutes');
  if (!rec) throw ApiError.notFound('Recommendation not found');
  return rec;
}

export async function decide(workspaceId, userId, id, decision, { reason, snoozeDays } = {}) {
  const rec = await Recommendation.findOne({ workspaceId, _id: id });
  if (!rec) throw ApiError.notFound('Recommendation not found');
  if (rec.status !== 'pending') throw ApiError.conflict('That recommendation has already been decided');

  rec.status = decision;
  rec.decidedBy = userId;
  rec.decidedAt = new Date();
  if (decision === 'rejected') rec.rejectionReason = reason ?? null;
  if (decision === 'snoozed') rec.snoozedUntil = addDays(new Date(), snoozeDays ?? 28);

  await rec.save();
  return rec;
}

export async function latestAnalysis(workspaceId) {
  return Analysis.findOne({ workspaceId }).sort({ createdAt: -1 }).lean();
}
