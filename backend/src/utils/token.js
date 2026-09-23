import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

const ISSUER = 'reclaimos';
const AUDIENCE = 'reclaimos-api';

/**
 * Short-lived, held in memory by the client only. Carries identity and nothing
 * else — no authorisation decisions, so a suspended account loses access on the
 * next request rather than in fifteen minutes.
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, audience: AUDIENCE });
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw ApiError.unauthenticated(
      expired ? 'Access token expired' : 'Invalid access token',
      expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.UNAUTHENTICATED,
    );
  }
}

export const REFRESH_COOKIE = 'reclaim_rt';

export function refreshCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    // 'strict' would break an OAuth redirect later; 'lax' plus the Origin check
    // in csrf.middleware.js is the working combination.
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: maxAgeMs,
  };
}
