import crypto from 'node:crypto';

/** Opaque, high-entropy token for refresh / reset / invite flows. */
export function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored hashed, never raw — a database dump must not yield
 * usable sessions. SHA-256 is right here (not bcrypt): these are already
 * high-entropy, so there is nothing to brute-force, and lookups must be fast.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison. Never use === on a secret. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // Still burn the comparison so length is not leaked by timing.
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function newFamilyId() {
  return crypto.randomUUID();
}
