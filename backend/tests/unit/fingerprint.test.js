import { describe, it, expect } from 'vitest';
import {
  fingerprintOf, tokenize, groupByFingerprint, inferFrequency, stdDev, normalizeTitle,
} from '../../src/services/fingerprint.js';

describe('fingerprintOf', () => {
  it('collapses the same activity worded differently', () => {
    const variants = [
      'Weekly client report',
      'Client report - weekly',
      'weekly report (client)',
      'Client Report Sept 14',
      'CLIENT REPORT',
    ];
    const fps = new Set(variants.map(fingerprintOf));
    expect(fps.size).toBe(1);
  });

  it('does not group a bare word with a specific activity', () => {
    // "Report" carries no identity tokens beyond itself, so it is correctly
    // its own group rather than being absorbed into a richer title.
    expect(fingerprintOf('Report')).not.toBe(fingerprintOf('Weekly client report'));
  });

  it('keeps genuinely different activities apart', () => {
    expect(fingerprintOf('Weekly client report')).not.toBe(fingerprintOf('Discovery call Northwind'));
    expect(fingerprintOf('Invoice reminders')).not.toBe(fingerprintOf('Invoice reconciliation'));
  });

  it('ignores dates, times and ordinals', () => {
    expect(fingerprintOf('Standup 09:30')).toBe(fingerprintOf('Standup'));
    expect(fingerprintOf('Payroll 14/09/2026')).toBe(fingerprintOf('Payroll'));
    expect(fingerprintOf('Sprint review 3rd')).toBe(fingerprintOf('Sprint review'));
  });

  it('ignores meeting filler words', () => {
    expect(fingerprintOf('Call with Sarah about onboarding')).toBe(fingerprintOf('Sarah onboarding'));
  });

  it('is order-insensitive, because entry wording is not stable', () => {
    expect(fingerprintOf('client report')).toBe(fingerprintOf('report client'));
  });

  it('returns null when nothing meaningful is left', () => {
    expect(fingerprintOf('   ')).toBeNull();
    expect(fingerprintOf('the a of')).toBeNull();
    expect(fingerprintOf('123 456')).toBeNull();
  });

  it('is stable across calls', () => {
    expect(fingerprintOf('Payroll run')).toBe(fingerprintOf('Payroll run'));
  });
});

describe('tokenize', () => {
  it('drops noise words and keeps identity words', () => {
    expect(tokenize('Weekly call with the client about invoicing')).toEqual(
      expect.arrayContaining(['client', 'invoicing']),
    );
    expect(tokenize('Weekly call with the client')).not.toContain('weekly');
  });

  it('strips accents so the same word matches', () => {
    expect(tokenize('Réunion équipe')).toEqual(tokenize('Reunion equipe'));
  });
});

describe('normalizeTitle', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeTitle('  Weekly   report  ')).toBe('Weekly report');
  });

  it('caps runaway titles', () => {
    expect(normalizeTitle('x'.repeat(500))).toHaveLength(200);
  });
});

describe('groupByFingerprint', () => {
  const week = [
    { title: 'Client check-in — Northwind', durationMinutes: 45 },
    { title: 'Client check-in — Halcyon', durationMinutes: 45 },
    { title: 'Weekly client report', durationMinutes: 120 },
    { title: 'Client report (weekly)', durationMinutes: 130 },
    { title: 'Invoice reminders', durationMinutes: 40 },
  ];

  it('turns a flat list into a handful of groups', () => {
    const groups = groupByFingerprint(week);
    expect(groups.length).toBeLessThan(week.length);
  });

  it('sums the minutes in each group', () => {
    const groups = groupByFingerprint(week);
    const report = groups.find((g) => g.title.toLowerCase().includes('report'));
    expect(report.totalMinutes).toBe(250);
    expect(report.eventCount).toBe(2);
  });

  it('orders by time cost, so the biggest drain is sorted first', () => {
    const groups = groupByFingerprint(week);
    expect(groups[0].totalMinutes).toBeGreaterThanOrEqual(groups.at(-1).totalMinutes);
  });

  it('picks the most descriptive title in a bucket', () => {
    const groups = groupByFingerprint([
      { title: 'Client report', durationMinutes: 10 },
      { title: 'Weekly client report', durationMinutes: 10 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Weekly client report');
  });

  it('keeps unfingerprintable titles as their own groups rather than losing them', () => {
    const groups = groupByFingerprint([{ title: '123', durationMinutes: 30 }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].totalMinutes).toBe(30);
  });
});

describe('inferFrequency', () => {
  it.each([
    [10, 14, 'daily'],
    [3, 14, 'weekly'],
    [2, 14, 'biweekly'],
    [1, 14, 'ad_hoc'],
  ])('%i occurrences in %i days → %s', (n, days, expected) => {
    expect(inferFrequency(n, days)).toBe(expected);
  });
});

describe('stdDev', () => {
  it('is zero for identical values', () => {
    expect(stdDev([60, 60, 60])).toBe(0);
  });

  it('grows with spread', () => {
    expect(stdDev([10, 110])).toBeGreaterThan(stdDev([55, 65]));
  });

  it('is zero for fewer than two values', () => {
    expect(stdDev([42])).toBe(0);
    expect(stdDev([])).toBe(0);
  });
});
