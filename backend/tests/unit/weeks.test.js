import { describe, it, expect } from 'vitest';
import {
  calendarPartsIn, toISODate, mondayOf, shiftWeeks, weekToAudit, weekEnding,
} from '../../src/utils/weeks.js';

/**
 * Which week an audit covers is calendar arithmetic, not instant arithmetic, and
 * everything here is a case where confusing the two gives the wrong week — which
 * would file somebody's Friday against the week before and silently corrupt every
 * comparison built on it.
 */

describe('resolving an instant to somebody’s calendar', () => {
  it('reads the date in the given timezone, not the server’s', () => {
    // 21:30 UTC on Friday is already Saturday in Karachi (+05:00).
    const instant = new Date('2026-09-25T21:30:00Z');

    expect(toISODate(calendarPartsIn(instant, 'UTC'))).toBe('2026-09-25');
    expect(toISODate(calendarPartsIn(instant, 'Asia/Karachi'))).toBe('2026-09-26');
  });

  it('reads the date west of UTC too', () => {
    // 02:00 UTC on Saturday is still Friday evening in Los Angeles.
    const instant = new Date('2026-09-26T02:00:00Z');

    expect(toISODate(calendarPartsIn(instant, 'UTC'))).toBe('2026-09-26');
    expect(toISODate(calendarPartsIn(instant, 'America/Los_Angeles'))).toBe('2026-09-25');
  });

  it('numbers weekdays the ISO way, Monday first', () => {
    expect(calendarPartsIn(new Date('2026-09-21T12:00:00Z'), 'UTC').isoWeekday).toBe(1);
    expect(calendarPartsIn(new Date('2026-09-25T12:00:00Z'), 'UTC').isoWeekday).toBe(5);
    expect(calendarPartsIn(new Date('2026-09-27T12:00:00Z'), 'UTC').isoWeekday).toBe(7);
  });
});

describe('finding the Monday', () => {
  it.each([
    ['2026-09-21', 'Monday'],
    ['2026-09-25', 'Friday'],
    ['2026-09-27', 'Sunday'],
  ])('%s (%s) belongs to the week starting 2026-09-21', (date) => {
    expect(mondayOf(calendarPartsIn(new Date(`${date}T12:00:00Z`), 'UTC'))).toBe('2026-09-21');
  });

  it('treats Sunday as the end of a week, not the start of one', () => {
    // The common off-by-one: US convention starts the week on Sunday, ISO does not,
    // and getting it wrong shifts every audit by a day for a seventh of all users.
    expect(mondayOf(calendarPartsIn(new Date('2026-09-27T12:00:00Z'), 'UTC'))).toBe('2026-09-21');
    expect(mondayOf(calendarPartsIn(new Date('2026-09-28T12:00:00Z'), 'UTC'))).toBe('2026-09-28');
  });

  it('crosses a month boundary', () => {
    expect(mondayOf(calendarPartsIn(new Date('2026-10-01T12:00:00Z'), 'UTC'))).toBe('2026-09-28');
  });

  it('crosses a year boundary', () => {
    expect(mondayOf(calendarPartsIn(new Date('2027-01-01T12:00:00Z'), 'UTC'))).toBe('2026-12-28');
  });
});

describe('shifting by whole weeks', () => {
  it('goes back and forward', () => {
    expect(shiftWeeks('2026-09-21', -1)).toBe('2026-09-14');
    expect(shiftWeeks('2026-09-21', 1)).toBe('2026-09-28');
    expect(shiftWeeks('2026-09-21', 0)).toBe('2026-09-21');
  });

  it('survives a daylight-saving change', () => {
    // The UK moves its clocks on 2026-10-25. Doing this arithmetic on local time
    // would land an hour out and, at midnight, a whole day out.
    expect(shiftWeeks('2026-10-19', 1)).toBe('2026-10-26');
    expect(shiftWeeks('2026-11-02', -1)).toBe('2026-10-26');
  });
});

describe('which week the audit covers', () => {
  const at = (iso) => new Date(iso);

  it('asks about this week once the audit day has arrived', () => {
    // Friday afternoon: the week is finished enough to recall.
    expect(weekToAudit(at('2026-09-25T15:00:00Z'), 'UTC', 'friday')).toBe('2026-09-21');
  });

  it('asks about last week before the audit day', () => {
    // Somebody signing up on a Tuesday has not finished this week yet.
    expect(weekToAudit(at('2026-09-22T09:00:00Z'), 'UTC', 'friday')).toBe('2026-09-14');
  });

  it('still means this week on the weekend after it closed', () => {
    expect(weekToAudit(at('2026-09-27T20:00:00Z'), 'UTC', 'friday')).toBe('2026-09-21');
  });

  it('rolls over on Monday to ask about the week just gone', () => {
    expect(weekToAudit(at('2026-09-28T09:00:00Z'), 'UTC', 'friday')).toBe('2026-09-21');
  });

  it('honours a different audit day', () => {
    const wednesday = at('2026-09-23T10:00:00Z');
    // Plenty of people do not work Friday, so the day is a setting.
    expect(weekToAudit(wednesday, 'UTC', 'wednesday')).toBe('2026-09-21');
    expect(weekToAudit(wednesday, 'UTC', 'friday')).toBe('2026-09-14');
  });

  it('uses the workspace timezone to decide, not the server’s', () => {
    // 20:00 UTC Thursday is already Friday in Karachi — so the Karachi user's week
    // has closed and the UTC one's has not.
    const instant = at('2026-09-24T20:00:00Z');

    expect(weekToAudit(instant, 'Asia/Karachi', 'friday')).toBe('2026-09-21');
    expect(weekToAudit(instant, 'UTC', 'friday')).toBe('2026-09-14');
  });

  it('falls back to Friday rather than throwing on an unknown day', () => {
    expect(weekToAudit(at('2026-09-25T15:00:00Z'), 'UTC', 'caturday')).toBe('2026-09-21');
  });
});

describe('the end of a week', () => {
  it('is the Sunday six days on', () => {
    expect(weekEnding('2026-09-21')).toBe('2026-09-27');
    expect(weekEnding('2026-12-28')).toBe('2027-01-03');
  });
});
