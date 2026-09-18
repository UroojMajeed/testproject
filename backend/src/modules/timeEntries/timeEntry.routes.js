import { Router } from 'express';
import * as c from './timeEntry.controller.js';
import * as v from './timeEntry.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { tenantScope } from '../../middleware/tenantScope.middleware.js';

export const timeEntryRouter = Router();

timeEntryRouter.use(requireAuth, tenantScope);

timeEntryRouter.get('/summary', validate(v.summarySchema), c.summary);
timeEntryRouter.get('/', validate(v.listSchema), c.list);
timeEntryRouter.post('/', validate(v.createSchema), c.create);
timeEntryRouter.patch('/:id', validate(v.updateSchema), c.update);
timeEntryRouter.delete('/:id', validate(v.idSchema), c.remove);
