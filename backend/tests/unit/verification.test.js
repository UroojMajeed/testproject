import { describe, it, expect } from 'vitest';
import { computeVerification } from '../../src/modules/plans/plan.service.js';

const measured = (over = {}) => ({
  minutesPerWeek: 36, weeks: 3, days: 21, logDays: 13, entryCount: 9, totalMinutes: 108, ...over,
});

describe('computeVerification', () => {
  it('reports the difference between the frozen baseline and the current week', () => {
    const v = computeVerification({ baselineMinutesPerWeek: 246, measured: measured() });
    // 246 − 36 = 210 minutes = 3.5 hours a week.
    expect(v.hoursSavedPerWeek).toBe(3.5);
  });

  it('never reports a negative saving when the work got worse', () => {
    const v = computeVerification({ baselineMinutesPerWeek: 60, measured: measured({ minutesPerWeek: 180 }) });
    expect(v.hoursSavedPerWeek).toBe(0);
  });

  it('caps confidence at low when the owner stopped logging', () => {
    // 21 days is 15 working days; logging on 4 of them is 27% coverage. The
    // apparent saving is large precisely BECAUSE the entries are missing.
    const v = computeVerification({
      baselineMinutesPerWeek: 246,
      measured: measured({ minutesPerWeek: 0, logDays: 4 }),
    });
    expect(v.coverage.ratio).toBeLessThan(0.6);
    expect(v.confidence).toBe('low');
    expect(v.trustworthy).toBe(false);
  });

  it('will not call a one-week sample trustworthy however good the coverage', () => {
    const v = computeVerification({
      baselineMinutesPerWeek: 246,
      measured: measured({ weeks: 1, days: 7, logDays: 5 }),
    });
    expect(v.coverage.ratio).toBe(1);
    expect(v.confidence).toBe('low');
  });

  it('reaches medium with two weeks and adequate coverage', () => {
    const v = computeVerification({
      baselineMinutesPerWeek: 246,
      measured: measured({ weeks: 2, days: 14, logDays: 7 }),
    });
    expect(v.confidence).toBe('medium');
    expect(v.trustworthy).toBe(true);
  });

  it('reaches high only with three weeks and strong coverage', () => {
    const v = computeVerification({
      baselineMinutesPerWeek: 246,
      measured: measured({ weeks: 3, days: 21, logDays: 14 }),
    });
    expect(v.confidence).toBe('high');
  });

  it('reports coverage as a fraction of working days, not calendar days', () => {
    // 21 calendar days is about 15 working days.
    const v = computeVerification({ baselineMinutesPerWeek: 100, measured: measured({ logDays: 15 }) });
    expect(v.coverage.expectedLogDays).toBe(15);
    expect(v.coverage.ratio).toBe(1);
  });

  it('never lets coverage exceed one, even with weekend logging', () => {
    const v = computeVerification({ baselineMinutesPerWeek: 100, measured: measured({ logDays: 21 }) });
    expect(v.coverage.ratio).toBe(1);
  });

  it('always surfaces the numbers behind the verdict', () => {
    const v = computeVerification({ baselineMinutesPerWeek: 246, measured: measured() });
    expect(v).toMatchObject({
      currentMinutesPerWeek: 36,
      sampleWeeks: 3,
      coverage: { expectedLogDays: expect.any(Number), actualLogDays: 13 },
    });
  });
});
