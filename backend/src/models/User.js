import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';
import { USER_STATUS } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },

    // `select: false` keeps it out of every query that does not explicitly ask.
    passwordHash: { type: String, required: true, select: false, private: true },

    avatarUrl: { type: String, default: null },
    timezone: { type: String, default: 'UTC' },

    emailVerifiedAt: { type: Date, default: null },
    emailVerifyTokenHash: { type: String, default: null, select: false, private: true },
    emailVerifyExpiresAt: { type: Date, default: null, select: false, private: true },

    passwordResetTokenHash: { type: String, default: null, select: false, private: true },
    passwordResetExpiresAt: { type: Date, default: null, select: false, private: true },
    passwordChangedAt: { type: Date, default: null },

    // Bumping this invalidates every outstanding access token for this user.
    tokenVersion: { type: Number, default: 0 },

    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },

    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.plugin(toJSONPlugin);
userSchema.plugin(softDeletePlugin);

userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });
userSchema.index({ emailVerifyTokenHash: 1 }, { sparse: true });

userSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil > new Date());
});

export const User = mongoose.model('User', userSchema);
