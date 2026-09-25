import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/ApiResponse.js';
import * as service from './activity.service.js';
import { serializeActivity } from './activity.serializer.js';

export const list = asyncHandler(async (req, res) => {
  const rows = await service.list(req.workspace._id, { includeArchived: req.query.includeArchived === 'true' });
  return ok(res, { activities: rows.map(serializeActivity) });
});

export const create = asyncHandler(async (req, res) =>
  created(res, { activity: serializeActivity(await service.create(req.workspace._id, req.body.name)) }));

export const rename = asyncHandler(async (req, res) =>
  ok(res, { activity: serializeActivity(await service.rename(req.workspace._id, req.params.id, req.body.name)) }));

export const unsorted = asyncHandler(async (req, res) => {
  const rows = await service.unsorted(req.workspace._id);
  return ok(res, { activities: rows.map(serializeActivity) });
});

export const setValue = asyncHandler(async (req, res) =>
  ok(res, {
    activity: serializeActivity(await service.setValue(req.workspace._id, req.params.id, req.body.value)),
  }));

export const archive = asyncHandler(async (req, res) => {
  await service.archive(req.workspace._id, req.params.id);
  return noContent(res);
});
