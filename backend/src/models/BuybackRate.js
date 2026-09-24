import mongoose from 'mongoose';
import { toJSONPlugin, tenantPlugin } from './plugins.js';

/** Bumped when the arithmetic changes, so old rows stay readable as what they were. */
export const RATE_FORMULA_VERSION = 1;

/**
 * What an hour of the owner's time is worth, for planning.
 *
 * Dated records, never an updatable field. If someone's income changes in March,
 * the figure June was shown must not silently become a different number — so a new
 * rate is a new row, and anything derived from a rate stamps the value it used.
 *
 * The inputs are stored alongside the result on purpose. A bare number cannot be
 * re-checked, re-explained, or recomputed when the formula is corrected.
 */
const buybackRateSchema = new mongoose.Schema(
  {
    // Whose rate. A second person in the workspace has their own, which is why
    // this is here rather than implied by the workspace.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // ── The inputs ──────────────────────────────────────────────────────────
    annualIncomeMinor: { type: Number, required: true, min: 0 },  // integer minor units
    currency: { type: String, required: true, minlength: 3, maxlength: 3, uppercase: true },
    hoursPerWeek: { type: Number, required: true, min: 1, max: 168 },
    weeksPerYear: { type: Number, required: true, min: 1, max: 52 },

    // ── The result ──────────────────────────────────────────────────────────
    // Stored, not derived on read: see the note above about June.
    rateMinorPerHour: { type: Number, required: true, min: 0 },
    formulaVersion: { type: Number, required: true, default: RATE_FORMULA_VERSION },

    effectiveFrom: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true },
);

buybackRateSchema.plugin(tenantPlugin);
buybackRateSchema.plugin(toJSONPlugin);

// "the rate in force for this person" is the only query this collection serves.
buybackRateSchema.index({ workspaceId: 1, userId: 1, effectiveFrom: -1 });

export const BuybackRate = mongoose.model('BuybackRate', buybackRateSchema);
