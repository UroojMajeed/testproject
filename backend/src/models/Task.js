import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';
import {
  ENERGY, VALUE, DRIP, CATEGORIES, TASK_STATUS, PRIORITY, FREQUENCY,
} from '../config/constants.js';

const taskSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 4000 },

    status: { type: String, enum: TASK_STATUS, default: 'inbox', index: true },
    priority: { type: String, enum: PRIORITY, default: 'medium' },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    category: { type: String, enum: CATEGORIES, default: 'other' },

    estimatedMinutes: { type: Number, default: 0, min: 0 },
    // Rollup from timeEntries. Denormalised so the list never aggregates.
    actualMinutes: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, default: null },

    drip: {
      energy: { type: String, enum: Object.values(ENERGY), default: null },
      value: { type: String, enum: Object.values(VALUE), default: null },
      quadrant: { type: String, enum: Object.values(DRIP), default: null, index: true },
      // A human move always beats the engine's guess.
      source: { type: String, enum: ['user', 'derived', 'engine'], default: 'derived' },
      classifiedAt: { type: Date, default: null },
    },

    recurrence: {
      isRecurring: { type: Boolean, default: false, index: true },
      frequency: { type: String, enum: FREQUENCY, default: 'irregular' },
      occurrences: { type: Number, default: 0 },
      avgMinutesPerOccurrence: { type: Number, default: 0 },
      // Population standard deviation of occurrence length, in minutes.
      durationStdDev: { type: Number, default: 0 },
      firstSeenAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
    },

    /**
     * Normalised hash of the title. This is how "weekly report" entered nine
     * different ways collapses into one recurring task, and it is what the
     * whole recommendation engine keys on.
     */
    fingerprint: { type: String, default: null, index: true },

    buybackCandidate: { type: Boolean, default: false },
    playbookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playbook', default: null },
    buybackPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuybackPlan', default: null },

    // How many times the founder had to step back in. The signal that a
    // transfer has not actually completed, whatever the status says.
    interventionCount: { type: Number, default: 0, min: 0 },

    tags: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.plugin(toJSONPlugin);
taskSchema.plugin(softDeletePlugin);

taskSchema.index({ workspaceId: 1, fingerprint: 1 });
taskSchema.index({ workspaceId: 1, status: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, ownerId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, title: 'text', description: 'text' });

export const Task = mongoose.model('Task', taskSchema);
