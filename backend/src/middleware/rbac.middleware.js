import { ROLE_RANK } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';

/** requireRole('manager') — passes for manager and owner. */
export const requireRole = (minimum) => (req, _res, next) => {
  if (!req.membership) return next(ApiError.forbidden('No workspace context'));

  const have = ROLE_RANK[req.membership.role] ?? 0;
  const need = ROLE_RANK[minimum] ?? Infinity;

  if (have < need) return next(ApiError.forbidden(`This action requires the ${minimum} role`));
  return next();
};

/** requireAnyRole('owner', 'manager') — exact membership in a set. */
export const requireAnyRole = (...roles) => (req, _res, next) => {
  if (!req.membership) return next(ApiError.forbidden('No workspace context'));
  if (!roles.includes(req.membership.role)) return next(ApiError.forbidden('Not permitted'));
  return next();
};
