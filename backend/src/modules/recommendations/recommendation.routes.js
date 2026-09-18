import { Router } from 'express';
import { z } from 'zod';
import * as service from './recommendation.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const recommendationRouter = Router();
recommendationRouter.use(requireAuth, tenantScope);

recommendationRouter.post(
  '/analyse',
  requireRole(ROLES.MANAGER),
  validate({ body: z.object({ windowDays: z.number().int().min(7).max(90).default(14) }).strict() }),
  asyncHandler(async (req, res) => {
    const result = await service.analyse(req.workspace, req.user._id, req.body);
    return created(res, result);
  }),
);

recommendationRouter.get(
  '/',
  validate({ query: z.object({ status: z.enum(['pending', 'accepted', 'rejected', 'snoozed', 'all']).default('pending') }).passthrough() }),
  asyncHandler(async (req, res) => {
    const [recommendations, analysis] = await Promise.all([
      service.listRecommendations(req.workspaceId, req.query),
      service.latestAnalysis(req.workspaceId),
    ]);
    return ok(res, { recommendations, analysis, currency: req.workspace.currency });
  }),
);

recommendationRouter.get(
  '/:id',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) =>
    ok(res, { recommendation: await service.getRecommendation(req.workspaceId, req.params.id) })),
);

recommendationRouter.post(
  '/:id/accept',
  requireRole(ROLES.MANAGER),
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) =>
    ok(res, { recommendation: await service.decide(req.workspaceId, req.user._id, req.params.id, 'accepted') })),
);

recommendationRouter.post(
  '/:id/reject',
  requireRole(ROLES.MANAGER),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ reason: z.string().max(500).optional() }).strict(),
  }),
  asyncHandler(async (req, res) =>
    ok(res, { recommendation: await service.decide(req.workspaceId, req.user._id, req.params.id, 'rejected', req.body) })),
);

recommendationRouter.post(
  '/:id/snooze',
  requireRole(ROLES.MANAGER),
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ snoozeDays: z.number().int().min(1).max(180).default(28) }).strict(),
  }),
  asyncHandler(async (req, res) =>
    ok(res, { recommendation: await service.decide(req.workspaceId, req.user._id, req.params.id, 'snoozed', req.body) })),
);
