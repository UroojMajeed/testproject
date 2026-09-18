import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';
import { ACTIONS, REC_STATUS, CONFIDENCE } from '../config/constants.js';

const recommendationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },

    type: { type: String, enum: ACTIONS, required: true },
    title: { type: String, required: true, maxlength: 240 },
    reason: { type: String, required: true, maxlength: 2000 },

    /** The facts the reason is grounded in. Rendered as chips in the Why panel. */
    evidence: {
      type: [{
        signal: String,     // frequency | duration | energy | repetition | value | capacity | variance
        label: String,
        value: mongoose.Schema.Types.Mixed,
      }],
      default: [],
    },

    estimatedHoursSavedPerWeek: { type: Number, default: 0, min: 0 },
    estimatedValueSavedMinor: { type: Number, default: 0, min: 0 },
    implementationEffortMinutes: { type: Number, default: 0, min: 0 },

    /**
     * Computed server-side from the signals below. The narrator never gets to
     * assert its own confidence number.
     */
    confidence: {
      level: { type: String, enum: CONFIDENCE, default: 'low' },
      score: { type: Number, default: 0, min: 0, max: 1 },
      signals: {
        type: [{ name: String, weight: Number, value: Number, detail: String }],
        default: [],
      },
    },

    // Orders the queue internally. Deliberately never rendered to the user as a
    // score of their work.
    priorityScore: { type: Number, default: 0, index: true },

    status: { type: String, enum: REC_STATUS, default: 'pending', index: true },
    snoozedUntil: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 500 },

    buybackPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuybackPlan', default: null },
  },
  { timestamps: true },
);

recommendationSchema.plugin(toJSONPlugin);
recommendationSchema.index({ workspaceId: 1, status: 1, priorityScore: -1 });

export const Recommendation = mongoose.model('Recommendation', recommendationSchema);

/** One row per analysis run, so every recommendation traces back to its inputs. */
const analysisSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'buyback_recommendations' },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    inputSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    engineVersion: { type: String, required: true },
    narrator: { type: String, default: 'template' },

    candidateCount: { type: Number, default: 0 },
    producedCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

analysisSchema.plugin(toJSONPlugin);
analysisSchema.index({ workspaceId: 1, createdAt: -1 });

export const Analysis = mongoose.model('Analysis', analysisSchema);
