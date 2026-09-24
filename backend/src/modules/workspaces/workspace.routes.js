import { Router } from 'express';
import * as workspace from './workspace.controller.js';
import * as rates from '../rates/rate.controller.js';
import * as activities from '../activities/activity.controller.js';
import * as audits from '../audits/audit.controller.js';
import * as dashboard from '../dashboard/dashboard.controller.js';
import { setRateSchema } from '../rates/rate.validation.js';
import { createActivitySchema, renameActivitySchema, activityIdSchema } from '../activities/activity.validation.js';
import { saveWeekSchema, weekParamSchema } from '../audits/audit.validation.js';
import { validate } from '../../middleware/validate.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { withWorkspace } from '../../middleware/workspace.middleware.js';

/**
 * Everything here is tenant-scoped, so the two middlewares are applied once rather
 * than remembered per route — forgetting one on a single line would be a
 * cross-tenant read, and that is not a mistake worth leaving available.
 *
 * Mounted under /workspace rather than at the root of /api/v1. That is not
 * cosmetic: a router with a blanket `use` mounted at the root answers *every*
 * unmatched path, so `GET /api/v1/nonsense` returned 401 from requireAuth instead
 * of reaching the 404 handler. The prefix keeps this router to its own paths, and
 * it makes the tenancy boundary visible in the URL.
 */
export const workspaceRouter = Router();

workspaceRouter.use(requireAuth, withWorkspace);

workspaceRouter.get('/', workspace.show);
workspaceRouter.get('/state', workspace.state);

workspaceRouter.get('/rate', rates.current);
workspaceRouter.put('/rate', validate(setRateSchema), rates.setRate);
workspaceRouter.get('/rate/history', rates.history);

workspaceRouter.get('/activities', activities.list);
workspaceRouter.post('/activities', validate(createActivitySchema), activities.create);
workspaceRouter.patch('/activities/:id', validate(renameActivitySchema), activities.rename);
workspaceRouter.delete('/activities/:id', validate(activityIdSchema), activities.archive);

// "current" before ":weekStarting", or the literal would be read as a date and the
// one route the app opens with would 404. The route-order test walks the stack.
workspaceRouter.get('/audits/current', audits.current);
workspaceRouter.get('/audits', audits.list);
workspaceRouter.get('/audits/:weekStarting', validate(weekParamSchema), audits.show);
workspaceRouter.put('/audits/:weekStarting', validate(saveWeekSchema), audits.save);

workspaceRouter.get('/dashboard', dashboard.show);
