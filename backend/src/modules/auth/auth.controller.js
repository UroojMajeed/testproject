import * as service from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/ApiResponse.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../utils/token.js';
import { serializeUser } from '../users/user.serializer.js';
import { serializeWorkspace } from '../workspaces/workspace.serializer.js';
import { logger } from '../../config/logger.js';

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

function setRefreshCookie(res, refresh) {
  res.cookie(REFRESH_COOKIE, refresh.raw, refreshCookieOptions(refresh.maxAge));
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(0), maxAge: undefined });
}

export const register = asyncHandler(async (req, res) => {
  const { accessToken, refresh, user, verifyToken } = await service.register(req.body, ctxOf(req));
  setRefreshCookie(res, refresh);

  // TODO(phase-2): hand verifyToken to the mailer. Logged at debug in dev only.
  logger.debug({ userId: String(user._id) }, 'verification token issued');
  void verifyToken;

  return created(res, { accessToken, user: serializeUser(user), workspaces: [] });
});

export const login = asyncHandler(async (req, res) => {
  const { accessToken, refresh, user } = await service.login(req.body, ctxOf(req));
  setRefreshCookie(res, refresh);

  const memberships = await service.listMemberships(user._id);
  return ok(res, {
    accessToken,
    user: serializeUser(user),
    workspaces: memberships.map((m) => serializeWorkspace(m.workspaceId, m.role)),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { accessToken, refresh: next, user } = await service.rotateRefreshToken(
    req.cookies?.[REFRESH_COOKIE],
    ctxOf(req),
  );
  setRefreshCookie(res, next);
  return ok(res, { accessToken, user: serializeUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  return noContent(res);
});

export const logoutAll = asyncHandler(async (req, res) => {
  await service.logoutEverywhere(req.user._id);
  clearRefreshCookie(res);
  return noContent(res);
});

export const me = asyncHandler(async (req, res) => {
  const memberships = await service.listMemberships(req.user._id);
  return ok(res, {
    user: serializeUser(req.user),
    workspaces: memberships.map((m) => serializeWorkspace(m.workspaceId, m.role)),
  });
});

/** Identical response whether or not the address exists. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await service.requestPasswordReset(req.body.email);
  if (result) logger.debug({ userId: String(result.user._id) }, 'reset token issued');

  return ok(res, {
    message: 'If an account exists for that address, a reset link is on its way.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.body.token, req.body.password);
  clearRefreshCookie(res);
  return ok(res, { message: 'Password updated. Please sign in with your new password.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await service.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  return ok(res, { message: 'Password updated. You have been signed out of other devices.' });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await service.verifyEmail(req.body.token);
  return ok(res, { user: serializeUser(user) });
});
