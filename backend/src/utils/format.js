/** 245 → "4h 05m". Durations are whole minutes everywhere in this codebase. */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

/** Prose form, for sentences: "4 hours 10 minutes", "45 minutes". */
export function formatHoursPhrase(minutes) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} minute${rest === 1 ? '' : 's'}`;
  if (!rest) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'} ${rest} minutes`;
}

/** Integer minor units → a display string. Never a float in storage. */
export function formatMoneyMinor(amountMinor, currency = 'USD') {
  const value = (amountMinor ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** Cost of N minutes at an hourly rate held in minor units. */
export function costOfMinutes(minutes, hourlyRateMinor) {
  return Math.round(((minutes ?? 0) / 60) * (hourlyRateMinor ?? 0));
}
