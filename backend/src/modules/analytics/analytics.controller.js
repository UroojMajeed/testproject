import { Task, Playbook, Recommendation, SortSession, BuybackPlan } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { summarise, fillDays, dayKey, addDays, weekBounds } from '../../services/metrics.service.js';
import { reclaimedTotals } from '../plans/plan.service.js';

/**
 * Everything the dashboard needs, in one round trip and all of it from
 * metricsDaily rather than a live scan of timeEntries.
 */
export const dashboard = asyncHandler(async (req, res) => {
  const windowDays = Number(req.query.windowDays ?? 14);
  const to = dayKey(new Date());
  const from = addDays(to, -(windowDays - 1));

  const [summary, totals, pending, playbookCount, openTasks, lastSort] = await Promise.all([
    summarise(req.workspaceId, { userId: req.user._id, from, to }),
    reclaimedTotals(req.workspaceId),
    Recommendation.find({ workspaceId: req.workspaceId, status: 'pending' })
      .sort({ priorityScore: -1 }).limit(1).populate('taskId', 'title').lean(),
    Playbook.countDocuments({ workspaceId: req.workspaceId, status: 'published' }),
    Task.countDocuments({ workspaceId: req.workspaceId, buybackCandidate: true, buybackPlanId: null }),
    SortSession.findOne({ workspaceId: req.workspaceId, userId: req.user._id })
      .sort({ createdAt: -1 }).lean(),
  ]);

  // Potential is what the queue has identified but nobody has acted on.
  const pendingAll = await Recommendation.find({ workspaceId: req.workspaceId, status: 'pending' })
    .select('estimatedHoursSavedPerWeek').lean();
  const potentialHoursPerWeek = Number(
    pendingAll.reduce((s, r) => s + (r.estimatedHoursSavedPerWeek ?? 0), 0).toFixed(1),
  );

  return ok(res, {
    window: { from, to, windowDays },
    summary: { ...summary, days: fillDays(summary.days, from, to) },
    reclaimed: totals,
    potentialHoursPerWeek,
    tasksToTransfer: openTasks,
    publishedPlaybooks: playbookCount,
    nextBestAction: pending[0] ?? null,
    lastSort: lastSort
      ? { id: String(lastSort._id), status: lastSort.status, completedAt: lastSort.completedAt,
          durationSeconds: lastSort.durationSeconds, groupCount: lastSort.groupCount }
      : null,
    currency: req.workspace.currency,
    buybackRateMinor: req.workspace.buybackRate?.amountMinor ?? 0,
  });
});

/**
 * The weekly review. Leads with where the reclaimed hours WENT, not just how
 * many there were — reclaiming time into inbox is a failure worth naming.
 */
export const weeklyReview = asyncHandler(async (req, res) => {
  const anchor = req.query.week ? new Date(req.query.week) : new Date();
  const { start, end } = weekBounds(anchor);
  const prev = weekBounds(addDays(start, -1));

  const [thisWeek, lastWeek, totals, plans, topRec] = await Promise.all([
    summarise(req.workspaceId, { userId: req.user._id, from: start, to: addDays(end, -1) }),
    summarise(req.workspaceId, { userId: req.user._id, from: prev.start, to: addDays(prev.end, -1) }),
    reclaimedTotals(req.workspaceId),
    BuybackPlan.find({ workspaceId: req.workspaceId, status: { $in: ['approved', 'in_progress', 'completed', 'verified'] } })
      .populate('taskId', 'title').lean(),
    Recommendation.find({ workspaceId: req.workspaceId, status: 'pending' })
      .sort({ priorityScore: -1 }).limit(1).populate('taskId', 'title').lean(),
  ]);

  const topDrain = Object.entries(thisWeek.byCategory).sort((a, z) => z[1] - a[1])[0] ?? null;

  return ok(res, {
    week: { start, end: addDays(end, -1) },
    thisWeek: { ...thisWeek, days: fillDays(thisWeek.days, start, addDays(end, -1)) },
    lastWeek: { trackedMinutes: lastWeek.trackedMinutes, byQuadrant: lastWeek.byQuadrant },
    reclaimed: totals,
    topDrain: topDrain ? { category: topDrain[0], minutes: topDrain[1] } : null,
    plans: plans.map((p) => ({
      id: String(p._id),
      title: p.title,
      status: p.status,
      projectedHoursPerWeek: p.estimate?.hoursSavedPerWeek ?? 0,
      verifiedHoursPerWeek: p.verification?.hoursSavedPerWeek ?? null,
      confidence: p.verification?.confidence ?? null,
      coverage: p.verification?.coverage ?? null,
      sampleWeeks: p.verification?.sampleWeeks ?? 0,
    })),
    nextStep: topRec[0] ?? null,
    currency: req.workspace.currency,
  });
});
