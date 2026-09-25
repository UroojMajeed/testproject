/** Mirrors backend/src/config/constants.js. If one changes, both change. */

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

/**
 * What the user reads when something goes wrong. The server's message is written
 * for a developer reading a log; these are written for someone who is trying to
 * sign in and is already slightly annoyed.
 */
export const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_CREDENTIALS]: 'That email and password do not match an account.',
  [ERROR_CODES.ACCOUNT_LOCKED]:
    'Too many attempts, so this account is locked for a few minutes. You can reset your password instead.',
  [ERROR_CODES.RATE_LIMITED]: 'That is a lot of attempts in a short time. Wait a minute and try again.',
  // No CONFLICT here on purpose. It used to read "There is already an account
  // with that email address", which is true of the one conflict the app had when
  // it was written and wrong about every other: renaming an activity to a name
  // already in use answered with a sentence about email addresses. A code says
  // what kind of failure it is, not what the failure was about, so the server's
  // own message — "You already have an activity with that name" — is the one
  // worth showing.
  [ERROR_CODES.TOKEN_REUSED]: 'For your safety this session was ended. Please sign in again.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session expired. Please sign in again.',
  [ERROR_CODES.INTERNAL]: 'Something went wrong at our end. Please try again.',
  NETWORK: 'Cannot reach the server. Check that the API is running on port 5000.',
});
