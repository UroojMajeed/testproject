import * as service from './workspace.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { serializeWorkspace, serializeMembership } from './workspace.serializer.js';
import { ROLES } from '../../config/constants.js';
import { logger } from '../../config/logger.js';

export const create = asyncHandler(async (req, res) => {
  const workspace = await service.createWorkspace(req.user._id, req.body);
  return created(res, { workspace: serializeWorkspace(workspace, ROLES.OWNER) });
});

export const list = asyncHandler(async (req, res) => {
  const rows = await service.listForUser(req.user._id);
  return ok(res, { workspaces: rows.map(({ workspace, role }) => serializeWorkspace(workspace, role)) });
});

export const get = asyncHandler(async (req, res) =>
  ok(res, { workspace: serializeWorkspace(req.workspace, req.membership.role) }));

export const update = asyncHandler(async (req, res) => {
  const workspace = await service.updateWorkspace(req.workspace, req.body);
  return ok(res, { workspace: serializeWorkspace(workspace, req.membership.role) });
});

export const setBuybackRate = asyncHandler(async (req, res) => {
  const workspace = await service.updateBuybackRate(req.workspace, req.body);
  return ok(res, { workspace: serializeWorkspace(workspace, req.membership.role) });
});

export const setOnboarding = asyncHandler(async (req, res) => {
  const workspace = await service.updateOnboarding(req.workspace, req.body);
  return ok(res, { workspace: serializeWorkspace(workspace, req.membership.role) });
});

export const members = asyncHandler(async (req, res) => {
  const rows = await service.listMembers(req.workspaceId);
  return ok(res, { members: rows.map((m) => serializeMembership(m, m.userId)) });
});

export const invite = asyncHandler(async (req, res) => {
  const { membership, token } = await service.inviteMember(req.workspaceId, req.user._id, req.body);

  // TODO(phase-2): mail the token. Never returned in the response body.
  logger.debug({ membershipId: String(membership._id) }, 'invite token issued');
  void token;

  return created(res, { member: serializeMembership(membership) });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const membership = await service.acceptInvite(req.body.token, req.user._id, req.user.email);
  return ok(res, { member: serializeMembership(membership) });
});
