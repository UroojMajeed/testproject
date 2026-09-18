import { Task } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { toQuadrant, DRIP, ENERGY_SCORE, VALUE_SCORE } from '../../config/constants.js';
import { costOfMinutes } from '../../utils/format.js';

/**
 * The matrix. Plots every recurring task by energy and value, with per-quadrant
 * totals — so "you spend $390 a week in Delegation" is legible at a glance.
 */
export const matrix = asyncHandler(async (req, res) => {
  const windowDays = Number(req.query.windowDays ?? 14);
  const rate = req.workspace.buybackRate?.amountMinor ?? 0;

  const tasks = await Task.find({
    workspaceId: req.workspaceId,
    'recurrence.occurrences': { $gte: 1 },
    actualMinutes: { $gt: 0 },
  }).lean();

  const quadrants = Object.fromEntries(
    Object.values(DRIP).map((q) => [q, { minutes: 0, costMinor: 0, taskCount: 0 }]),
  );

  const points = tasks.map((t) => {
    const q = t.drip?.quadrant ?? null;
    const minutesPerWeek = Math.round(t.actualMinutes / Math.max(1, windowDays / 7));

    if (q && quadrants[q]) {
      quadrants[q].minutes += minutesPerWeek;
      quadrants[q].costMinor += costOfMinutes(minutesPerWeek, rate);
      quadrants[q].taskCount += 1;
    }

    return {
      taskId: String(t._id),
      title: t.title,
      quadrant: q,
      energy: t.drip?.energy ?? null,
      value: t.drip?.value ?? null,
      // -2..2 and 0..3 mapped to 0..1 for plotting.
      x: ((VALUE_SCORE[t.drip?.value] ?? 1) / 3),
      y: ((ENERGY_SCORE[t.drip?.energy] ?? 0) + 2) / 4,
      minutesPerWeek,
      costMinorPerWeek: costOfMinutes(minutesPerWeek, rate),
      occurrences: t.recurrence?.occurrences ?? 0,
      source: t.drip?.source ?? 'derived',
      isRecurring: Boolean(t.recurrence?.isRecurring),
    };
  });

  return ok(res, {
    windowDays,
    points: points.sort((a, z) => z.minutesPerWeek - a.minutesPerWeek),
    quadrants,
    currency: req.workspace.currency,
    buybackRateMinor: rate,
  });
});

/** A manual move always wins and is recorded as such. */
export const reclassify = asyncHandler(async (req, res) => {
  const { energy, value } = req.body;
  const task = await Task.findOne({ workspaceId: req.workspaceId, _id: req.params.id });
  if (!task) throw ApiError.notFound('Task not found');

  task.drip = {
    energy, value, quadrant: toQuadrant(energy, value),
    source: 'user', classifiedAt: new Date(),
  };
  task.buybackCandidate =
    Boolean(task.recurrence?.isRecurring) && ['delegation', 'replacement'].includes(task.drip.quadrant);
  await task.save();

  return ok(res, { task });
});
