import crypto from 'node:crypto';
import { Workspace, Membership, User } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES, MEMBERSHIP_STATUS } from '../../config/constants.js';
import { randomToken, hashToken } from '../../utils/crypto.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(name) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 48) || 'workspace';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function createWorkspace(userId, dto) {
  const workspace = await Workspace.create({
    ...dto,
    slug: slugify(dto.name),
    ownerId: userId,
    createdBy: userId,
    buybackRate: { currency: dto.currency ?? 'USD' },
  });

  await Membership.create({
    workspaceId: workspace._id,
    userId,
    role: ROLES.OWNER,
    status: MEMBERSHIP_STATUS.ACTIVE,
    joinedAt: new Date(),
  });

  await User.updateOne(
    { _id: userId, defaultWorkspaceId: null },
    { defaultWorkspaceId: workspace._id },
  );

  return workspace;
}

export async function listForUser(userId) {
  const memberships = await Membership.find({ userId, status: MEMBERSHIP_STATUS.ACTIVE })
    .populate('workspaceId')
    .lean();
  return memberships
    .filter((m) => m.workspaceId)
    .map((m) => ({ workspace: m.workspaceId, role: m.role }));
}

export async function updateWorkspace(workspace, dto) {
  Object.assign(workspace, dto);
  await workspace.save();
  return workspace;
}

export async function updateBuybackRate(workspace, dto) {
  workspace.buybackRate.annualCompensationMinor = dto.annualCompensationMinor;
  workspace.buybackRate.annualHours = dto.annualHours;
  workspace.buybackRate.method = dto.method;
  workspace.buybackRate.overrideReason = dto.overrideReason ?? null;

  if (dto.method === 'manual') {
    workspace.buybackRate.amountMinor = dto.amountMinor;
    workspace.buybackRate.updatedAt = new Date();
  } else {
    workspace.recalculateBuybackRate();
  }

  await workspace.save();
  return workspace;
}

export async function updateOnboarding(workspace, { step, completed, skipped }) {
  if (typeof step === 'number') workspace.onboarding.step = step;
  if (skipped) workspace.onboarding.skipped = skipped;
  if (completed) workspace.onboarding.completedAt = new Date();
  await workspace.save();
  return workspace;
}

export async function listMembers(workspaceId) {
  const members = await Membership.find({
    workspaceId,
    status: { $in: [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.INVITED] },
  })
    .populate('userId', 'name email avatarUrl')
    .sort({ createdAt: 1 });
  return members;
}

export async function inviteMember(workspaceId, invitedBy, { email, role }) {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const already = await Membership.findOne({ workspaceId, userId: existingUser._id });
    if (already && already.status === MEMBERSHIP_STATUS.ACTIVE) {
      throw ApiError.conflict('That person is already in this workspace');
    }
  }

  const pending = await Membership.findOne({
    workspaceId,
    invitedEmail: email,
    status: MEMBERSHIP_STATUS.INVITED,
  });
  if (pending) throw ApiError.conflict('An invitation is already outstanding for that address');

  const token = randomToken(32);
  const membership = await Membership.create({
    workspaceId,
    userId: null,
    role,
    status: MEMBERSHIP_STATUS.INVITED,
    invitedEmail: email,
    invitedBy,
    inviteTokenHash: hashToken(token),
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  return { membership, token };
}

export async function acceptInvite(token, userId, userEmail) {
  const membership = await Membership.findOne({
    inviteTokenHash: hashToken(token),
    status: MEMBERSHIP_STATUS.INVITED,
    inviteExpiresAt: { $gt: new Date() },
  }).select('+inviteTokenHash');

  if (!membership) throw ApiError.badRequest('That invitation is invalid or has expired');
  if (membership.invitedEmail !== userEmail) {
    throw ApiError.forbidden('This invitation was sent to a different address');
  }

  membership.userId = userId;
  membership.status = MEMBERSHIP_STATUS.ACTIVE;
  membership.joinedAt = new Date();
  membership.inviteTokenHash = null;
  membership.inviteExpiresAt = null;
  await membership.save();

  return membership;
}
