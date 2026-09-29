import { Handover, Activity } from '../../models/index.js';
import { seedSteps, STEP_KEYS } from './handover.steps.js';
import { costOfMinutes, annualisedCost } from '../rates/rate.formula.js';
import { ApiError } from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../config/constants.js';
import * as rates from '../rates/rate.service.js';
import * as dashboard from '../dashboard/dashboard.service.js';

/**
 * What to hand over, and how far along each one is.
 *
 * The dashboard says what the week costs. This says what to do about it, which is
 * the promise the dashboard has been making and not keeping: it ends by naming
 * the worst activity and saying the next step is "the next step of the build".
 *
 * Nothing here invents a salary or looks up a market rate. The only number needed
 * is one the workspace already has — the buyback rate — because the test the book
 * actually gives is not "what does this job pay", it is "would you pay somebody
 * less than your own hour is worth to stop doing it". That question can be
 * answered from what is already on file, and an invented salary range would be a
 * figure somebody makes a hiring decision on that we made up.
 */

/** The quadrants worth handing over: both drain the owner. */
const CANDIDATE_QUADRANTS = new Set(['replace', 'delegate']);

/**
 * The case for handing each draining activity over, priced.
 *
 * Built from the same dashboard figures the owner has already seen, so the
 * numbers on this screen and that one cannot disagree.
 */
export async function plan(workspace, userId) {
  const view = await dashboard.forWorkspace(workspace, userId);
  const existing = await Handover.find({ workspaceId: workspace._id });
  const byActivity = new Map(existing.map((row) => [String(row.activityId), row]));

  const candidates = view.activities
    .filter((row) => CANDIDATE_QUADRANTS.has(row.quadrant))
    .map((row) => ({
      activityId: row.activityId,
      name: row.name,
      quadrant: row.quadrant,
      estimatedMinutes: row.estimatedMinutes,
      estimatedWeeklyCostMinor: row.estimatedWeeklyCostMinor,
      estimatedAnnualCostMinor: row.estimatedAnnualCostMinor,
      // Already being handed over, so it is not a candidate — it is in progress.
      handoverId: byActivity.has(row.activityId) ? String(byActivity.get(row.activityId)._id) : null,
    }));

  const open = candidates.filter((row) => !row.handoverId);
  const minutes = open.reduce((sum, row) => sum + row.estimatedMinutes, 0);

  return {
    candidates,
    rate: { rateMinorPerHour: view.rate.rateMinorPerHour, currency: view.rate.currency, weeksPerYear: view.rate.weeksPerYear },
    totals: {
      count: open.length,
      estimatedMinutes: minutes,
      estimatedWeeklyCostMinor: costOfMinutes(minutes, view.rate.rateMinorPerHour),
      estimatedAnnualCostMinor: annualisedCost(minutes, view.rate.rateMinorPerHour, view.rate.weeksPerYear),
    },
    /**
     * The whole decision in one number.
     *
     * Anyone who will do this work for less than the owner's own hour is worth
     * makes the trade worth taking. It is the buyback rate — repeated here rather
     * than left to be inferred, because that inference is the point of the book
     * and the thing people get wrong.
     */
    breakEvenMinorPerHour: view.rate.rateMinorPerHour,
  };
}

export async function list(workspaceId) {
  return Handover.find({ workspaceId }).sort({ createdAt: -1 });
}

export async function findOne(workspaceId, id) {
  const row = await Handover.findByIdScoped(id, workspaceId);
  if (!row) throw ApiError.notFound('No such handover');
  return row;
}

/**
 * Commits to handing one activity over.
 *
 * The cost is stamped at this moment rather than recomputed later: what it was
 * costing when the decision was taken is the number that justified the decision,
 * and a rate change in March must not rewrite what June was told.
 */
export async function start(workspace, userId, activityId) {
  const activity = await Activity.findByIdScoped(activityId, workspace._id);
  if (!activity) throw ApiError.notFound('No such activity');

  const view = await dashboard.forWorkspace(workspace, userId);
  const row = view.activities.find((entry) => entry.activityId === String(activityId));
  const rate = await rates.requireCurrentRate(workspace._id, userId);

  // An activity with no recorded week has no hours and no cost, so there is
  // nothing to justify handing it over with. Better to say so than to file a
  // handover priced at zero.
  if (!row) {
    throw new ApiError(422, ERROR_CODES.VALIDATION_ERROR,
      'That activity is not in your latest week, so there is nothing to price the handover against');
  }

  try {
    return await Handover.create({
      workspaceId: workspace._id,
      activityId,
      steps: seedSteps(),
      estimatedMinutesPerWeek: row.estimatedMinutes,
      estimatedAnnualCostMinor: row.estimatedAnnualCostMinor,
      rateMinorPerHour: rate.rateMinorPerHour,
      currency: rate.currency,
      quadrant: row.quadrant ?? null,
    });
  } catch (err) {
    // The unique index is the arbiter: two handovers for one activity would mean
    // two checklists for one job and no answer to "is this done yet".
    if (err?.code === 11000) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, 'That activity is already being handed over');
    }
    throw err;
  }
}

/**
 * Ticks or unticks one step.
 *
 * Status follows the steps rather than being set by hand — a checklist that says
 * "in progress" while every box is empty is a checklist nobody trusts.
 */
export async function setStep(workspaceId, id, key, done) {
  if (!STEP_KEYS.includes(key)) throw ApiError.notFound('No such step');

  const handover = await findOne(workspaceId, id);
  const step = handover.steps.find((entry) => entry.key === key);
  if (!step) throw ApiError.notFound('No such step');

  step.done = done;
  step.doneAt = done ? new Date() : null;

  return save(handover);
}

export async function update(workspaceId, id, patch) {
  const handover = await findOne(workspaceId, id);
  if (patch.assignee !== undefined) handover.assignee = patch.assignee;
  if (patch.notes !== undefined) handover.notes = patch.notes;
  return save(handover);
}

export async function drop(workspaceId, id) {
  // findOne first, so calling this off something in another workspace is a 404
  // rather than a silent no-op.
  await findOne(workspaceId, id);
  /*
   * Deleted through the model with the workspace in the filter, not with
   * document.deleteOne(). That issues a query keyed on _id alone, which the
   * tenant plugin refuses outright — correctly: an id-only delete is exactly the
   * shape of a cross-tenant write.
   */
  await Handover.deleteOne({ _id: id, workspaceId });
}

/** Status derived from the boxes, every time, so the two can never disagree. */
function save(handover) {
  const ticked = handover.steps.filter((step) => step.done).length;

  handover.status = ticked === 0 ? 'planned' : ticked === handover.steps.length ? 'done' : 'in_progress';
  handover.startedAt = ticked > 0 ? handover.startedAt ?? new Date() : null;
  handover.completedAt = handover.status === 'done' ? handover.completedAt ?? new Date() : null;

  return handover.save();
}
