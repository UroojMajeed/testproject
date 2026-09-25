import { Workspace, BuybackRate, AuditWeek, Activity } from '../../models/index.js';
import { weekToAudit } from '../../utils/weeks.js';
import { logger } from '../../config/logger.js';

/**
 * Every user gets a workspace at registration, not lazily on first use.
 *
 * Lazy creation means every request downstream has to cope with there not being
 * one, and one of them eventually forgets. Creating it in the same breath as the
 * account means `req.workspace` is a fact from the first authenticated request.
 */
export async function createForUser(user) {
  const workspace = await Workspace.create({
    // Not "Urooj's Workspace": this is a business tool and the owner knows whose
    // account it is. It is renameable, and until then it says something true.
    name: 'My business',
    ownerId: user._id,
    timezone: user.timezone || 'UTC',
  });

  logger.info({ workspaceId: String(workspace._id), userId: String(user._id) }, 'workspace created');
  return workspace;
}

export async function forOwner(userId) {
  return Workspace.findOne({ ownerId: userId });
}

/**
 * The workspace for an account, creating it if there is not one.
 *
 * Registration makes one, so in the normal case this is the same single findOne
 * that forOwner does. It exists for the accounts that predate step 2: they were
 * created when workspaces did not, and every tenant-scoped route answered 404 for
 * them — a signed-in person, with a real session, told their own workspace does
 * not exist and no way forward but deleting the account.
 *
 * A migration script would fix the accounts that exist today and do nothing for
 * the half-finished registration that fails next month. This handles both, and
 * being idempotent it costs nothing once the row is there.
 */
export async function findOrCreateForOwner(user) {
  const existing = await Workspace.findOne({ ownerId: user._id });
  if (existing) return existing;

  logger.info({ userId: String(user._id) }, 'workspace missing for an existing account — creating it');

  try {
    return await createForUser(user);
  } catch (err) {
    /**
     * Two requests racing on the same account.
     *
     * One page load fires several of these at once, and the check above is not a
     * lock — without the unique index on ownerId and this branch, each request
     * created its own workspace and the account's data ended up split across two,
     * with no error anywhere. The index is the arbiter; the loser reads the row
     * the winner made.
     */
    if (err?.code === 11000) return Workspace.findOne({ ownerId: user._id });
    throw err;
  }
}

/**
 * The one call the client needs in order to know where to send someone.
 *
 * Without it the frontend has to infer onboarding state from the absence of
 * things — no rate means show the rate screen, no audit means show the audit — and
 * that inference ends up duplicated across every route guard and drifting from the
 * server's view. One endpoint, one answer.
 */
export async function stateFor(workspace, userId, now = new Date()) {
  const scope = { workspaceId: workspace._id, userId };

  const [rate, currentAudit, completedCount, unsortedCount, sortedCount] = await Promise.all([
    BuybackRate.findOne(scope).sort({ effectiveFrom: -1 }),
    AuditWeek.findOne({ ...scope, weekStarting: weekToAudit(now, workspace.timezone, workspace.auditDay) }),
    AuditWeek.countDocuments({ ...scope, status: 'complete' }),
    Activity.countDocuments({ workspaceId: workspace._id, value: null, archivedAt: null }),
    Activity.countDocuments({ workspaceId: workspace._id, value: { $ne: null } }),
  ]);

  const weekStarting = weekToAudit(now, workspace.timezone, workspace.auditDay);

  return {
    weekStarting,
    needsRate: !rate,
    // The first audit is the gate: nobody should ever reach an empty dashboard.
    needsFirstAudit: completedCount === 0,
    // After the first one it is a prompt, not a gate — a missed Friday should not
    // lock somebody out of the figures they already have.
    currentWeekFiled: currentAudit?.status === 'complete',
    completedAudits: completedCount,

    /**
     * The first sort is a gate; every one after it is a prompt.
     *
     * Straight after the first audit there is a list of activities and no way to
     * tell Delegate from Replace, so the matrix would be empty on the one visit
     * that decides whether somebody comes back. Once anything is sorted the gate
     * is gone for good — a new activity next Friday must not wall off figures
     * they already have.
     */
    needsFirstSort: completedCount > 0 && sortedCount === 0 && unsortedCount > 0,
    unsortedCount,
  };
}
