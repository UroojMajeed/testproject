import { Router } from 'express';
import { z } from 'zod';
import * as c from './workspace.controller.js';
import * as v from './workspace.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantFromParam } from '../../middleware/tenantScope.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

workspaceRouter.post('/', validate(v.createWorkspaceSchema), c.create);
workspaceRouter.get('/', c.list);

workspaceRouter.post(
  '/invites/accept',
  validate({ body: z.object({ token: z.string().min(20).max(200) }).strict() }),
  c.acceptInvite,
);

// Everything below is scoped to one workspace the caller belongs to.
workspaceRouter.get('/:id', validate(v.workspaceIdSchema), tenantFromParam(), c.get);

workspaceRouter.patch(
  '/:id',
  validate(v.updateWorkspaceSchema), tenantFromParam(), requireRole(ROLES.OWNER), c.update,
);

workspaceRouter.patch(
  '/:id/buyback-rate',
  validate(v.buybackRateSchema), tenantFromParam(), requireRole(ROLES.OWNER), c.setBuybackRate,
);

workspaceRouter.patch(
  '/:id/onboarding',
  validate(v.onboardingSchema), tenantFromParam(), requireRole(ROLES.MANAGER), c.setOnboarding,
);

workspaceRouter.get('/:id/members', validate(v.workspaceIdSchema), tenantFromParam(), c.members);

workspaceRouter.post(
  '/:id/invites',
  validate(v.inviteSchema), tenantFromParam(), requireRole(ROLES.MANAGER), c.invite,
);
