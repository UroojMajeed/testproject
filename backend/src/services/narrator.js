/**
 * Turns an engine decision into the sentence a founder reads.
 *
 * The split matters: the ENGINE decides the action, the saving and the
 * confidence from the user's own data. The narrator only phrases it. That is
 * why a language model is optional here and cannot change any number — swapping
 * this file for an LLM-backed one changes the prose and nothing else.
 */
import { formatHoursPhrase } from '../utils/format.js';

const TEMPLATES = {
  eliminate: (c) =>
    `${c.title} came up ${c.occurrences} times in ${c.windowDays} days for ${c.hours}, and you marked it `
    + `draining ${c.drainPct} of the time. It carries low business value, so the cheapest move is to stop `
    + `holding it — or to halve how often it runs.`,

  automate: (c) =>
    `${c.title} repeats ${c.occurrences} times in ${c.windowDays} days and takes ${c.hours}. The length barely `
    + `varies (${c.variance}), which is what rule-shaped work looks like — it is a strong candidate for a `
    + `workflow rather than a person.`,

  delegate: (c) =>
    `${c.title} took ${c.hours} across ${c.occurrences} entries, and you marked it draining ${c.drainPct} of `
    + `the time. ${c.quadrantNote} Hand over the doing and keep the final review.`,

  replace: (c) =>
    `${c.title} took ${c.hours} across ${c.occurrences} entries. It is valuable work you dislike, which is the `
    + `most expensive combination to keep — bring in someone who is suited to it.`,

  simplify: (c) =>
    `${c.title} took ${c.hours} across ${c.occurrences} entries, and its length swings by ${c.variance}. That `
    + `inconsistency usually means the process is unclear — tighten it before handing it to anyone.`,
};

const HEADLINES = {
  eliminate: (c) => `Stop running ${c.lowerTitle}, or halve how often it happens`,
  automate: (c) => `Put ${c.lowerTitle} behind a workflow`,
  delegate: (c) => `Hand ${c.lowerTitle} to someone else, keep the final review`,
  replace: (c) => `Bring in someone to take on ${c.lowerTitle}`,
  simplify: (c) => `Tighten ${c.lowerTitle} before you transfer it`,
};

function contextFrom(stats, rec, windowDays) {
  return {
    title: stats.title,
    lowerTitle: stats.title.charAt(0).toLowerCase() + stats.title.slice(1),
    occurrences: stats.occurrences,
    windowDays,
    hours: formatHoursPhrase(stats.totalMinutes),
    drainPct: `${Math.round(stats.drainingRatio * 100)}%`,
    variance: stats.avgMinutes ? `±${Math.round(stats.durationStdDev)} minutes` : 'an unclear amount',
    quadrantNote:
      stats.quadrant === 'replacement'
        ? 'It matters to the business, which is why this is a transfer and not a deletion.'
        : 'It is not where your hours are worth most.',
    savedHours: rec.estimatedHoursSavedPerWeek,
  };
}

export function narrate(stats, rec, { windowDays = 14 } = {}) {
  const ctx = contextFrom(stats, rec, windowDays);
  const title = (HEADLINES[rec.type] ?? HEADLINES.delegate)(ctx);
  const reason = (TEMPLATES[rec.type] ?? TEMPLATES.delegate)(ctx);
  return { title, reason };
}

export const NARRATOR_NAME = 'template.v1';
