import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import * as service from './audit.service.js';
import { serializeAuditWeek } from './audit.serializer.js';

/**
 * The week now open for filing, plus last week's hours as suggestions.
 *
 * The suggestions are what make the second audit take two minutes instead of ten,
 * which is the difference between a weekly habit and something people abandon.
 */
export const current = asyncHandler(async (req, res) => {
  const { week, suggestions, isNew } = await service.currentWeek(req.workspace, req.user._id);
  return ok(res, {
    week: serializeAuditWeek(week),
    suggestions: suggestions.map((s) => ({
      activityId: String(s.activityId),
      estimatedMinutes: s.estimatedMinutes,
    })),
    isNew,
  });
});

export const show = asyncHandler(async (req, res) =>
  ok(res, { week: serializeAuditWeek(await service.findWeek(req.workspace, req.user._id, req.params.weekStarting)) }));

export const save = asyncHandler(async (req, res) => {
  const week = await service.saveWeek(req.workspace, req.user._id, req.params.weekStarting, req.body);
  return ok(res, { week: serializeAuditWeek(week) });
});

export const list = asyncHandler(async (req, res) => {
  const weeks = await service.listWeeks(req.workspace, req.user._id);
  return ok(res, { weeks: weeks.map(serializeAuditWeek) });
});
