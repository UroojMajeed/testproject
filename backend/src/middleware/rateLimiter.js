import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../config/constants.js';
import { isTest } from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({
    success: false,
    error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests. Try again shortly.' },
  });

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  // Rate limiting in tests turns assertions into flaky ones.
  skip: () => isTest,
};

/** Everything else. */
export const generalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 600 });

/** Login / register / refresh — brute-force surface. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20 });

/** Password reset and resend-verification — also an email-spam surface. */
export const sensitiveLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 5 });
