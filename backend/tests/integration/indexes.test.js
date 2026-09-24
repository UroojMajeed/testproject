import { describe, it, expect, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { reportIndexProblems } from '../../src/config/db.js';
import { Activity } from '../../src/models/index.js';

/**
 * An index that fails to build is a constraint the application believes it has and
 * does not. Mongoose stores the error on the model and says nothing: the app keeps
 * serving, the collection quietly keeps whatever index was already there, and the
 * first sign of trouble is duplicate rows that should have been impossible.
 *
 * The usual cause is an index of the same name left behind by an earlier version
 * of the schema — which is exactly what happens on a database that has been
 * running a while.
 */

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  await mongoose.connection.db.collection('activities').drop().catch(() => {});
});

describe('index health at boot', () => {
  it('reports nothing when every index builds', async () => {
    await Activity.init();
    expect(await reportIndexProblems([Activity])).toEqual([]);
  });

  it('names the model when an index conflicts with one already there', async () => {
    const activities = mongoose.connection.db.collection('activities');
    await activities.drop().catch(() => {});

    // Same name and keys, different options — an older schema's leftover.
    await activities.createIndex({ workspaceId: 1, name: 1 }, { name: 'workspaceId_1_name_1' });

    // init() caches its result, so ask for a fresh build the way a boot would.
    Activity.$init = undefined;
    const failures = await reportIndexProblems([Activity]);

    expect(failures).toHaveLength(1);
    expect(failures[0].model).toBe('Activity');
    expect(failures[0].message).toMatch(/index/i);
  });

  it('shows what a silent failure costs: the unique constraint is simply absent', async () => {
    const activities = mongoose.connection.db.collection('activities');
    await activities.drop().catch(() => {});
    await activities.createIndex({ workspaceId: 1, name: 1 }, { name: 'workspaceId_1_name_1' });

    const indexes = await activities.indexes();
    const ours = indexes.find((index) => index.name === 'workspaceId_1_name_1');

    // Without the report above, this is the state the app runs in believing
    // otherwise — and two activities called "Invoicing" split every trend in half.
    expect(ours.unique).toBeUndefined();
  });
});
