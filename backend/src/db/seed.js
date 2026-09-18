/**
 * Seeds a demo workspace with two weeks of realistic activity, so the whole
 * loop — sort, matrix, advisor, plan, verification — can be exercised without
 * hand-entering a fortnight of work.
 *
 * Usage: npm run seed
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { logger } from '../config/logger.js';
import {
  User, Workspace, Membership, TimeEntry, Task, Playbook,
} from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { toQuadrant, ROLES, MEMBERSHIP_STATUS } from '../config/constants.js';
import { fingerprintOf } from '../services/fingerprint.js';
import { costOfMinutes } from '../utils/format.js';
import { dayKey, addDays, recomputeDay } from '../services/metrics.service.js';
import { recomputeTaskRollups } from '../services/task.service.js';

const DEMO_EMAIL = 'founder@reclaimos.test';
const DEMO_PASSWORD = 'reclaim-your-time-2026';

// dayOffset counts back from today. Two weeks of a fairly typical founder week.
const ACTIVITY = [
  { title: 'Weekly client report', minutes: 130, category: 'admin', energy: 'low', value: 'high', days: [1, 8] },
  { title: 'Client report — retainers', minutes: 115, category: 'admin', energy: 'low', value: 'high', days: [4, 11] },
  { title: 'Invoice reminders', minutes: 45, category: 'finance', energy: 'low', value: 'low', days: [2, 5, 9, 12] },
  { title: 'Inbox triage', minutes: 55, category: 'admin', energy: 'low', value: 'low', days: [1, 2, 3, 6, 8, 9, 10, 13] },
  { title: 'Monday all-hands', minutes: 60, category: 'meetings', energy: 'low', value: 'low', days: [1, 8] },
  { title: 'Discovery call — Northwind', minutes: 60, category: 'sales', energy: 'high', value: 'strategic', days: [2, 9] },
  { title: 'Discovery call — Halcyon', minutes: 45, category: 'sales', energy: 'high', value: 'strategic', days: [5, 12] },
  { title: 'Proposal writing', minutes: 90, category: 'sales', energy: 'high', value: 'high', days: [3, 10] },
  { title: 'Product strategy', minutes: 120, category: 'strategy', energy: 'very_high', value: 'strategic', days: [6, 13] },
  { title: 'Team 1:1s', minutes: 60, category: 'meetings', energy: 'high', value: 'medium', days: [4, 11] },
  { title: 'Reading and research', minutes: 40, category: 'learning', energy: 'high', value: 'low', days: [7, 14] },
  { title: 'Vendor admin', minutes: 35, category: 'admin', energy: 'very_low', value: 'low', days: [6, 13] },
];

async function main() {
  await connectDb();
  logger.info('seeding demo data');

  await Promise.all(
    [User, Workspace, Membership, TimeEntry, Task, Playbook].map((M) =>
      M.deleteMany({ $or: [{ email: DEMO_EMAIL }, { slug: /^meridian-studio/ }] }).catch(() => {}),
    ),
  );

  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const ws = await Workspace.find({ ownerId: existing._id }).select('_id');
    const ids = ws.map((w) => w._id);
    await Promise.all([
      TimeEntry.deleteMany({ workspaceId: { $in: ids } }),
      Task.deleteMany({ workspaceId: { $in: ids } }),
      Playbook.deleteMany({ workspaceId: { $in: ids } }),
      Membership.deleteMany({ workspaceId: { $in: ids } }),
      Workspace.deleteMany({ _id: { $in: ids } }),
      User.deleteOne({ _id: existing._id }),
      mongoose.connection.collection('metricsdailies').deleteMany({ workspaceId: { $in: ids } }),
    ]);
  }

  const user = await User.create({
    name: 'Urooj Majeed',
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    timezone: 'UTC',
    emailVerifiedAt: new Date(),
  });

  const workspace = await Workspace.create({
    name: 'Meridian Studio',
    slug: `meridian-studio-${Date.now().toString(36).slice(-6)}`,
    industry: 'agency',
    timezone: 'UTC',
    currency: 'USD',
    currentWeeklyHours: 50,
    targetWeeklyHours: 35,
    weeklyBuybackGoalHours: 15,
    buybackRate: {
      amountMinor: 5000,               // $50.00 per hour
      currency: 'USD',
      method: 'calculated',
      annualCompensationMinor: 40_000_000,
      annualHours: 8000,
      updatedAt: new Date(),
    },
    onboarding: { step: 3, completedAt: new Date() },
    ownerId: user._id,
    createdBy: user._id,
  });

  await Membership.create({
    workspaceId: workspace._id, userId: user._id,
    role: ROLES.OWNER, status: MEMBERSHIP_STATUS.ACTIVE, joinedAt: new Date(),
  });
  user.defaultWorkspaceId = workspace._id;
  await user.save();

  const today = dayKey(new Date());
  const taskCache = new Map();
  const touchedDays = new Set();

  for (const a of ACTIVITY) {
    const fingerprint = fingerprintOf(a.title);
    let task = taskCache.get(fingerprint);
    if (!task) {
      task = await Task.findOne({ workspaceId: workspace._id, fingerprint })
        ?? await Task.create({
          workspaceId: workspace._id,
          title: a.title,
          fingerprint,
          category: a.category,
          createdBy: user._id,
          ownerId: user._id,
          status: 'inbox',
        });
      taskCache.set(fingerprint, task);
    }

    for (const offset of a.days) {
      const date = addDays(today, -offset);
      touchedDays.add(date.toISOString());
      // A little natural variation, so duration variance is not artificially zero.
      const jitter = Math.round((Math.sin(offset * a.minutes) * a.minutes) / 12);

      await TimeEntry.create({
        workspaceId: workspace._id,
        userId: user._id,
        taskId: task._id,
        title: a.title,
        date,
        durationMinutes: Math.max(10, a.minutes + jitter),
        category: a.category,
        energy: a.energy,
        value: a.value,
        dripQuadrant: toQuadrant(a.energy, a.value),
        source: 'manual',
        precision: 'timed',
        estimatedCostMinor: costOfMinutes(a.minutes + jitter, workspace.buybackRate.amountMinor),
      });
    }
  }

  for (const iso of touchedDays) await recomputeDay(workspace._id, user._id, new Date(iso));
  for (const task of taskCache.values()) await recomputeTaskRollups(workspace._id, task._id);

  const entries = await TimeEntry.countDocuments({ workspaceId: workspace._id });

  logger.info(
    { workspace: workspace.name, tasks: taskCache.size, entries },
    'seed complete',
  );
  // eslint-disable-next-line no-console
  console.log(`\n  Sign in with:\n    email    ${DEMO_EMAIL}\n    password ${DEMO_PASSWORD}\n`);

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'seed failed');
  await disconnectDb().catch(() => {});
  process.exit(1);
});
