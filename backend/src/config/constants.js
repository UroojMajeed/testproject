/** Single source of truth for every enum. Mirrored in frontend/src/lib/constants.js. */

export const ROLES = Object.freeze({ OWNER: 'owner', MANAGER: 'manager', MEMBER: 'member' });
export const ROLE_VALUES = Object.values(ROLES);

/** Higher number = more authority. Used by the rbac middleware. */
export const ROLE_RANK = Object.freeze({ member: 1, manager: 2, owner: 3 });

export const MEMBERSHIP_STATUS = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

export const DRIP = Object.freeze({
  DELEGATION: 'delegation',
  REPLACEMENT: 'replacement',
  INVESTMENT: 'investment',
  PRODUCTION: 'production',
});

export const ENERGY = Object.freeze({
  VERY_LOW: 'very_low',
  LOW: 'low',
  NEUTRAL: 'neutral',
  HIGH: 'high',
  VERY_HIGH: 'very_high',
});

export const VALUE = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  STRATEGIC: 'strategic',
});

/** Energy/value → quadrant. The one place this mapping exists on the server. */
export function toQuadrant(energy, value) {
  const drains = energy === ENERGY.VERY_LOW || energy === ENERGY.LOW;
  const worthMoney = value === VALUE.HIGH || value === VALUE.STRATEGIC;
  if (drains) return worthMoney ? DRIP.REPLACEMENT : DRIP.DELEGATION;
  return worthMoney ? DRIP.PRODUCTION : DRIP.INVESTMENT;
}

export const CATEGORIES = Object.freeze([
  'sales', 'delivery', 'admin', 'finance', 'meetings', 'strategy',
  'development', 'marketing', 'support', 'recruiting', 'learning', 'other',
]);

export const TASK_STATUS = Object.freeze([
  'inbox', 'planned', 'in_progress', 'waiting', 'review', 'completed', 'cancelled',
]);

export const PRIORITY = Object.freeze(['low', 'medium', 'high', 'urgent']);

export const FREQUENCY = Object.freeze([
  'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'ad_hoc', 'irregular',
]);

export const ENTRY_SOURCE = Object.freeze([
  'manual', 'timer', 'calendar', 'sort', 'playbook_run',
]);

/** How a duration was arrived at. A sorted group is coarser than a timer. */
export const PRECISION = Object.freeze(['timed', 'calendar_sorted', 'recalled']);

export const ACTIONS = Object.freeze([
  'eliminate', 'automate', 'delegate', 'replace', 'simplify', 'keep',
]);

export const REC_STATUS = Object.freeze([
  'pending', 'accepted', 'rejected', 'snoozed', 'implemented', 'verified',
]);

export const PLAN_STATUS = Object.freeze([
  'draft', 'approved', 'in_progress', 'completed', 'verified', 'cancelled',
]);

export const CONFIDENCE = Object.freeze(['low', 'medium', 'high']);

/** Numeric weight per energy level, used for averaging and for scoring. */
export const ENERGY_SCORE = Object.freeze({
  very_low: -2, low: -1, neutral: 0, high: 1, very_high: 2,
});

export const VALUE_SCORE = Object.freeze({
  low: 0, medium: 1, high: 2, strategic: 3,
});

export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  INTERNAL: 'INTERNAL',
});
