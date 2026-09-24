/**
 * Which week an audit covers.
 *
 * All of this is calendar arithmetic, not instant arithmetic, and the difference
 * is where the bugs live. "Which week is this?" is a question about somebody's
 * wall calendar. A user in Karachi filing at 9pm on Friday is still in Friday; a
 * server in UTC thinks it is already Saturday, and filed against the wrong week.
 *
 * So: resolve the instant to calendar parts in the workspace's timezone once, then
 * do every subtraction on plain dates in UTC, where a day is always 86,400,000ms
 * and no daylight saving can move it.
 */

const DAY_MS = 86_400_000;

/** ISO numbering: Monday is 1, Sunday is 7. */
export const WEEKDAYS = Object.freeze({
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
});

const SHORT_TO_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const pad = (n) => String(n).padStart(2, '0');

/** The calendar date and weekday an instant falls on, in a given timezone. */
export function calendarPartsIn(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    isoWeekday: SHORT_TO_ISO[parts.weekday],
  };
}

export function toISODate({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The Monday of the week containing a calendar date, as YYYY-MM-DD. */
export function mondayOf({ year, month, day, isoWeekday }) {
  const asUtc = Date.UTC(year, month - 1, day);
  const monday = new Date(asUtc - (isoWeekday - 1) * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

/** Shifts a YYYY-MM-DD by whole weeks, staying on the calendar. */
export function shiftWeeks(isoDate, weeks) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + weeks * 7 * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The week an audit filed *now* should cover.
 *
 * The rule is "the week that is closing". On or after the audit day, the current
 * week has enough of it behind you to recall, so that is the one. Before it, the
 * current week is unfinished and the most recent complete week is the one before.
 *
 * It falls out neatly for both cases that matter: someone signing up on a Tuesday
 * is asked about last week, and the Friday rhythm asks about the week just ending.
 */
export function weekToAudit(instant, timeZone, auditDay = 'friday') {
  const parts = calendarPartsIn(instant, timeZone);
  const thisWeek = mondayOf(parts);
  const closesOn = WEEKDAYS[auditDay] ?? WEEKDAYS.friday;

  return parts.isoWeekday >= closesOn ? thisWeek : shiftWeeks(thisWeek, -1);
}

/** Sunday of the week starting on a given Monday — the inclusive end of the range. */
export function weekEnding(weekStarting) {
  const [year, month, day] = weekStarting.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 6 * DAY_MS).toISOString().slice(0, 10);
}
