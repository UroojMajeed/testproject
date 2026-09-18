import { Router } from 'express';
import { z } from 'zod';
import * as c from './analytics.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, tenantScope);

analyticsRouter.get(
  '/dashboard',
  validate({ query: z.object({ windowDays: z.coerce.number().int().min(1).max(90).default(14) }).passthrough() }),
  c.dashboard,
);

analyticsRouter.get(
  '/weekly-review',
  validate({ query: z.object({ week: z.string().datetime({ offset: true }).or(z.string().date()).optional() }).passthrough() }),
  c.weeklyReview,
);
