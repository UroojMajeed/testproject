import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';

/**
 * One row per issued refresh token. Rotation means each use mints a new row and
 * revokes the old one; `family` links a chain, so replaying a revoked token can
 * revoke every descendant at once.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    family: { type: String, required: true, index: true },

    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },

    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedByHash: { type: String, default: null, private: true },
  },
  { timestamps: true },
);

refreshTokenSchema.plugin(toJSONPlugin);

// Mongo reaps expired rows on its own; revocation is still checked on read.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
