import mongoose from 'mongoose';
import { Membership, Workspace } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { MEMBERSHIP_STATUS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Resolves the active workspace from the X-Workspace-Id header, verifies the
 * caller is an active member, and attaches both to the request.
 *
 * Services take workspaceId as an explicit argument — they never read it from a
 * global — so this is the single place tenancy is established.
 */
export const tenantScope = asyncHandler(async (req, _res, next) => {
  const raw = req.get('x-workspace-id') || req.query.workspaceId;
  if (!raw) throw ApiError.badRequest('X-Workspace-Id header is required for this route');
  if (!mongoose.isValidObjectId(raw)) throw ApiError.badRequest('X-Workspace-Id is not a valid id');

  const membership = await Membership.findOne({
    workspaceId: raw,
    userId: req.user._id,
    status: MEMBERSHIP_STATUS.ACTIVE,
  });

  // Same response whether the workspace does not exist or the caller simply is
  // not in it — probing for valid workspace ids should tell an attacker nothing.
  if (!membership) throw ApiError.notFound('Workspace not found');

  const workspace = await Workspace.findById(raw);
  if (!workspace) throw ApiError.notFound('Workspace not found');

  req.workspace = workspace;
  req.workspaceId = workspace._id;
  req.membership = membership;
  return next();
});

/**
 * Same checks, but the workspace comes from a path parameter instead of the
 * header — for routes shaped /workspaces/:id/... where the id IS the resource.
 */
export const tenantFromParam = (param = 'id') =>
  asyncHandler(async (req, _res, next) => {
    const raw = req.params[param];
    if (!mongoose.isValidObjectId(raw)) throw ApiError.notFound('Workspace not found');

    const membership = await Membership.findOne({
      workspaceId: raw,
      userId: req.user._id,
      status: MEMBERSHIP_STATUS.ACTIVE,
    });
    if (!membership) throw ApiError.notFound('Workspace not found');

    const workspace = await Workspace.findById(raw);
    if (!workspace) throw ApiError.notFound('Workspace not found');

    req.workspace = workspace;
    req.workspaceId = workspace._id;
    req.membership = membership;
    return next();
  });
