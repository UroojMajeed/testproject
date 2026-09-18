import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';
import { ROLE_VALUES, MEMBERSHIP_STATUS } from '../config/constants.js';

const membershipSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    // Null until an invited person accepts.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    role: { type: String, enum: ROLE_VALUES, required: true },
    status: { type: String, enum: Object.values(MEMBERSHIP_STATUS), default: MEMBERSHIP_STATUS.ACTIVE },

    invitedEmail: { type: String, lowercase: true, trim: true, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    inviteTokenHash: { type: String, default: null, select: false, private: true },
    inviteExpiresAt: { type: Date, default: null },

    joinedAt: { type: Date, default: null },
    weeklyCapacityHours: { type: Number, default: 40, min: 0, max: 168 },
  },
  { timestamps: true },
);

membershipSchema.plugin(toJSONPlugin);

// One membership per user per workspace. Partial so pending invites (userId null)
// do not collide with each other.
membershipSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
membershipSchema.index({ workspaceId: 1, status: 1 });
membershipSchema.index({ inviteTokenHash: 1 }, { sparse: true });

export const Membership = mongoose.model('Membership', membershipSchema);
