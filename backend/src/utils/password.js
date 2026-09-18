import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Burns roughly the same time as a real comparison so that "no such user" and
 * "wrong password" are indistinguishable to a timing attacker.
 */
const DUMMY_HASH = '$2a$12$K8Z4pQ1Xn3vJH.eYxWlq4uJ7Xz6Yb1cN0pR2sT3uV4wX5yZ6aB7cC';
export function burnPasswordTime() {
  return bcrypt.compare('placeholder-input', DUMMY_HASH).catch(() => false);
}
