import mongoose from 'mongoose';
import { toJSONPlugin, tenantPlugin } from './plugins.js';

/** Drains a lot … lifts a lot. One axis, signed, because two would be noise. */
export const ENERGY_MIN = -2;
export const ENERGY_MAX = 2;

/**
 * One activity's share of one week.
 *
 * `estimatedMinutes` is named for what it is. This is recall, not measurement —
 * somebody remembering last Tuesday — and when measured data arrives it must be
 * impossible to confuse the two. Whole minutes, never floats.
 */
const entrySchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 168 * 60,
      validate: { validator: Number.isInteger, message: 'Durations are whole minutes' },
    },
    energy: {
      type: Number,
      required: true,
      min: ENERGY_MIN,
      max: ENERGY_MAX,
      validate: { validator: Number.isInteger, message: 'Energy is a whole step from -2 to 2' },
    },
    note: { type: String, trim: true, maxlength: 280, default: null },
  },
  { _id: false },
);

/**
 * One week, recalled.
 *
 * Entries are subdocuments rather than their own collection: a week is read and
 * written whole, there are a dozen of them, and keeping them together means a week
 * is saved atomically instead of half-updated.
 */
const auditWeekSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /**
     * The Monday of the week covered, as YYYY-MM-DD.
     *
     * A string, deliberately. A Date is an instant, and "which week is this" is a
     * question about somebody's calendar, not about an instant — store one and a
     * user in Karachi filing on Friday evening lands in the previous week for a
     * server in UTC. The string is computed once, in the workspace timezone, and
     * then it cannot drift.
     */
    weekStarting: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'weekStarting must be YYYY-MM-DD'],
    },

    // The timezone the boundary was drawn in, kept so a later move does not silently
    // re-cut the history.
    timezone: { type: String, required: true, maxlength: 64 },

    status: { type: String, enum: ['draft', 'complete'], default: 'draft', index: true },
    completedAt: { type: Date, default: null },

    /**
     * Holidays, launches, the week everything caught fire.
     *
     * A baseline built from one strange week makes every later comparison wrong, so
     * the owner can say so and the figures can exclude it.
     */
    isTypical: { type: Boolean, default: true },

    entries: { type: [entrySchema], default: [] },
  },
  { timestamps: true },
);

auditWeekSchema.plugin(tenantPlugin);
auditWeekSchema.plugin(toJSONPlugin);

// One audit per person per week, and the index that enforces it is also the one
// that answers "have they filed this week yet".
auditWeekSchema.index({ workspaceId: 1, userId: 1, weekStarting: 1 }, { unique: true });

auditWeekSchema.virtual('totalMinutes').get(function totalMinutes() {
  return this.entries.reduce((sum, entry) => sum + entry.estimatedMinutes, 0);
});

export const AuditWeek = mongoose.model('AuditWeek', auditWeekSchema);
