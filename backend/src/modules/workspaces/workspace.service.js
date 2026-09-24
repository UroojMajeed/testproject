import { Workspace, BuybackRate, AuditWeek } from '../../models/index.js';
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
 * The one call the client needs in order to know where to send someone.
 *
 * Without it the frontend has to infer onboarding state from the absence of
 * things — no rate means show the rate screen, no audit means show the audit — and
 * that inference ends up duplicated across every route guard and drifting from the
 * server's view. One endpoint, one answer.
 */
export async function stateFor(workspace, userId, now = new Date()) {
  const scope = { workspaceId: workspace._id, userId };

  const [rate, currentAudit, completedCount] = await Promise.all([
    BuybackRate.findOne(scope).sort({ effectiveFrom: -1 }),
    AuditWeek.findOne({ ...scope, weekStarting: weekToAudit(now, workspace.timezone, workspace.auditDay) }),
    AuditWeek.countDocuments({ ...scope, status: 'complete' }),
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
  };
}
