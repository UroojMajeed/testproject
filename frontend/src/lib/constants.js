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
