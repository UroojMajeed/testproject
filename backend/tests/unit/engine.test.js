import { describe, it, expect } from 'vitest';
import {
  decideAction, computeConfidence, buildRecommendation, statsForTask, RECOVERY_RATE,
} from '../../src/services/recommendations.engine.js';
import { narrate } from '../../src/services/narrator.js';

const base = (over = {}) => ({
  title: 'Weekly client report',
  category: 'admin',
  quadrant: 'replacement',
  value: 'high',
  valueScore: 2,
  occurrences: 9,
  totalMinutes: 492,
  avgMinutes: 54.7,
  durationStdDev: 6,
  drainingRatio: 0.89,
  hoursPerWeek: 4.1,
  frequency: 'weekly',
  ...over,
});

describe('decideAction', () => {
  it('automates repetitive low-value work with consistent duration', () => {
    const a = decideAction(base({ quadrant: 'delegation', valueScore: 0, durationStdDev: 4 }));
    expect(a.type).toBe('automate');
  });

  it('delegates low-value work whose length varies — that variation is judgement', () => {
    const a = decideAction(base({ quadrant: 'delegation', valueScore: 0, durationStdDev: 40, avgMinutes: 55 }));
    expect(a.type).toBe('delegate');
  });

  it('delegates replacement work rather than deleting it', () => {
    // High value plus draining: transfer the doing, never drop the work.
    expect(decideAction(base({ quadrant: 'replacement' })).type).toBe('delegate');
  });

  it('eliminates recurring low-value meetings', () => {
    const a = decideAction(base({ category: 'meetings', quadrant: 'delegation', valueScore: 0, occurrences: 4 }));
    expect(a.type).toBe('eliminate');
  });

  it('keeps production work', () => {
    const a = decideAction(base({ quadrant: 'production', valueScore: 3, drainingRatio: 0 }));
    expect(a.type).toBe('keep');
  });

  it('keeps investment work even though its value is low', () => {
    const a = decideAction(base({ quadrant: 'investment', valueScore: 0, drainingRatio: 0.1 }));
    expect(a.type).toBe('keep');
  });

  it('never eliminates a high-value meeting', () => {
    const a = decideAction(base({ category: 'meetings', quadrant: 'replacement', valueScore: 3 }));
    expect(a.type).not.toBe('eliminate');
  });
});

describe('computeConfidence', () => {
  it('is higher for a large consistent sample than a small erratic one', () => {
    const strong = computeConfidence(base());
    const weak = computeConfidence(base({ occurrences: 2, drainingRatio: 0.5, durationStdDev: 50, hoursPerWeek: 0.4, frequency: 'ad_hoc' }));
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.level).toBe('high');
    expect(weak.level).toBe('low');
  });

  it('always exposes the signals it was computed from', () => {
    const c = computeConfidence(base());
    expect(c.signals.map((s) => s.name)).toEqual(
      ['sampleSize', 'frequency', 'energyConsistency', 'durationVariance', 'volume'],
    );
    for (const s of c.signals) {
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(1);
      expect(s.weight).toBeGreaterThan(0);
    }
  });

  it('weights sum to one, so the score stays in range', () => {
    const c = computeConfidence(base());
    const total = c.signals.reduce((s, x) => s + x.weight, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(c.score).toBeLessThanOrEqual(1);
  });

  it('treats a 50/50 energy split as no signal at all', () => {
    const c = computeConfidence(base({ drainingRatio: 0.5 }));
    expect(c.signals.find((s) => s.name === 'energyConsistency').value).toBe(0);
  });

  it('rewards consistency in both directions', () => {
    const alwaysDraining = computeConfidence(base({ drainingRatio: 1 }));
    const neverDraining = computeConfidence(base({ drainingRatio: 0 }));
    const consistency = (c) => c.signals.find((s) => s.name === 'energyConsistency').value;
    expect(consistency(alwaysDraining)).toBe(1);
    expect(consistency(neverDraining)).toBe(1);
  });
});

describe('buildRecommendation', () => {
  it('returns null for keep — the queue is for things to act on', () => {
    expect(buildRecommendation(base({ quadrant: 'production', valueScore: 3, drainingRatio: 0 }))).toBeNull();
  });

  it('never claims more hours back than the task costs', () => {
    const rec = buildRecommendation(base());
    expect(rec.estimatedHoursSavedPerWeek).toBeLessThanOrEqual(base().hoursPerWeek);
  });

  it('applies the documented recovery rate for its strategy', () => {
    const rec = buildRecommendation(base());
    expect(rec.estimatedHoursSavedPerWeek)
      .toBeCloseTo(base().hoursPerWeek * RECOVERY_RATE[rec.type], 1);
  });

  it('prices the saving at the workspace buyback rate', () => {
    const rec = buildRecommendation(base(), { buybackRateMinor: 5000 });
    expect(rec.estimatedValueSavedMinor).toBe(Math.round(rec.estimatedHoursSavedPerWeek * 5000));
  });

  it('carries evidence for every claim it makes', () => {
    const rec = buildRecommendation(base());
    expect(rec.evidence.length).toBeGreaterThanOrEqual(4);
    expect(rec.evidence.map((e) => e.signal)).toContain('frequency');
    expect(rec.evidence.map((e) => e.signal)).toContain('energy');
  });

  it('ranks a bigger, more certain opportunity above a smaller one', () => {
    const big = buildRecommendation(base());
    const small = buildRecommendation(base({ hoursPerWeek: 0.5, totalMinutes: 60, occurrences: 3 }));
    expect(big.priorityScore).toBeGreaterThan(small.priorityScore);
  });
});

describe('statsForTask', () => {
  const task = {
    _id: 'x', title: 'Invoicing', category: 'finance',
    drip: { quadrant: 'delegation', energy: 'low', value: 'low' },
    recurrence: { frequency: 'weekly' },
  };

  it('derives the draining ratio from the entries, not from the task', () => {
    const entries = [
      { durationMinutes: 60, energy: 'low' },
      { durationMinutes: 60, energy: 'low' },
      { durationMinutes: 60, energy: 'high' },
      { durationMinutes: 60, energy: 'neutral' },
    ];
    const s = statsForTask(task, entries, 14);
    expect(s.drainingRatio).toBe(0.5);
    expect(s.occurrences).toBe(4);
    expect(s.totalMinutes).toBe(240);
  });

  it('converts a fortnight of minutes into hours per week', () => {
    const entries = Array.from({ length: 4 }, () => ({ durationMinutes: 120, energy: 'low' }));
    // 480 minutes over 14 days = 8 hours over 2 weeks = 4 h/week.
    expect(statsForTask(task, entries, 14).hoursPerWeek).toBeCloseTo(4, 2);
  });

  it('reports zero variance for identical durations', () => {
    const entries = Array.from({ length: 3 }, () => ({ durationMinutes: 45, energy: 'low' }));
    expect(statsForTask(task, entries, 14).durationStdDev).toBe(0);
  });

  it('survives an empty entry list', () => {
    const s = statsForTask(task, [], 14);
    expect(s.occurrences).toBe(0);
    expect(s.drainingRatio).toBe(0);
    expect(Number.isNaN(s.hoursPerWeek)).toBe(false);
  });
});

describe('narrator', () => {
  it('grounds the sentence in the actual numbers', () => {
    const stats = base();
    const rec = buildRecommendation(stats);
    const { title, reason } = narrate(stats, rec, { windowDays: 14 });

    expect(title).toBeTruthy();
    expect(reason).toContain('9');       // the occurrence count
    expect(reason).toContain('89%');     // the draining ratio
    expect(reason).toMatch(/8 hours 12 minutes/);
  });

  it('never promises a guaranteed saving', () => {
    const stats = base();
    const { reason } = narrate(stats, buildRecommendation(stats));
    expect(reason).not.toMatch(/\bwill save\b|\bguarantee/i);
  });
});
