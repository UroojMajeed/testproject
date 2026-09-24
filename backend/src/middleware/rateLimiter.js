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

const WINDOW_MS = 15 * 60 * 1000;

/**
 * The ceilings, named so they can be reasoned about and tested. The middleware
 * itself cannot be exercised in tests — it skips when NODE_ENV is test, or every
 * assertion in the suite would become order-dependent.
 */
export const LIMITS = Object.freeze({
  auth: 20,       // sign in and sign up, per 15 minutes
  refresh: 240,   // once per page load, so this is a working afternoon
  sensitive: 5,   // password reset, per hour
  general: 600,
});

/** Everything else. */
export const generalLimiter = rateLimit({ ...base, windowMs: WINDOW_MS, limit: LIMITS.general });

/** Sign in and sign up — the brute-force surface, and tight on purpose. */
export const authLimiter = rateLimit({ ...base, windowMs: WINDOW_MS, limit: LIMITS.auth });

/**
 * Refresh is not a brute-force surface and must not share the sign-in limit.
 *
 * The access token lives in memory, so every page load and every tab calls this
 * once — and an expired token mid-session calls it again. On the sign-in limit of
 * 20 in fifteen minutes, somebody working normally locks themselves out of their
 * own session in an afternoon. Found by driving the app repeatedly and watching it
 * start answering 429 to everything.
 *
 * It is still limited: the value is a rotating opaque token, and a caller guessing
 * at those has bigger problems, but an unbounded endpoint is an unbounded endpoint.
 */
export const refreshLimiter = rateLimit({ ...base, windowMs: WINDOW_MS, limit: LIMITS.refresh });

/** Password reset — also an email-spam surface. */
export const sensitiveLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: LIMITS.sensitive });
