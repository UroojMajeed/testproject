import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import * as service from './rate.service.js';
import { serializeRate } from './rate.serializer.js';

export const setRate = asyncHandler(async (req, res) => {
  const rate = await service.setRate(req.workspace, req.user._id, req.body);
  // 201, because setting a rate appends a record rather than editing one.
  return created(res, { rate: serializeRate(rate) });
});

export const current = asyncHandler(async (req, res) => {
  const rate = await service.currentRate(req.workspace._id, req.user._id);
  return ok(res, { rate: serializeRate(rate) });
});

export const history = asyncHandler(async (req, res) => {
  const rows = await service.history(req.workspace._id, req.user._id);
  return ok(res, { rates: rows.map(serializeRate) });
});
