import { describe, it, expect } from 'vitest';
import { formatDate, currentTimezone } from './formatters.js';

describe('formatDate', () => {
  it('renders a date in the reader’s own locale, whatever that is', () => {
    const formatted = formatDate('2026-09-01T10:00:00.000Z');

    // Asserting the exact wording would be asserting the runner's locale, so check
    // the parts that are true in every locale: the year, and a month that is not
    // a bare number.
    expect(formatted).toContain('2026');
    expect(formatted).not.toMatch(/^\d+\/\d+\/\d+$/);
  });

  it('accepts a Date as readily as a string', () => {
    expect(formatDate(new Date('2026-09-01T10:00:00.000Z'))).toBe(formatDate('2026-09-01T10:00:00.000Z'));
  });

  it.each([[null], [undefined], [''], ['not a date']])('returns an empty string for %s', (value) => {
    // A component should be able to render this straight into the page without
    // having to guard against "Invalid Date" appearing in the UI.
    expect(formatDate(value)).toBe('');
  });
});

describe('currentTimezone', () => {
  it('returns an IANA zone name', () => {
    expect(currentTimezone()).toMatch(/^[A-Za-z]+(\/[A-Za-z_+-]+)*$/);
  });
});
