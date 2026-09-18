import * as service from './timeEntry.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/ApiResponse.js';
import { pageMeta } from '../../utils/paginate.js';
import { summarise, fillDays, dayKey, addDays } from '../../services/metrics.service.js';

const DEFAULT_WINDOW_DAYS = 14;

function windowFrom(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : addDays(to, -(DEFAULT_WINDOW_DAYS - 1));
  return { from: dayKey(from), to: dayKey(to) };
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { entries, total } = await service.listEntries(req.workspaceId, req.user._id, req.query);
  return ok(res, { entries }, pageMeta({ page, limit }, total));
});

export const create = asyncHandler(async (req, res) => {
  const entry = await service.createEntry(req.workspace, req.user._id, req.body);
  return created(res, { entry });
});

export const update = asyncHandler(async (req, res) => {
  const entry = await service.updateEntry(req.workspaceId, req.user._id, req.params.id, req.body);
  return ok(res, { entry });
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteEntry(req.workspaceId, req.user._id, req.params.id);
  return noContent(res);
});

export const summary = asyncHandler(async (req, res) => {
  const { from, to } = windowFrom(req.query);
  const scopeUser = req.query.scope === 'workspace' ? undefined : req.user._id;

  const total = await summarise(req.workspaceId, { userId: scopeUser, from, to });
  return ok(res, {
    window: { from, to },
    summary: { ...total, days: fillDays(total.days, from, to) },
    currency: req.workspace.currency,
    buybackRateMinor: req.workspace.buybackRate?.amountMinor ?? 0,
  });
});
