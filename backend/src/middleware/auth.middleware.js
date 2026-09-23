import { verifyAccessToken } from '../utils/token.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/index.js';
import { USER_STATUS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Resolves the caller from the Bearer token and loads the current user row.
 *
 * The database read is deliberate: a suspended or deleted account loses access on
 * the next request rather than when its fifteen-minute token expires.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) throw ApiError.unauthenticated();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user || user.status !== USER_STATUS.ACTIVE) throw ApiError.unauthenticated();
  if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
    throw ApiError.unauthenticated('Session is no longer valid. Please sign in again.');
  }

  req.user = user;
  return next();
});
