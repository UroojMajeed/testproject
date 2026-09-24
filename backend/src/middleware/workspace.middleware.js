import { asyncHandler } from '../utils/asyncHandler.js';
import * as workspaces from '../modules/workspaces/workspace.service.js';

/**
 * Puts the caller's workspace on the request.
 *
 * Runs after requireAuth. Everything tenant-scoped needs it, and having it here
 * means no controller has to remember to look the workspace up — the same argument
 * as the tenant plugin, one layer higher.
 *
 * It creates one when there is not one. That is not defensive padding: accounts
 * registered before step 2 existed have no workspace, and until this they met a
 * 404 on every screen — signed in, with a real session, told their own workspace
 * did not exist.
 */
export const withWorkspace = asyncHandler(async (req, _res, next) => {
  req.workspace = await workspaces.findOrCreateForOwner(req.user);
  return next();
});
