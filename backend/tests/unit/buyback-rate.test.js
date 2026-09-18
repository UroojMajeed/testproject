import { describe, it, expect } from 'vitest';
import { Workspace } from '../../src/models/Workspace.js';

/** A model can be instantiated without a database connection. */
const ws = (over = {}) =>
  new Workspace({
    name: 'Meridian', slug: 'meridian-aaa111',
    ownerId: '507f1f77bcf86cd799439011', createdBy: '507f1f77bcf86cd799439011',
    buybackRate: { method: 'calculated', ...over },
  });

describe('buyback rate', () => {
  it('is annual compensation divided by annual hours, in minor units', () => {
    // $400,000.00 over 8,000 hours = $50.00/hour.
    const w = ws({ annualCompensationMinor: 40_000_000, annualHours: 8000 });
    expect(w.recalculateBuybackRate()).toBe(5000);
  });

  it('matches the book\'s 2,000 × 4 shorthand', () => {
    // compensation ÷ 2000 ÷ 4 is the same as compensation ÷ 8000.
    const comp = 40_000_000;
    const w = ws({ annualCompensationMinor: comp, annualHours: 2000 * 4 });
    expect(w.recalculateBuybackRate()).toBe(Math.round(comp / 2000 / 4));
  });

  it('rounds to a whole minor unit rather than carrying a float', () => {
    const w = ws({ annualCompensationMinor: 10_000_001, annualHours: 3 });
    const rate = w.recalculateBuybackRate();
    expect(Number.isInteger(rate)).toBe(true);
  });

  it('leaves a manual rate untouched', () => {
    const w = ws({ method: 'manual', amountMinor: 9000, annualCompensationMinor: 40_000_000, annualHours: 8000 });
    w.recalculateBuybackRate();
    expect(w.buybackRate.amountMinor).toBe(9000);
  });

  it('stamps updatedAt whenever it runs', () => {
    const w = ws({ annualCompensationMinor: 1000, annualHours: 10 });
    expect(w.buybackRate.updatedAt).toBeNull();
    w.recalculateBuybackRate();
    expect(w.buybackRate.updatedAt).toBeInstanceOf(Date);
  });

  it('does not divide by zero', () => {
    const w = ws({ annualCompensationMinor: 40_000_000, annualHours: 0 });
    expect(() => w.recalculateBuybackRate()).not.toThrow();
    expect(Number.isFinite(w.buybackRate.amountMinor)).toBe(true);
  });
});
