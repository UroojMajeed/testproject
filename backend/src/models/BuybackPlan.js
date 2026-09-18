import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins.js';
import { ACTIONS, PLAN_STATUS, CONFIDENCE } from '../config/constants.js';

const buybackPlanSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    recommendationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recommendation', default: null },

    title: { type: String, required: true, maxlength: 240 },
    strategy: { type: String, enum: ACTIONS, required: true },

    currentOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    newOwner: {
      type: { type: String, enum: ['user', 'external', 'automation', 'none'], default: 'none' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      externalName: { type: String, default: null },
    },

    successCriteria: {
      definitionOfDone: { type: String, default: null, maxlength: 2000 },
      qualityChecks: { type: [String], default: [] },
      approvalRequired: { type: Boolean, default: true },
      deadline: { type: Date, default: null },
    },

    /**
     * Captured at approval, before anything moves. A plan cannot leave `draft`
     * without it, because a baseline measured afterwards measures nothing.
     */
    estimate: {
      hoursSavedPerWeek: { type: Number, default: 0 },
      baselineMinutesPerWeek: { type: Number, default: 0 },
      baselineWindow: { start: { type: Date, default: null }, end: { type: Date, default: null } },
      baselineEntryCount: { type: Number, default: 0 },
      implementationEffortMinutes: { type: Number, default: 0 },
      frozenAt: { type: Date, default: null },
    },

    verification: {
      method: { type: String, enum: ['time_entry_delta', 'manual'], default: 'time_entry_delta' },
      measuredWindow: { start: { type: Date, default: null }, end: { type: Date, default: null } },
      currentMinutesPerWeek: { type: Number, default: 0 },
      hoursSavedPerWeek: { type: Number, default: 0 },
      confidence: { type: String, enum: CONFIDENCE, default: 'low' },
      sampleWeeks: { type: Number, default: 0 },
      measuredAt: { type: Date, default: null },

      /**
       * The verification-decay guard. If the owner stopped logging during the
       * measurement window, a missing log would otherwise read as zero and
       * OVERSTATE the saving — the exact failure this product exists to avoid.
       */
      coverage: {
        expectedLogDays: { type: Number, default: 0 },
        actualLogDays: { type: Number, default: 0 },
        ratio: { type: Number, default: 0, min: 0, max: 1 },
      },
    },

    playbookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playbook', default: null },

    status: { type: String, enum: PLAN_STATUS, default: 'draft', index: true },
    targetDate: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

buybackPlanSchema.plugin(toJSONPlugin);
buybackPlanSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

/** Enforces the baseline rule at the schema level, not just in the service. */
buybackPlanSchema.pre('save', function guardBaseline(next) {
  const leavingDraft = this.status !== 'draft';
  if (leavingDraft && !this.estimate?.frozenAt) {
    return next(new Error('A buyback plan cannot leave draft without a frozen baseline'));
  }
  return next();
});

export const BuybackPlan = mongoose.model('BuybackPlan', buybackPlanSchema);
