/** Money is stored in integer minor units; it is only ever divided here. */
export function formatMoney(amountMinor, currency = 'USD', { compact = false } = {}) {
  const value = (amountMinor ?? 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: compact || Number.isInteger(value) ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

/** 245 → "4h 05m". Durations are whole minutes everywhere. */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return `${h}h ${String(rest).padStart(2, '0')}m`;
}

export function formatHours(hours, digits = 1) {
  return `${Number(hours ?? 0).toFixed(digits).replace(/\.0$/, '')}h`;
}

export function formatDate(value, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(value));
}

export function initialsOf(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
