/**
 * Turns a free-text activity title into a stable key, so the same work entered
 * nine different ways collapses into one recurring task.
 *
 * This is the hinge of the whole product: recurrence detection, the sort's
 * grouping, and every recommendation key off it.
 */
import crypto from 'node:crypto';

// Words that carry no identity — they describe the shape of an activity, not
// which activity it is.
const NOISE = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'with', 'w', 'via', 'on', 'at', 'in', 'by',
  'about', 'from', 'into', 'over', 'per', 'this', 'that', 'our', 'your', 'my', 'their', 'some',
  'call', 'meeting', 'meet', 'sync', 'catch', 'up', 'chat', 'session', 'slot', 'hold',
  'weekly', 'daily', 'monthly', 'quarterly', 'biweekly', 'recurring', 'regular',
  'am', 'pm', 'min', 'mins', 'minute', 'minutes', 'hr', 'hrs', 'hour', 'hours',
  'copy', 'draft', 'new', 'update', 'updated', 'final', 'v', 're', 'fwd',
  'mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'q1', 'q2', 'q3', 'q4', 'wk', 'week',
]);

/** The human-readable form: what the group is called in the UI. */
export function normalizeTitle(raw = '') {
  return String(raw)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["'<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** The token list a fingerprint is built from. Exported for testing. */
export function tokenize(raw = '') {
  return normalizeTitle(raw)
    .toLowerCase()
    // Drop anything that looks like a date, time or ordinal — "Sept 14",
    // "09:30", "#3", "(2)" are noise for grouping, not identity.
    .replace(/\b\d{1,2}[:.]\d{2}\s*(am|pm)?\b/g, ' ')
    .replace(/\b\d{1,4}([/-]\d{1,4}){1,2}\b/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !NOISE.has(tok));
}

/**
 * Tokens are de-duplicated and sorted before hashing, so "client report" and
 * "report — client" land in the same group. Word order almost never
 * distinguishes two recurring activities, but it very often varies between
 * entries for the same one.
 */
export function fingerprintOf(raw = '') {
  const tokens = tokenize(raw);
  if (!tokens.length) return null;
  const key = [...new Set(tokens)].sort().join('|');
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
}

/** Groups items into fingerprint buckets, largest time cost first. */
export function groupByFingerprint(items, { titleOf = (i) => i.title } = {}) {
  const buckets = new Map();

  for (const item of items) {
    const title = titleOf(item);
    const fp = fingerprintOf(title) ?? `raw:${normalizeTitle(title).toLowerCase()}`;
    if (!buckets.has(fp)) buckets.set(fp, { fingerprint: fp, items: [] });
    buckets.get(fp).items.push(item);
  }

  return [...buckets.values()]
    .map((b) => ({
      fingerprint: b.fingerprint,
      // The longest title in a bucket is usually the most descriptive one.
      title: b.items
        .map((i) => normalizeTitle(titleOf(i)))
        .sort((a, z) => z.length - a.length)[0],
      items: b.items,
      eventCount: b.items.length,
      totalMinutes: b.items.reduce((s, i) => s + (i.durationMinutes ?? 0), 0),
    }))
    .sort((a, z) => z.totalMinutes - a.totalMinutes);
}

/** Infers how often something happens from how many times it occurred. */
export function inferFrequency(occurrences = 0, windowDays = 14) {
  if (occurrences < 2) return 'ad_hoc';
  const perWeek = occurrences / Math.max(1, windowDays / 7);
  if (perWeek >= 4) return 'daily';
  if (perWeek >= 1.4) return 'weekly';
  if (perWeek >= 0.6) return 'biweekly';
  if (perWeek >= 0.2) return 'monthly';
  return 'irregular';
}

/** Population standard deviation, in the same unit as the input. */
export function stdDev(values = []) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
