import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './modules/auth/auth.routes.js';
import { workspaceRouter } from './modules/workspaces/workspace.routes.js';

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
apiRouter.use('/workspace', workspaceRouter);
