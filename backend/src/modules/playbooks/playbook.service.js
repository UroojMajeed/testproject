import { Playbook, PlaybookRun, Task } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { addDays } from '../../services/metrics.service.js';

const REVIEW_INTERVAL_DAYS = 60;

export async function listPlaybooks(workspaceId, { status } = {}) {
  const filter = { workspaceId };
  if (status && status !== 'all') filter.status = status;
  return Playbook.find(filter).sort({ updatedAt: -1 }).populate('ownerId', 'name email');
}

export async function getPlaybook(workspaceId, id) {
  const pb = await Playbook.findOne({ workspaceId, _id: id }).populate('ownerId', 'name email');
  if (!pb) throw ApiError.notFound('Playbook not found');
  return pb;
}

export async function createPlaybook(workspaceId, userId, dto) {
  return Playbook.create({
    ...dto,
    workspaceId,
    createdBy: userId,
    ownerId: dto.ownerId ?? userId,
    steps: (dto.steps ?? []).map((s, i) => ({ ...s, stepNumber: i + 1 })),
  });
}

export async function updatePlaybook(workspaceId, id, dto) {
  const pb = await Playbook.findOne({ workspaceId, _id: id });
  if (!pb) throw ApiError.notFound('Playbook not found');

  if (dto.steps) dto.steps = dto.steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
  Object.assign(pb, dto);
  await pb.save();
  return pb;
}

export async function publishPlaybook(workspaceId, userId, id) {
  const pb = await Playbook.findOne({ workspaceId, _id: id });
  if (!pb) throw ApiError.notFound('Playbook not found');
  if (!pb.steps.length) throw ApiError.badRequest('A playbook needs at least one step before it is published');

  // Re-publishing an already-published playbook cuts a new version.
  if (pb.status === 'published') pb.version += 1;
  pb.status = 'published';
  pb.publishedAt = new Date();
  pb.publishedBy = userId;
  pb.reviewDueAt = addDays(new Date(), REVIEW_INTERVAL_DAYS);
  await pb.save();
  return pb;
}

/**
 * Drafts a playbook from a task's own history.
 *
 * This is the "AI draft" in product terms and it lands in DRAFT for a human to
 * correct — the same rule the spec sets for a model-written one. The skeleton
 * is derived from real data (frequency, average duration, category) rather than
 * invented, and the steps are explicitly marked as placeholders to replace.
 */
export async function draftFromTask(workspaceId, userId, taskId) {
  const task = await Task.findOne({ workspaceId, _id: taskId });
  if (!task) throw ApiError.notFound('Task not found');

  const avg = task.recurrence?.avgMinutesPerOccurrence || 30;
  const share = (pct) => Math.max(5, Math.round((avg * pct) / 5) * 5);

  const steps = [
    {
      title: 'Gather what the task needs',
      instructions: `[Replace this] List where the inputs for "${task.title}" come from — the system, the file, the person.`,
      estimatedMinutes: share(0.25),
      requiredInput: 'Source data or request',
    },
    {
      title: 'Do the work',
      instructions: '[Replace this] Write the actual steps you take, in the order you take them. Short sentences, one action each.',
      estimatedMinutes: share(0.45),
    },
    {
      title: 'Check it',
      instructions: '[Replace this] What does "done correctly" look like? Name the two or three things that are worth checking every time.',
      estimatedMinutes: share(0.15),
      expectedOutput: 'A finished, checked result',
    },
    {
      title: 'Hand it over for review',
      instructions: 'Send the result to the owner for approval before it goes any further.',
      estimatedMinutes: share(0.15),
      approvalRequired: true,
    },
  ].map((s, i) => ({ ...s, stepNumber: i + 1 }));

  return Playbook.create({
    workspaceId,
    name: task.title,
    purpose: `Run ${task.title} without the founder doing it.`,
    trigger: task.recurrence?.frequency === 'weekly' ? 'Once a week' : `Runs ${task.recurrence?.frequency ?? 'as needed'}`,
    frequency: task.recurrence?.frequency ?? 'weekly',
    category: task.category,
    steps,
    qualityChecklist: [
      { item: 'Output matches the expected format', required: true },
      { item: 'Owner approved before it was sent', required: true },
    ],
    status: 'draft',
    generated: true,
    taskId: task._id,
    ownerId: userId,
    createdBy: userId,
  });
}

export async function startRun(workspaceId, userId, playbookId) {
  const pb = await Playbook.findOne({ workspaceId, _id: playbookId });
  if (!pb) throw ApiError.notFound('Playbook not found');
  if (pb.status !== 'published') throw ApiError.conflict('Only a published playbook can be run');

  return PlaybookRun.create({
    workspaceId,
    playbookId: pb._id,
    playbookVersion: pb.version,
    executedBy: userId,
    taskId: pb.taskId ?? null,
    stepResults: pb.steps.map((s) => ({ stepId: s._id, done: false })),
  });
}

export async function updateRun(workspaceId, runId, dto) {
  const run = await PlaybookRun.findOne({ workspaceId, _id: runId });
  if (!run) throw ApiError.notFound('Run not found');

  if (dto.stepResults) {
    for (const incoming of dto.stepResults) {
      const target = run.stepResults.find((s) => String(s.stepId) === String(incoming.stepId));
      if (!target) continue;
      target.done = incoming.done ?? target.done;
      target.notes = incoming.notes ?? target.notes;
      target.completedAt = incoming.done ? new Date() : null;
    }
  }
  if (typeof dto.interventionCount === 'number') run.interventionCount = dto.interventionCount;
  await run.save();
  return run;
}

export async function completeRun(workspaceId, runId, { qualityScore, reviewNotes } = {}) {
  const run = await PlaybookRun.findOne({ workspaceId, _id: runId });
  if (!run) throw ApiError.notFound('Run not found');
  if (run.status === 'completed') return run;

  run.status = 'completed';
  run.completedAt = new Date();
  run.durationMinutes = Math.max(1, Math.round((run.completedAt - run.startedAt) / 60_000));
  if (qualityScore) run.qualityScore = qualityScore;
  if (reviewNotes) run.reviewNotes = reviewNotes;
  await run.save();

  await refreshPlaybookStats(workspaceId, run.playbookId);
  return run;
}

/** Run history is what later powers improvement suggestions. */
async function refreshPlaybookStats(workspaceId, playbookId) {
  const runs = await PlaybookRun.find({ workspaceId, playbookId, status: 'completed' }).lean();
  if (!runs.length) return;

  const durations = runs.map((r) => r.durationMinutes ?? 0);
  const scores = runs.map((r) => r.qualityScore).filter(Boolean);

  await Playbook.updateOne({ _id: playbookId }, {
    stats: {
      runCount: runs.length,
      avgDurationMinutes: Math.round(durations.reduce((s, v) => s + v, 0) / runs.length),
      avgQualityScore: scores.length
        ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
        : 0,
      lastRunAt: runs.at(-1).completedAt,
    },
  });
}

export async function listRuns(workspaceId, playbookId) {
  return PlaybookRun.find({ workspaceId, playbookId }).sort({ startedAt: -1 }).limit(20)
    .populate('executedBy', 'name');
}
