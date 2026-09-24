import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import * as service from './dashboard.service.js';

export const show = asyncHandler(async (req, res) =>
  ok(res, await service.forWorkspace(req.workspace, req.user._id)));
