import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';

/**
 * Pre-aggregated per user per day. Every dashboard and analytics query reads
 * this; nothing scans timeEntries live. Rebuilt incrementally on write.
 */
const metricsDailySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },

    trackedMinutes: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },

    byQuadrant: {
      delegation: { type: Number, default: 0 },
      replacement: { type: Number, default: 0 },
      investment: { type: Number, default: 0 },
      production: { type: Number, default: 0 },
      unclassified: { type: Number, default: 0 },
    },
    byCategory: { type: Map, of: Number, default: () => new Map() },
    byEnergy: {
      very_low: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      very_high: { type: Number, default: 0 },
    },

    costMinor: {
      delegation: { type: Number, default: 0 },
      replacement: { type: Number, default: 0 },
      investment: { type: Number, default: 0 },
      production: { type: Number, default: 0 },
    },

    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

metricsDailySchema.plugin(toJSONPlugin);
metricsDailySchema.index({ workspaceId: 1, userId: 1, date: -1 }, { unique: true });

export const MetricsDaily = mongoose.model('MetricsDaily', metricsDailySchema);
