import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import * as service from './workspace.service.js';
import { serializeWorkspace } from './workspace.serializer.js';

export const show = asyncHandler(async (req, res) =>
  ok(res, { workspace: serializeWorkspace(req.workspace) }));

/**
 * Where to send this person next.
 *
 * One call rather than the client inferring onboarding state from the absence of
 * other things — that inference ends up copied into every route guard and drifts
 * from the server's view of the same question.
 */
export const state = asyncHandler(async (req, res) =>
  ok(res, await service.stateFor(req.workspace, req.user._id)));
