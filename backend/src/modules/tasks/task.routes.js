import { Router } from 'express';
import { z } from 'zod';
import { Task, BuybackPlan } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { parsePagination, pageMeta } from '../../utils/paginate.js';
import { ROLES, TASK_STATUS, PRIORITY, CATEGORIES, DRIP } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const taskRouter = Router();
taskRouter.use(requireAuth, tenantScope);

taskRouter.get(
  '/',
  validate({
    query: z.object({
      status: z.enum([...TASK_STATUS, 'all']).default('all'),
      quadrant: z.enum([...Object.values(DRIP), 'all']).default('all'),
      recurring: z.enum(['true', 'false', 'all']).default('all'),
      candidate: z.enum(['true', 'false', 'all']).default('all'),
      q: z.string().max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).passthrough(),
  }),
  asyncHandler(async (req, res) => {
    const { status, quadrant, recurring, candidate, q } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });

    const filter = { workspaceId: req.workspaceId };
    if (status !== 'all') filter.status = status;
    if (quadrant !== 'all') filter['drip.quadrant'] = quadrant;
    if (recurring !== 'all') filter['recurrence.isRecurring'] = recurring === 'true';
    if (candidate !== 'all') filter.buybackCandidate = candidate === 'true';
    if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ actualMinutes: -1 }).skip(skip).limit(limit)
        .populate('ownerId', 'name email').lean(),
      Task.countDocuments(filter),
    ]);

    return ok(res, { tasks }, pageMeta({ page, limit }, total));
  }),
);

/**
 * The delegation queue. Five columns because a transfer has five real states,
 * and "needs decision" comes first: work stalls far more often for want of an
 * owner than for want of effort.
 */
taskRouter.get(
  '/queue/delegation',
  requireRole(ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const [candidates, plans] = await Promise.all([
      Task.find({ workspaceId: req.workspaceId, buybackCandidate: true, buybackPlanId: null })
        .sort({ actualMinutes: -1 }).limit(50).lean(),
      BuybackPlan.find({ workspaceId: req.workspaceId, status: { $ne: 'cancelled' } })
        .populate('taskId', 'title category drip interventionCount')
        .populate('newOwner.userId', 'name email')
        .sort({ updatedAt: -1 }).lean(),
    ]);

    const byStatus = (s) => plans.filter((p) => p.status === s);

    return ok(res, {
      columns: {
        needsDecision: candidates,
        readyToDelegate: byStatus('approved'),
        inProgress: byStatus('in_progress'),
        needsReview: byStatus('completed'),
        done: byStatus('verified'),
      },
      currency: req.workspace.currency,
    });
  }),
);

taskRouter.get(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({ workspaceId: req.workspaceId, _id: req.params.id })
      .populate('ownerId', 'name email')
      .populate('playbookId', 'name status version');
    if (!task) throw ApiError.notFound('Task not found');
    return ok(res, { task });
  }),
);

taskRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(4000).nullish(),
      status: z.enum(TASK_STATUS).optional(),
      priority: z.enum(PRIORITY).optional(),
      category: z.enum(CATEGORIES).optional(),
      ownerId: objectId.nullish(),
      dueDate: z.string().datetime({ offset: true }).nullish(),
      interventionCount: z.number().int().min(0).max(100).optional(),
    }).strict().refine((d) => Object.keys(d).length > 0, 'Nothing to update'),
  }),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({ workspaceId: req.workspaceId, _id: req.params.id });
    if (!task) throw ApiError.notFound('Task not found');

    Object.assign(task, req.body);
    if (req.body.status === 'completed' && !task.completedAt) task.completedAt = new Date();
    await task.save();
    return ok(res, { task });
  }),
);
