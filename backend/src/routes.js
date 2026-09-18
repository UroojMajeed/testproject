import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './modules/auth/auth.routes.js';
import { workspaceRouter } from './modules/workspaces/workspace.routes.js';
import { timeEntryRouter } from './modules/timeEntries/timeEntry.routes.js';
import { taskRouter } from './modules/tasks/task.routes.js';
import { sortRouter } from './modules/sort/sort.routes.js';
import { dripRouter } from './modules/drip/drip.routes.js';
import { recommendationRouter } from './modules/recommendations/recommendation.routes.js';
import { planRouter } from './modules/plans/plan.routes.js';
import { playbookRouter } from './modules/playbooks/playbook.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) =>
  res.json({ success: true, data: { status: 'ok', uptime: Math.round(process.uptime()) } }));

apiRouter.get('/health/ready', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { database: ready ? 'connected' : 'unavailable' },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/time-entries', timeEntryRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/sort', sortRouter);
apiRouter.use('/drip', dripRouter);
apiRouter.use('/recommendations', recommendationRouter);
apiRouter.use('/plans', planRouter);
apiRouter.use('/playbooks', playbookRouter);
apiRouter.use('/analytics', analyticsRouter);
