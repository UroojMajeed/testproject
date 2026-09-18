import { Task, TimeEntry } from '../models/index.js';
import { fingerprintOf, inferFrequency, stdDev } from './fingerprint.js';
import { toQuadrant, ENERGY, VALUE } from '../config/constants.js';

/**
 * Finds the task a title belongs to, or creates it. This is what makes nine
 * differently-worded entries collapse into one recurring activity.
 */
export async function upsertTaskForTitle(workspaceId, userId, { title, category, energy, value }) {
  const fingerprint = fingerprintOf(title);
  if (!fingerprint) return null;

  const existing = await Task.findOne({ workspaceId, fingerprint });
  if (existing) return existing;

  const drip = energy && value
    ? { energy, value, quadrant: toQuadrant(energy, value), source: 'derived', classifiedAt: new Date() }
    : {};

  return Task.create({
    workspaceId,
    title,
    fingerprint,
    category: category ?? 'other',
    createdBy: userId,
    ownerId: userId,
    status: 'inbox',
    drip,
  });
}

/**
 * Recomputes a task's rollups from its entries: actual minutes, how often it
 * recurs, and how much its length varies. Called after any entry mutation.
 */
export async function recomputeTaskRollups(workspaceId, taskId, windowDays = 14) {
  const task = await Task.findOne({ workspaceId, _id: taskId });
  if (!task) return null;

  const entries = await TimeEntry.find({ workspaceId, taskId, status: { $ne: 'ignored' } })
    .sort({ date: 1 })
    .lean();

  if (!entries.length) {
    task.actualMinutes = 0;
    task.recurrence = { ...task.recurrence.toObject?.() ?? task.recurrence, isRecurring: false, occurrences: 0 };
    await task.save();
    return task;
  }

  const durations = entries.map((e) => e.durationMinutes ?? 0);
  const total = durations.reduce((s, v) => s + v, 0);
  const occurrences = entries.length;

  task.actualMinutes = total;
  task.recurrence = {
    isRecurring: occurrences >= 2,
    frequency: inferFrequency(occurrences, windowDays),
    occurrences,
    avgMinutesPerOccurrence: Math.round(total / occurrences),
    durationStdDev: Math.round(stdDev(durations)),
    firstSeenAt: entries[0].date,
    lastSeenAt: entries.at(-1).date,
  };

  // Derive the quadrant from the entries unless a human has set it by hand.
  if (task.drip?.source !== 'user') {
    const energies = entries.map((e) => e.energy).filter(Boolean);
    const values = entries.map((e) => e.value).filter(Boolean);
    if (energies.length && values.length) {
      const energy = mode(energies) ?? ENERGY.NEUTRAL;
      const value = mode(values) ?? VALUE.MEDIUM;
      task.drip = { energy, value, quadrant: toQuadrant(energy, value), source: 'derived', classifiedAt: new Date() };
    }
  }

  task.buybackCandidate =
    task.recurrence.isRecurring &&
    ['delegation', 'replacement'].includes(task.drip?.quadrant);

  await task.save();
  return task;
}

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, z) => z[1] - a[1])[0]?.[0] ?? null;
}
