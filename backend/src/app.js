import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';

import { env, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRouter } from './routes.js';
import { sanitize } from './middleware/sanitize.middleware.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Behind a proxy in production, so req.ip and secure cookies work correctly.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", env.CLIENT_URL],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // A strict allowlist, not a wildcard — credentials:true and origin:* cannot coexist.
  app.use(
    cors({
      origin(origin, cb) {
        // Returning false (not an Error) omits the allow-origin header so the
        // browser blocks the response, without turning a rejected origin into a
        // logged 500. State changes still get an explicit 403 from verifyOrigin.
        cb(null, !origin || origin === env.CLIENT_URL);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      maxAge: 86400,
    }),
  );

  app.use(compression());
  // A body larger than this is a mistake or an attack, not a request.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitize);

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.get('x-request-id') || crypto.randomUUID(),
        customLogLevel: (_req, res, err) =>
          (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      }),
    );
  }

  app.use('/api/v1', generalLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
