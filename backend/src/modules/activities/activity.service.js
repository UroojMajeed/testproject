import { Activity } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../config/constants.js';

/**
 * Activities persist between weeks; that is the point of them existing at all.
 * Weekly entries reference these rows, which is what makes a trend possible and
 * what lets next week's form arrive pre-filled.
 */

export async function list(workspaceId, { includeArchived = false } = {}) {
  const query = { workspaceId };
  if (!includeArchived) query.archivedAt = null;
  return Activity.find(query).sort({ name: 1 }).collation({ locale: 'en', strength: 2 });
}

/**
 * Finds by name or creates. The audit form lets people type a new activity inline,
 * and "Invoicing" typed twice must not become two rows that split every trend.
 */
export async function findOrCreate(workspaceId, name) {
  const trimmed = name.trim();

  const existing = await Activity.findOne({ workspaceId, name: trimmed })
    .collation({ locale: 'en', strength: 2 });
  if (existing) {
    // Re-typing an archived activity means it is back.
    if (existing.archivedAt) {
      existing.archivedAt = null;
      await existing.save();
    }
    return existing;
  }

  try {
    return await Activity.create({ workspaceId, name: trimmed });
  } catch (err) {
    // Two requests racing on the same name: the unique index is the arbiter, and
    // the loser reads the winner's row rather than failing the whole audit save.
    if (err?.code === 11000) {
      return Activity.findOne({ workspaceId, name: trimmed }).collation({ locale: 'en', strength: 2 });
    }
    throw err;
  }
}

export async function create(workspaceId, name) {
  const trimmed = name.trim();
  const existing = await Activity.findOne({ workspaceId, name: trimmed })
    .collation({ locale: 'en', strength: 2 });

  if (existing && !existing.archivedAt) {
    throw new ApiError(409, ERROR_CODES.CONFLICT, 'You already have an activity with that name');
  }
  return findOrCreate(workspaceId, trimmed);
}

export async function rename(workspaceId, id, name) {
  const activity = await Activity.findByIdScoped(id, workspaceId);
  if (!activity) throw ApiError.notFound('No such activity');

  activity.name = name.trim();
  try {
    return await activity.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(409, ERROR_CODES.CONFLICT, 'You already have an activity with that name');
    }
    throw err;
  }
}

/**
 * Archived, never deleted. Past audits reference it, and a week's history should
 * not change because something stopped happening.
 */
export async function archive(workspaceId, id) {
  const activity = await Activity.findByIdScoped(id, workspaceId);
  if (!activity) throw ApiError.notFound('No such activity');

  activity.archivedAt = new Date();
  return activity.save();
}
