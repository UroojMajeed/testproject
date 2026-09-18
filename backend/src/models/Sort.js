import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';
import { ENERGY, VALUE, DRIP, CATEGORIES, FREQUENCY } from '../config/constants.js';

/**
 * One sitting of "where did last week go". durationSeconds is the activation
 * metric the whole entry-path redesign exists to move.
 */
const sortSessionSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    source: { type: String, enum: ['calendar', 'recall'], default: 'recall' },

    eventCount: { type: Number, default: 0 },
    groupCount: { type: Number, default: 0 },
    classifiedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },

    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
  },
  { timestamps: true },
);

sortSessionSchema.plugin(toJSONPlugin);
sortSessionSchema.index({ workspaceId: 1, userId: 1, startedAt: -1 });

/** One row per activity group presented during a sort. */
const sortGroupSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SortSession', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    fingerprint: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    category: { type: String, enum: CATEGORIES, default: 'other' },

    occurrences: {
      type: [{
        label: String,
        startAt: Date,
        durationMinutes: Number,
        externalId: { type: String, default: null },
      }],
      default: [],
    },
    eventCount: { type: Number, default: 0 },
    totalMinutes: { type: Number, default: 0 },
    frequency: { type: String, enum: FREQUENCY, default: 'irregular' },

    energy: { type: String, enum: Object.values(ENERGY), default: null },
    value: { type: String, enum: Object.values(VALUE), default: null },
    dripQuadrant: { type: String, enum: Object.values(DRIP), default: null },

    order: { type: Number, default: 0 },
    decidedAt: { type: Date, default: null },
    skipped: { type: Boolean, default: false },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  { timestamps: true },
);

sortGroupSchema.plugin(toJSONPlugin);
sortGroupSchema.index({ workspaceId: 1, sessionId: 1, order: 1 });

export const SortSession = mongoose.model('SortSession', sortSessionSchema);
export const SortGroup = mongoose.model('SortGroup', sortGroupSchema);
