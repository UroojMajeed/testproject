/**
 * Money crosses the wire as integer minor units and is only ever turned into
 * something readable at the edge. Nothing in between holds a float.
 */

/** "£1,250" — no pence, because these are planning figures, not an invoice. */
export function formatMoney(minor, currency = 'USD', { showMinor = false } = {}) {
  if (minor == null) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: showMinor ? 2 : 0,
    maximumFractionDigits: showMinor ? 2 : 0,
  }).format(minor / 100);
}

/** What the person typed, in major units, back into integer minor units. */
export function toMinor(major) {
  return Math.round(Number(major) * 100);
}

export function toMajor(minor) {
  return minor == null ? '' : minor / 100;
}

/**
 * "4h 30m". People think in hours; the API stores whole minutes. Both directions
 * live here so no component invents its own rounding.
 */
export function formatDuration(minutes) {
  if (!minutes) return '0h';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export const hoursToMinutes = (hours) => Math.round(Number(hours) * 60);
export const minutesToHours = (minutes) => (minutes == null ? '' : Math.round((minutes / 60) * 100) / 100);

/** "22–28 September" from two YYYY-MM-DD strings, in the reader's locale. */
export function formatWeekRange(startISO, endISO) {
  if (!startISO || !endISO) return '';
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  /*
   * formatRange, not two formats joined by a dash.
   *
   * The hand-rolled version dropped the month from the start date whenever both
   * ends shared one, which only reads correctly where the day comes first. In a
   * month-first locale 21–27 September came out as "21 – September 27". Worse,
   * a week spanning two months lost the first month altogether: 28 September to
   * 4 October rendered as "28 – October 4", which is a different week.
   *
   * Intl knows where the month goes and which parts are safe to elide, in every
   * locale, which is the whole reason it exists.
   */
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' })
    .formatRange(start, end);
}
