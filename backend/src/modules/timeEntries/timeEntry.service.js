import { TimeEntry } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { toQuadrant } from '../../config/constants.js';
import { costOfMinutes } from '../../utils/format.js';
import { dayKey, recomputeDay } from '../../services/metrics.service.js';
import { upsertTaskForTitle, recomputeTaskRollups } from '../../services/task.service.js';

/** Everything a new entry needs derived before it is written. */
async function decorate(workspace, userId, dto) {
  const quadrant = toQuadrant(dto.energy, dto.value);
  const task = dto.taskId
    ? null
    : await upsertTaskForTitle(workspace._id, userId, dto);

  return {
    ...dto,
    date: dayKey(dto.date),
    dripQuadrant: quadrant,
    taskId: dto.taskId ?? task?._id ?? null,
    // Frozen at write: a later rate change must not rewrite history.
    estimatedCostMinor: costOfMinutes(dto.durationMinutes, workspace.buybackRate?.amountMinor ?? 0),
  };
}

export async function createEntry(workspace, userId, dto) {
  const payload = await decorate(workspace, userId, dto);
  const entry = await TimeEntry.create({ ...payload, workspaceId: workspace._id, userId });

  await recomputeDay(workspace._id, userId, entry.date);
  if (entry.taskId) await recomputeTaskRollups(workspace._id, entry.taskId);

  return entry;
}

export async function createMany(workspace, userId, items) {
  const created = [];
  for (const dto of items) created.push(await createEntry(workspace, userId, dto));
  return created;
}

export async function listEntries(workspaceId, userId, { from, to, taskId, page, limit }) {
  const filter = { workspaceId, userId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = dayKey(from);
    if (to) filter.date.$lte = dayKey(to);
  }
  if (taskId) filter.taskId = taskId;

  const [entries, total] = await Promise.all([
    TimeEntry.find(filter).sort({ date: -1, startAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TimeEntry.countDocuments(filter),
  ]);

  return { entries, total };
}

export async function updateEntry(workspaceId, userId, id, dto) {
  const entry = await TimeEntry.findOne({ workspaceId, _id: id });
  if (!entry) throw ApiError.notFound('Time entry not found');
  // A member may only edit their own time.
  if (String(entry.userId) !== String(userId)) throw ApiError.forbidden('That entry belongs to someone else');

  const previousDay = entry.date;
  Object.assign(entry, dto);
  if (dto.date) entry.date = dayKey(dto.date);
  if (dto.energy || dto.value) entry.dripQuadrant = toQuadrant(entry.energy, entry.value);
  await entry.save();

  await recomputeDay(workspaceId, userId, entry.date);
  if (String(previousDay) !== String(entry.date)) await recomputeDay(workspaceId, userId, previousDay);
  if (entry.taskId) await recomputeTaskRollups(workspaceId, entry.taskId);

  return entry;
}

export async function deleteEntry(workspaceId, userId, id) {
  const entry = await TimeEntry.findOne({ workspaceId, _id: id });
  if (!entry) throw ApiError.notFound('Time entry not found');
  if (String(entry.userId) !== String(userId)) throw ApiError.forbidden('That entry belongs to someone else');

  await entry.softDelete();
  await recomputeDay(workspaceId, userId, entry.date);
  if (entry.taskId) await recomputeTaskRollups(workspaceId, entry.taskId);
}
