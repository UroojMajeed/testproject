import { Router } from 'express';
import { z } from 'zod';
import * as service from './plan.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { ROLES, ACTIONS, PLAN_STATUS } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const idParam = { params: z.object({ id: objectId }) };

export const planRouter = Router();
planRouter.use(requireAuth, tenantScope);

planRouter.get(
  '/',
  validate({ query: z.object({ status: z.enum([...PLAN_STATUS, 'all']).default('all') }).passthrough() }),
  asyncHandler(async (req, res) => {
    const [plans, totals] = await Promise.all([
      service.listPlans(req.workspaceId, req.query),
      service.reclaimedTotals(req.workspaceId),
    ]);
    return ok(res, { plans, totals, currency: req.workspace.currency });
  }),
);

planRouter.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate({
    body: z.object({
      taskId: objectId,
      recommendationId: objectId.nullish(),
      title: z.string().trim().min(1).max(240).optional(),
      strategy: z.enum(ACTIONS),
      newOwner: z.object({
        type: z.enum(['user', 'external', 'automation', 'none']).default('none'),
        userId: objectId.nullish(),
        externalName: z.string().max(120).nullish(),
      }).optional(),
      successCriteria: z.object({
        definitionOfDone: z.string().max(2000).optional(),
        qualityChecks: z.array(z.string().max(200)).max(20).optional(),
        approvalRequired: z.boolean().default(true),
        deadline: z.string().datetime({ offset: true }).nullish(),
      }).optional(),
      targetDate: z.string().datetime({ offset: true }).nullish(),
    }).strict(),
  }),
  asyncHandler(async (req, res) =>
    created(res, { plan: await service.createPlan(req.workspace, req.user._id, req.body) })),
);

planRouter.get('/:id', validate(idParam), asyncHandler(async (req, res) =>
  ok(res, { plan: await service.getPlan(req.workspaceId, req.params.id), currency: req.workspace.currency })));

planRouter.patch(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate({
    ...idParam,
    body: z.object({
      title: z.string().trim().min(1).max(240).optional(),
      status: z.enum(PLAN_STATUS).optional(),
      newOwner: z.object({
        type: z.enum(['user', 'external', 'automation', 'none']),
        userId: objectId.nullish(),
        externalName: z.string().max(120).nullish(),
      }).optional(),
      successCriteria: z.object({
        definitionOfDone: z.string().max(2000).optional(),
        qualityChecks: z.array(z.string().max(200)).max(20).optional(),
        approvalRequired: z.boolean().optional(),
        deadline: z.string().datetime({ offset: true }).nullish(),
      }).optional(),
      targetDate: z.string().datetime({ offset: true }).nullish(),
    }).strict().refine((d) => Object.keys(d).length > 0, 'Nothing to update'),
  }),
  asyncHandler(async (req, res) =>
    ok(res, { plan: await service.updatePlan(req.workspaceId, req.params.id, req.body) })),
);

planRouter.post('/:id/approve', requireRole(ROLES.MANAGER), validate(idParam),
  asyncHandler(async (req, res) =>
    ok(res, { plan: await service.approvePlan(req.workspace, req.user._id, req.params.id) })));

planRouter.post('/:id/verify', validate(idParam),
  asyncHandler(async (req, res) =>
    ok(res, { plan: await service.verifyPlan(req.workspace, req.params.id) })));

planRouter.post(
  '/:id/playbook',
  requireRole(ROLES.MANAGER),
  validate({ ...idParam, body: z.object({ playbookId: objectId }).strict() }),
  asyncHandler(async (req, res) =>
    ok(res, { plan: await service.attachPlaybook(req.workspaceId, req.params.id, req.body.playbookId) })),
);
