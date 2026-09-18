import { BuybackPlan, Task, TimeEntry, Recommendation, Playbook } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { dayKey, addDays } from '../../services/metrics.service.js';
import { RECOVERY_RATE } from '../../services/recommendations.engine.js';

const BASELINE_WINDOW_DAYS = 14;
const MIN_SAMPLE_WEEKS = 2;
// Below this share of expected logging days, a saving is not trustworthy.
const COVERAGE_FLOOR = 0.6;

/**
 * Measures what a task costs its current owner over a window. This is the
 * number everything downstream is compared against.
 */
async function measureWindow(workspaceId, taskId, userId, start, end) {
  const entries = await TimeEntry.find({
    workspaceId, taskId, userId,
    date: { $gte: dayKey(start), $lte: dayKey(end) },
    status: { $ne: 'ignored' },
  }).lean();

  const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const days = Math.max(1, Math.round((dayKey(end) - dayKey(start)) / 86_400_000) + 1);
  const weeks = days / 7;

  return {
    totalMinutes,
    minutesPerWeek: Math.round(totalMinutes / weeks),
    entryCount: entries.length,
    logDays: new Set(entries.map((e) => dayKey(e.date).toISOString())).size,
    days,
    weeks,
  };
}

export async function createPlan(workspace, userId, dto) {
  const task = await Task.findOne({ workspaceId: workspace._id, _id: dto.taskId });
  if (!task) throw ApiError.notFound('Task not found');

  const existing = await BuybackPlan.findOne({
    workspaceId: workspace._id, taskId: task._id, status: { $nin: ['cancelled', 'verified'] },
  });
  if (existing) throw ApiError.conflict('This task already has an active buyback plan');

  const plan = await BuybackPlan.create({
    workspaceId: workspace._id,
    taskId: task._id,
    recommendationId: dto.recommendationId ?? null,
    title: dto.title ?? task.title,
    strategy: dto.strategy,
    currentOwnerId: userId,
    newOwner: dto.newOwner ?? { type: 'none' },
    successCriteria: dto.successCriteria ?? {},
    targetDate: dto.targetDate ?? null,
    status: 'draft',
  });

  task.buybackPlanId = plan._id;
  await task.save();
  return plan;
}

/**
 * Approval is where the baseline is frozen. After this the estimate is
 * immutable, because a baseline captured once the work has already moved
 * measures nothing at all.
 */
export async function approvePlan(workspace, userId, planId) {
  const plan = await BuybackPlan.findOne({ workspaceId: workspace._id, _id: planId });
  if (!plan) throw ApiError.notFound('Buyback plan not found');
  if (plan.status !== 'draft') throw ApiError.conflict('That plan has already been approved');

  const end = dayKey(new Date());
  const start = addDays(end, -(BASELINE_WINDOW_DAYS - 1));
  const baseline = await measureWindow(workspace._id, plan.taskId, plan.currentOwnerId, start, end);

  if (baseline.entryCount === 0) {
    throw ApiError.badRequest(
      'There is no logged time for this task in the last 14 days, so there is nothing to measure against. '
      + 'Log the work at least once before approving the plan.',
    );
  }

  const recovery = RECOVERY_RATE[plan.strategy] ?? 0.75;

  plan.estimate = {
    baselineMinutesPerWeek: baseline.minutesPerWeek,
    baselineWindow: { start, end },
    baselineEntryCount: baseline.entryCount,
    hoursSavedPerWeek: Number(((baseline.minutesPerWeek * recovery) / 60).toFixed(2)),
    implementationEffortMinutes: plan.estimate?.implementationEffortMinutes ?? 0,
    frozenAt: new Date(),
  };
  plan.status = 'approved';
  plan.approvedBy = userId;
  plan.approvedAt = new Date();
  await plan.save();

  if (plan.recommendationId) {
    await Recommendation.updateOne(
      { _id: plan.recommendationId },
      { status: 'implemented', buybackPlanId: plan._id },
    );
  }

  return plan;
}

/**
 * Compares the frozen baseline against the owner's time since the transfer.
 *
 * `coverage` is the guard that stops the whole thing from lying: if the founder
 * simply stopped logging, a missing entry reads as zero minutes, which would
 * report a LARGER saving than really happened. Low coverage caps confidence and
 * is surfaced in the response rather than hidden.
 */
/**
 * The verification arithmetic, as a pure function so it can be tested without a
 * database — this is the calculation the product's honesty rests on.
 *
 * `coverage` is the guard that stops it lying. If the owner simply stopped
 * logging, a missing entry reads as zero minutes, which would report a LARGER
 * saving than really happened. Low coverage caps confidence instead of
 * silently inflating the number.
 */
export function computeVerification({ baselineMinutesPerWeek, measured }) {
  const sampleWeeks = Number(measured.weeks.toFixed(1));
  const savedMinutesPerWeek = Math.max(0, baselineMinutesPerWeek - measured.minutesPerWeek);

  const expectedLogDays = Math.max(1, Math.round(measured.days * (5 / 7)));
  const ratio = Math.min(1, measured.logDays / expectedLogDays);

  let confidence = 'low';
  if (sampleWeeks >= MIN_SAMPLE_WEEKS && ratio >= COVERAGE_FLOOR) {
    confidence = sampleWeeks >= 3 && ratio >= 0.8 ? 'high' : 'medium';
  }

  return {
    hoursSavedPerWeek: Number((savedMinutesPerWeek / 60).toFixed(2)),
    currentMinutesPerWeek: measured.minutesPerWeek,
    sampleWeeks,
    confidence,
    coverage: {
      expectedLogDays,
      actualLogDays: measured.logDays,
      ratio: Number(ratio.toFixed(2)),
    },
    trustworthy: confidence !== 'low',
  };
}

export async function verifyPlan(workspace, planId) {
  const plan = await BuybackPlan.findOne({ workspaceId: workspace._id, _id: planId });
  if (!plan) throw ApiError.notFound('Buyback plan not found');
  if (!plan.estimate?.frozenAt) throw ApiError.badRequest('This plan has no frozen baseline to compare against');

  const start = dayKey(plan.approvedAt ?? plan.estimate.frozenAt);
  const end = dayKey(new Date());
  const measured = await measureWindow(workspace._id, plan.taskId, plan.currentOwnerId, start, end);

  const computed = computeVerification({
    baselineMinutesPerWeek: plan.estimate.baselineMinutesPerWeek,
    measured,
  });

  plan.verification = {
    method: 'time_entry_delta',
    measuredWindow: { start, end },
    currentMinutesPerWeek: computed.currentMinutesPerWeek,
    hoursSavedPerWeek: computed.hoursSavedPerWeek,
    confidence: computed.confidence,
    sampleWeeks: computed.sampleWeeks,
    measuredAt: new Date(),
    coverage: computed.coverage,
  };

  if (computed.trustworthy && plan.status === 'in_progress') plan.status = 'verified';

  await plan.save();
  return plan;
}

export async function listPlans(workspaceId, { status } = {}) {
  const filter = { workspaceId };
  if (status && status !== 'all') filter.status = status;
  return BuybackPlan.find(filter)
    .sort({ createdAt: -1 })
    .populate('taskId', 'title category drip')
    .populate('newOwner.userId', 'name email');
}

export async function getPlan(workspaceId, id) {
  const plan = await BuybackPlan.findOne({ workspaceId, _id: id })
    .populate('taskId', 'title category drip recurrence actualMinutes')
    .populate('newOwner.userId', 'name email')
    .populate('playbookId', 'name status version');
  if (!plan) throw ApiError.notFound('Buyback plan not found');
  return plan;
}

export async function updatePlan(workspaceId, id, dto) {
  const plan = await BuybackPlan.findOne({ workspaceId, _id: id });
  if (!plan) throw ApiError.notFound('Buyback plan not found');

  if (dto.status === 'in_progress' && plan.status !== 'approved') {
    throw ApiError.conflict('A plan must be approved before work starts');
  }

  // The frozen estimate is never editable after approval.
  const { estimate, verification, ...safe } = dto;
  void estimate; void verification;
  Object.assign(plan, safe);
  await plan.save();
  return plan;
}

/** Totals across every plan — what the dashboard headline reads. */
export async function reclaimedTotals(workspaceId) {
  const plans = await BuybackPlan.find({
    workspaceId, status: { $in: ['in_progress', 'completed', 'verified'] },
  }).lean();

  return plans.reduce(
    (acc, p) => {
      acc.projectedHoursPerWeek += p.estimate?.hoursSavedPerWeek ?? 0;
      // Only a trustworthy measurement counts towards the headline figure.
      if (p.verification?.confidence !== 'low') {
        acc.verifiedHoursPerWeek += p.verification?.hoursSavedPerWeek ?? 0;
        acc.verifiedPlanCount += 1;
      }
      acc.planCount += 1;
      return acc;
    },
    { projectedHoursPerWeek: 0, verifiedHoursPerWeek: 0, planCount: 0, verifiedPlanCount: 0 },
  );
}

export async function attachPlaybook(workspaceId, planId, playbookId) {
  const [plan, playbook] = await Promise.all([
    BuybackPlan.findOne({ workspaceId, _id: planId }),
    Playbook.findOne({ workspaceId, _id: playbookId }),
  ]);
  if (!plan) throw ApiError.notFound('Buyback plan not found');
  if (!playbook) throw ApiError.notFound('Playbook not found');

  plan.playbookId = playbook._id;
  await plan.save();
  return plan;
}
