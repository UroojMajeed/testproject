import mongoose from 'mongoose';
import { toJSONPlugin, tenantPlugin, softDeletePlugin } from './plugins.js';

/**
 * A repeating thing the owner does.
 *
 * Persistent, and that is the whole point. If each Friday's audit held freshly
 * typed strings there would be no way to say "invoicing took four hours last week
 * and one this week" — twelve unrelated labels a week and no trend, ever. Weekly
 * entries reference these, which is also what lets next week's form arrive
 * pre-filled and take two minutes instead of ten.
 */
const activitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },

    // Retired rather than deleted: past audits still reference it, and a week's
    // history should not change because something stopped happening.
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

activitySchema.plugin(tenantPlugin);
activitySchema.plugin(toJSONPlugin);
activitySchema.plugin(softDeletePlugin);

// Two activities called "Invoicing" in one workspace would split every trend in
// half. Case-insensitive, because "invoicing" and "Invoicing" are the same thing.
activitySchema.index(
  { workspaceId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 }, partialFilterExpression: { deletedAt: null } },
);

export const Activity = mongoose.model('Activity', activitySchema);
