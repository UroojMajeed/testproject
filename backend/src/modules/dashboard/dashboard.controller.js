import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import * as service from './dashboard.service.js';

/**
 * `?week=YYYY-MM-DD` asks for one particular week instead of the most recent.
 *
 * Validated by the route's schema rather than trusted here, so a malformed date
 * is a 422 naming the parameter and not a week that silently fails to match.
 */
export const show = asyncHandler(async (req, res) =>
  ok(res, await service.forWorkspace(req.workspace, req.user._id, { weekStarting: req.query.week ?? null })));
