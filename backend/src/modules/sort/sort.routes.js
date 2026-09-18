import { Router } from 'express';
import * as c from './sort.controller.js';
import * as v from './sort.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';

export const sortRouter = Router();
sortRouter.use(requireAuth, tenantScope);

sortRouter.post('/', validate(v.startSchema), c.start);
sortRouter.get('/active', c.active);
sortRouter.get('/:id', validate(v.idSchema), c.get);
sortRouter.post('/:id/groups/:groupId/classify', validate(v.classifySchema), c.classify);
sortRouter.post('/:id/groups/:groupId/skip', validate(v.skipSchema), c.skip);
sortRouter.post('/:id/complete', validate(v.idSchema), c.complete);
