import { Router } from 'express';
import { z } from 'zod';
import * as c from './drip.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';
import { ENERGY, VALUE } from '../../config/constants.js';

export const dripRouter = Router();
dripRouter.use(requireAuth, tenantScope);

dripRouter.get(
  '/',
  validate({ query: z.object({ windowDays: z.coerce.number().int().min(1).max(90).default(14) }).passthrough() }),
  c.matrix,
);

dripRouter.patch(
  '/tasks/:id',
  validate({
    params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
    body: z.object({ energy: z.nativeEnum(ENERGY), value: z.nativeEnum(VALUE) }).strict(),
  }),
  c.reclassify,
);
