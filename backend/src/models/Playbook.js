import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';
import { FREQUENCY, CATEGORIES } from '../config/constants.js';

/** Steps are EMBEDDED: bounded, always read with the parent, edited as a unit. */
const stepSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, maxlength: 200 },
    instructions: { type: String, default: '', maxlength: 5000 },
    assignedRole: { type: String, default: null, maxlength: 80 },
    estimatedMinutes: { type: Number, default: 0, min: 0 },
    requiredInput: { type: String, default: null, maxlength: 500 },
    expectedOutput: { type: String, default: null, maxlength: 500 },
    approvalRequired: { type: Boolean, default: false },
  },
  { _id: true },
);

const playbookSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 2000 },
    purpose: { type: String, default: null, maxlength: 1000 },
    trigger: { type: String, default: null, maxlength: 500 },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    backupOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    frequency: { type: String, enum: FREQUENCY, default: 'weekly' },
    category: { type: String, enum: CATEGORIES, default: 'other' },
    requiredTools: { type: [String], default: [] },

    steps: { type: [stepSchema], default: [] },
    qualityChecklist: { type: [{ item: String, required: { type: Boolean, default: true } }], default: [] },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    version: { type: Number, default: 1, min: 1 },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Drives the "not updated in 60 days" nudge.
    reviewDueAt: { type: Date, default: null },

    generated: { type: Boolean, default: false },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

    stats: {
      runCount: { type: Number, default: 0 },
      avgDurationMinutes: { type: Number, default: 0 },
      avgQualityScore: { type: Number, default: 0 },
      lastRunAt: { type: Date, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

playbookSchema.plugin(toJSONPlugin);
playbookSchema.plugin(softDeletePlugin);
playbookSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
playbookSchema.index({ workspaceId: 1, name: 'text' });

playbookSchema.virtual('estimatedMinutes').get(function total() {
  return (this.steps ?? []).reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
});

export const Playbook = mongoose.model('Playbook', playbookSchema);

/** Runs are unbounded and high-write, so they live in their own collection. */
const playbookRunSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    playbookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playbook', required: true, index: true },
    playbookVersion: { type: Number, required: true },

    executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },

    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
    stepResults: {
      type: [{
        stepId: mongoose.Schema.Types.ObjectId,
        done: { type: Boolean, default: false },
        notes: { type: String, default: null, maxlength: 1000 },
        completedAt: { type: Date, default: null },
      }],
      default: [],
    },

    qualityScore: { type: Number, default: null, min: 1, max: 5 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNotes: { type: String, default: null, maxlength: 1000 },
    interventionCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

playbookRunSchema.plugin(toJSONPlugin);
playbookRunSchema.index({ workspaceId: 1, playbookId: 1, startedAt: -1 });

export const PlaybookRun = mongoose.model('PlaybookRun', playbookRunSchema);
