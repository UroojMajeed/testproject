import { User, RefreshToken } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ERROR_CODES, USER_STATUS } from '../../config/constants.js';
import { hashPassword, comparePassword, burnPasswordTime } from '../../utils/password.js';
import { randomToken, hashToken, newFamilyId } from '../../utils/crypto.js';
import { signAccessToken } from '../../utils/token.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const REFRESH_TTL_MS = () => env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/** Issues a refresh token row and returns the raw value — shown once, never stored. */
async function issueRefreshToken(userId, ctx, family = newFamilyId()) {
  const raw = randomToken();
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(raw),
    family,
    userAgent: ctx.userAgent?.slice(0, 255) ?? null,
    ipAddress: ctx.ip ?? null,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS()),
  });
  return { raw, family, maxAge: REFRESH_TTL_MS() };
}

function sessionFor(user, refresh) {
  return { accessToken: signAccessToken(user), refresh, user };
}

export async function register({ name, email, password, timezone }, ctx) {
  const existing = await User.findOne({ email }).setOptions({ withDeleted: true });
  if (existing) throw ApiError.conflict('That email is already registered');

  const verifyToken = randomToken(32);
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    timezone: timezone || 'UTC',
    emailVerifyTokenHash: hashToken(verifyToken),
    emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
  });

  const refresh = await issueRefreshToken(user._id, ctx);
  logger.info({ userId: String(user._id) }, 'user registered');

  // verifyToken is returned so the caller can mail it; it is never logged.
  return { ...sessionFor(user, refresh), verifyToken };
}

export async function login({ email, password }, ctx) {
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockedUntil');

  if (!user) {
    await burnPasswordTime();
    throw ApiError.unauthenticated('Email or password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    throw ApiError.locked(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    await burnPasswordTime();
    throw ApiError.unauthenticated('Email or password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= env.MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
      logger.warn({ userId: String(user._id) }, 'account locked after repeated failures');
    }
    await user.save();
    throw ApiError.unauthenticated('Email or password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  return sessionFor(user, await issueRefreshToken(user._id, ctx));
}

/**
 * Rotation with reuse detection.
 *
 * Every refresh consumes its token and mints a replacement in the same family.
 * Presenting an already-revoked token means the value leaked, so the whole family
 * is revoked and every access token for that user is invalidated.
 */
export async function rotateRefreshToken(rawToken, ctx) {
  if (!rawToken) throw ApiError.unauthenticated('No refresh token supplied');

  const row = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!row) throw ApiError.unauthenticated('Session not recognised. Please sign in again.');

  if (row.revokedAt) {
    await RefreshToken.updateMany(
      { family: row.family, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'reuse_detected' },
    );
    await User.updateOne({ _id: row.userId }, { $inc: { tokenVersion: 1 } });
    logger.warn({ userId: String(row.userId), family: row.family }, 'refresh token reuse — family revoked');
    throw ApiError.unauthenticated('Session was reused and has been ended', ERROR_CODES.TOKEN_REUSED);
  }

  if (row.expiresAt <= new Date()) {
    throw ApiError.unauthenticated('Session expired. Please sign in again.', ERROR_CODES.TOKEN_EXPIRED);
  }

  const user = await User.findById(row.userId);
  if (!user || user.status !== USER_STATUS.ACTIVE) throw ApiError.unauthenticated();

  const next = await issueRefreshToken(user._id, ctx, row.family);
  row.revokedAt = new Date();
  row.revokedReason = 'rotated';
  row.replacedByHash = hashToken(next.raw);
  await row.save();

  return sessionFor(user, next);
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout' },
  );
}

/** Signs out every device and invalidates outstanding access tokens too. */
export async function logoutEverywhere(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout_all' },
  );
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

/**
 * Always resolves, whether or not the address exists — the controller returns an
 * identical response either way, so the endpoint cannot enumerate accounts.
 */
export async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return null;

  const token = randomToken(32);
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  logger.info({ userId: String(user._id) }, 'password reset requested');
  return { user, token };
}

export async function resetPassword(token, newPassword) {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) throw ApiError.badRequest('That reset link is invalid or has expired');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetTokenHash = null;   // single use
  user.passwordResetExpiresAt = null;
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;               // kill outstanding access tokens
  await user.save();

  // A password change ends every existing session, everywhere.
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'password_reset' },
  );

  return user;
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user?.passwordHash) throw ApiError.badRequest('This account has no password set');

  const match = await comparePassword(currentPassword, user.passwordHash);
  if (!match) throw ApiError.unauthenticated('Current password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.tokenVersion += 1;
  await user.save();

  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'password_changed' },
  );
  return user;
}

export async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpiresAt: { $gt: new Date() },
  }).select('+emailVerifyTokenHash +emailVerifyExpiresAt');

  if (!user) throw ApiError.badRequest('That verification link is invalid or has expired');

  user.emailVerifiedAt = new Date();
  user.emailVerifyTokenHash = null;
  user.emailVerifyExpiresAt = null;
  await user.save();
  return user;
}
