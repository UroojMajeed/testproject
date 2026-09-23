import pino from 'pino';
import { env, isProd, isTest } from './env.js';

/** Fields that must never reach a log line, at any depth. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.tokenHash',
];

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACT, censor: '[redacted]' },
  transport: isProd ? undefined : { target: 'pino/file', options: { destination: 1 } },
});
