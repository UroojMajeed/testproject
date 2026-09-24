import { describe, it, expect } from 'vitest';
import { api, BASE, signedInUser, RATE_INPUT } from '../helpers.js';
import { Workspace } from '../../src/models/index.js';

const WS = `${BASE}/workspace`;

/**
 * Accounts that predate step 2 have no workspace, because workspaces did not exist
 * when they registered. Before this, every tenant-scoped route answered 404 for
 * them: signed in, with a valid session, told their own workspace did not exist
 * and offered no way forward but deleting the account.
 *
 * Deleting the row is how that state is reproduced — it is exactly what those
 * accounts look like.
 */
async function accountWithoutWorkspace() {
  const session = await signedInUser();
  await Workspace.deleteMany({ ownerId: session.res.body.data.user.id });
  expect(await Workspace.countDocuments({})).toBe(0);
  return session;
}

describe('an account that predates workspaces', () => {
  it('is given one on its next request rather than a 404', async () => {
    const session = await accountWithoutWorkspace();

    const res = await api().get(`${WS}/state`).set(session.auth());

    expect(res.status).toBe(200);
    expect(res.body.data.needsRate).toBe(true);
    expect(await Workspace.countDocuments({})).toBe(1);
  });

  it('can set a rate straight away', async () => {
    const session = await accountWithoutWorkspace();

    const res = await api().put(`${WS}/rate`).set(session.auth()).send(RATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.data.rate.rateMinorPerHour).toBe(1_500);
  });

  it('makes exactly one, however many requests arrive', async () => {
    const session = await accountWithoutWorkspace();

    await Promise.all([
      api().get(`${WS}/state`).set(session.auth()),
      api().get(WS).set(session.auth()),
      api().get(`${WS}/activities`).set(session.auth()),
    ]);

    // A page load fires several of these at once; duplicates would split the
    // account's data across two workspaces and lose half of it.
    expect(await Workspace.countDocuments({})).toBe(1);
  });

  it('does not make a second one for an account that already has one', async () => {
    const session = await signedInUser();

    await api().get(`${WS}/state`).set(session.auth());
    await api().get(`${WS}/state`).set(session.auth());

    expect(await Workspace.countDocuments({})).toBe(1);
  });
});
