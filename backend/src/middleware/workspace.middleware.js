import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as workspaces from '../modules/workspaces/workspace.service.js';

/**
 * Puts the caller's workspace on the request.
 *
 * Runs after requireAuth. Everything tenant-scoped needs it, and having it here
 * means no controller has to remember to look the workspace up — which is the same
 * argument as the tenant plugin, one layer higher.
 */
export const withWorkspace = asyncHandler(async (req, _res, next) => {
  const workspace = await workspaces.forOwner(req.user._id);

  // Created at registration, so its absence is a bug rather than a state to handle.
  if (!workspace) throw ApiError.notFound('No workspace for this account');

  req.workspace = workspace;
  return next();
});
