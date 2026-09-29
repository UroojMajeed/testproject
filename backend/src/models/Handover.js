import mongoose from 'mongoose';
import { toJSONPlugin, tenantPlugin } from './plugins.js';
import { STEP_KEYS } from '../modules/handovers/handover.steps.js';

export const HANDOVER_STATUSES = Object.freeze(['planned', 'in_progress', 'done']);

const stepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: [...STEP_KEYS] },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * One activity, on its way out of the owner's week.
 *
 * Separate from the activity itself because it is a different kind of fact. An
 * activity is a thing that happens; a handover is a decision to stop doing it,
 * with a date and a person attached. Archiving the activity later must not take
 * the record of how it was handed over with it.
 *
 * The cost figures are stamped, not looked up. What this was costing when the
 * decision was made is the number that justified the decision, and re-deriving it
 * from today's rate would quietly rewrite the reason months later.
 */
const handoverSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },

    status: { type: String, enum: HANDOVER_STATUSES, default: 'planned' },
    // A name typed by the owner, not a user in the system. Nobody is inviting
    // their bookkeeper to create an account to be handed a task.
    assignee: { type: String, trim: true, maxlength: 120, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },

    steps: { type: [stepSchema], default: undefined },

    /** What it cost when the decision was taken. See the note above. */
    estimatedMinutesPerWeek: { type: Number, required: true, min: 0 },
    estimatedAnnualCostMinor: { type: Number, required: true, min: 0 },
    rateMinorPerHour: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, maxlength: 3 },
    quadrant: { type: String, default: null },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

handoverSchema.plugin(tenantPlugin);
handoverSchema.plugin(toJSONPlugin);

// One live handover per activity. Two would mean two checklists for one job and
// no answer to "is this handed over yet".
handoverSchema.index({ workspaceId: 1, activityId: 1 }, { unique: true });

export const Handover = mongoose.model('Handover', handoverSchema);
