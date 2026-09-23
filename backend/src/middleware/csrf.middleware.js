import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The refresh cookie is SameSite=Lax, which stops cross-site POSTs in every
 * current browser — but Lax alone is not a guarantee on older ones. This adds an
 * explicit Origin/Referer check on the cookie-authenticated routes.
 */
export function verifyOrigin(req, _res, next) {
  if (SAFE.has(req.method)) return next();

  const origin = req.get('origin') || req.get('referer');
  // A same-origin browser fetch always sends Origin on POST; a missing header
  // means a non-browser client, which cannot carry the cookie anyway.
  if (!origin) return next();

  let host;
  try {
    host = new URL(origin).origin;
  } catch {
    return next(ApiError.forbidden('Malformed Origin header'));
  }

  const allowed = new Set([env.CLIENT_URL, `http://localhost:${env.PORT}`]);
  if (!allowed.has(host)) return next(ApiError.forbidden('Cross-origin request rejected'));
  return next();
}
