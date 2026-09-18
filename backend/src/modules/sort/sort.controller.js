import * as service from './sort.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';

export const start = asyncHandler(async (req, res) => {
  const { session, groups } = await service.startSession(req.workspace, req.user._id, req.body);
  return created(res, { session, groups });
});

export const active = asyncHandler(async (req, res) => {
  const found = await service.getActiveSession(req.workspaceId, req.user._id);
  return ok(res, found ?? { session: null, groups: [] });
});

export const get = asyncHandler(async (req, res) => {
  const found = await service.getSession(req.workspaceId, req.user._id, req.params.id);
  return ok(res, found);
});

export const classify = asyncHandler(async (req, res) => {
  const result = await service.classifyGroup(
    req.workspace, req.user._id, req.params.id, req.params.groupId, req.body,
  );
  return ok(res, result);
});

export const skip = asyncHandler(async (req, res) => {
  const result = await service.skipGroup(req.workspaceId, req.user._id, req.params.id, req.params.groupId);
  return ok(res, result);
});

export const complete = asyncHandler(async (req, res) => {
  const session = await service.completeSession(req.workspaceId, req.user._id, req.params.id);
  return ok(res, { session });
});
