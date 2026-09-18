import mongoose from 'mongoose';
import { toJSONPlugin, softDeletePlugin } from './plugins.js';

const INDUSTRIES = ['software', 'agency', 'ecommerce', 'education', 'consulting',
  'healthcare', 'realestate', 'other'];

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    industry: { type: String, enum: INDUSTRIES, default: 'other' },
    teamSize: { type: String, default: null },
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD', uppercase: true, minlength: 3, maxlength: 3 },

    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      days: { type: [Number], default: [1, 2, 3, 4, 5] },
    },

    buybackRate: {
      // Integer minor units. 5000 === $50.00/hour. Never a float.
      amountMinor: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', uppercase: true },
      method: { type: String, enum: ['calculated', 'manual'], default: 'calculated' },
      annualCompensationMinor: { type: Number, default: 0, min: 0 },
      annualHours: { type: Number, default: 2000, min: 1 },
      overrideReason: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },

    weeklyBuybackGoalHours: { type: Number, default: 0, min: 0, max: 168 },
    currentWeeklyHours: { type: Number, default: 0, min: 0, max: 168 },
    targetWeeklyHours: { type: Number, default: 0, min: 0, max: 168 },

    onboarding: {
      step: { type: Number, default: 1, min: 1 },
      completedAt: { type: Date, default: null },
      skipped: { type: [String], default: [] },
    },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

workspaceSchema.plugin(toJSONPlugin);
workspaceSchema.plugin(softDeletePlugin);

/** Buyback rate is derived in exactly one place on the server. */
workspaceSchema.methods.recalculateBuybackRate = function recalculateBuybackRate() {
  const { annualCompensationMinor, annualHours, method } = this.buybackRate;
  if (method === 'calculated' && annualHours > 0) {
    this.buybackRate.amountMinor = Math.round(annualCompensationMinor / annualHours);
  }
  this.buybackRate.updatedAt = new Date();
  return this.buybackRate.amountMinor;
};

export const Workspace = mongoose.model('Workspace', workspaceSchema);
export { INDUSTRIES };
