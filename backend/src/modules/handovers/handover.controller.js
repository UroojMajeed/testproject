import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/ApiResponse.js';
import * as service from './handover.service.js';
import { serializeHandover } from './handover.serializer.js';

export const plan = asyncHandler(async (req, res) =>
  ok(res, await service.plan(req.workspace, req.user._id)));

export const list = asyncHandler(async (req, res) => {
  const rows = await service.list(req.workspace._id);
  return ok(res, { handovers: rows.map(serializeHandover) });
});

export const start = asyncHandler(async (req, res) => {
  const handover = await service.start(req.workspace, req.user._id, req.body.activityId);
  return created(res, { handover: serializeHandover(handover) });
});

export const setStep = asyncHandler(async (req, res) => {
  const handover = await service.setStep(req.workspace._id, req.params.id, req.params.key, req.body.done);
  return ok(res, { handover: serializeHandover(handover) });
});

export const update = asyncHandler(async (req, res) => {
  const handover = await service.update(req.workspace._id, req.params.id, req.body);
  return ok(res, { handover: serializeHandover(handover) });
});

export const drop = asyncHandler(async (req, res) => {
  await service.drop(req.workspace._id, req.params.id);
  return noContent(res);
});
