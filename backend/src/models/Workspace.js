import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';

/**
 * One workspace, one owner — today.
 *
 * It exists now, while every workspace has exactly one member, because the
 * alternative is a data migration and an audit of every query later. Delegation is
 * the point of this product, so other people are coming; `workspaceId` on
 * everything from the first row is the cheap version of that.
 */
const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Unique, not merely indexed. One workspace per owner is the rule today, and
    // without the constraint two requests arriving together can each create one —
    // which splits the account's data in half, silently.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true,
    },

    // The week rolls over on this day in the owner's timezone. Friday by default
    // because that is when a week is fresh enough to recall and finished enough to
    // count — but plenty of people do not work Friday, so it is a setting.
    auditDay: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: 'friday',
    },

    // Kept on the workspace, not read from the user each time: an audit belongs to
    // the week it covered, and that week was bounded by the timezone in force then.
    timezone: { type: String, default: 'UTC', maxlength: 64 },

    currency: { type: String, default: 'USD', minlength: 3, maxlength: 3, uppercase: true },
  },
  { timestamps: true },
);

workspaceSchema.plugin(toJSONPlugin);
workspaceSchema.plugin(softDeletePlugin);

export const Workspace = mongoose.model('Workspace', workspaceSchema);
