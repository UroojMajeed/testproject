/** Mirrors backend/src/config/constants.js. Keep the two in step. */

export const ROLES = Object.freeze({ OWNER: 'owner', MANAGER: 'manager', MEMBER: 'member' });
export const ROLE_RANK = Object.freeze({ member: 1, manager: 2, owner: 3 });

export const DRIP = Object.freeze({
  DELEGATION: 'delegation',
  REPLACEMENT: 'replacement',
  INVESTMENT: 'investment',
  PRODUCTION: 'production',
});

export const DRIP_LABEL = Object.freeze({
  delegation: 'Delegation',
  replacement: 'Replacement',
  investment: 'Investment',
  production: 'Production',
});

export const INDUSTRIES = Object.freeze([
  { value: 'software', label: 'Software' },
  { value: 'agency', label: 'Agency' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'realestate', label: 'Real estate' },
  { value: 'other', label: 'Other' },
]);

export const CATEGORY_OPTIONS = Object.freeze([
  { value: 'sales', label: 'Sales' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance', label: 'Finance' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'development', label: 'Development' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'support', label: 'Support' },
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'learning', label: 'Learning' },
  { value: 'other', label: 'Other' },
]);

export const ACTION_LABEL = Object.freeze({
  eliminate: 'Eliminate',
  automate: 'Automate',
  delegate: 'Delegate',
  replace: 'Replace',
  simplify: 'Simplify',
  keep: 'Keep',
});

export const PLAN_STATUS_LABEL = Object.freeze({
  draft: 'Draft',
  approved: 'Approved',
  in_progress: 'In progress',
  completed: 'Needs review',
  verified: 'Verified',
  cancelled: 'Cancelled',
});
