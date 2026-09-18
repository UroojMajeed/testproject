import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';
import { ENERGY, VALUE, DRIP, CATEGORIES, PRECISION, ENTRY_SOURCE } from '../config/constants.js';

const timeEntrySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },

    // Denormalised so the timeline renders without a join.
    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, default: null, maxlength: 2000 },

    // UTC midnight of the local day. The bucket key for every rollup.
    date: { type: Date, required: true, index: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    durationMinutes: { type: Number, required: true, min: 0, max: 1440 },

    category: { type: String, enum: CATEGORIES, default: 'other' },
    energy: { type: String, enum: Object.values(ENERGY), default: ENERGY.NEUTRAL },
    value: { type: String, enum: Object.values(VALUE), default: VALUE.MEDIUM },
    dripQuadrant: { type: String, enum: Object.values(DRIP), default: null, index: true },

    source: { type: String, enum: ENTRY_SOURCE, default: 'manual' },
    /**
     * How the number was arrived at. A sorted calendar group is a coarser
     * estimate than a running timer, and analytics must be able to say so
     * rather than treating them as the same measurement.
     */
    precision: { type: String, enum: PRECISION, default: 'timed' },

    externalRef: {
      provider: { type: String, default: null },
      eventId: { type: String, default: null },
    },
    sortGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'SortGroup', default: null },

    status: { type: String, enum: ['draft', 'confirmed', 'ignored'], default: 'confirmed' },

    // Frozen at write time: changing the buyback rate in March must not
    // silently rewrite what February cost.
    estimatedCostMinor: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

timeEntrySchema.plugin(toJSONPlugin);
timeEntrySchema.plugin(softDeletePlugin);

timeEntrySchema.index({ workspaceId: 1, userId: 1, date: -1 });
timeEntrySchema.index({ workspaceId: 1, date: -1, dripQuadrant: 1 });
timeEntrySchema.index({ workspaceId: 1, taskId: 1, date: -1 });
timeEntrySchema.index(
  { workspaceId: 1, 'externalRef.eventId': 1 },
  { unique: true, partialFilterExpression: { 'externalRef.eventId': { $type: 'string' } } },
);

export const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
